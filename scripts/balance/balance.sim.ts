/**
 * Headless balance sim - `npm run balance`.
 *
 * Plays whole SCRAMBLE runs through the real GameLoop (a stub canvas, no
 * browser) at roughly 50-100x real time, many seeds per profile, and prints
 * one line per run plus a mean per profile. One eight-minute browser run is
 * one sample of a noisy process; this is what decided v2.2.0's strafing passes
 * and found its last two stalls (KNOWN_ISSUES #105).
 *
 * Profiles (PROFILES, comma list):
 *   easy-hold     EASY, holds FIRE the whole run - the smart trigger decides
 *   std-steer     STANDARD, a crude bang-bang bot that points at the target
 *   easy-relaxed  EASY, looks every 1.5 s and taps FIRE only when told to
 *   std-relaxed   STANDARD, the same - fires only when the screen says FIRE
 *
 * Knobs (environment):
 *   SEEDS=8  SECS=480  PROFILES=easy-hold,std-steer
 *   PASSES=off    fighters never break off after a close pass (no strafing)
 *   TL=1          per-wave timeline on every run
 *   DIAG_WAVE=n   one line every 2 s during wave n: the jet, the designation,
 *                 every live contact (range, bearing, height, speed, state)
 *
 * Math.random is replaced by a generator seeded from the run's seed, so a run
 * replays exactly on the same code. Still compare means, not single runs: one
 * change anywhere sends a run down a different path.
 */
import { describe, it, expect, vi } from 'vitest';
import { AI_TUNING } from '../../src/tactics/EnemyAI';

type Profile = 'easy-hold' | 'std-steer' | 'easy-relaxed' | 'std-relaxed';
const PROFILES: readonly Profile[] = ['easy-hold', 'std-steer', 'easy-relaxed', 'std-relaxed'];

interface RunResult {
    kills: number;
    cleared: number;
    wave: number;
    score: number;
    jetsLost: number;
    hull: number;
    over: boolean;
    timeline?: string;
}

interface Vec { x: number; y: number; z: number }

/** A Canvas2D context that accepts every call and draws nothing. */
function stubCanvas(width = 1440, height = 900): HTMLCanvasElement {
    const noop = () => {};
    const ctx = {
        canvas: { width, height }, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
        shadowColor: '', shadowBlur: 0, globalAlpha: 1, globalCompositeOperation: 'source-over',
        textAlign: 'left', textBaseline: 'alphabetic', filter: 'none', imageSmoothingEnabled: true,
        fillRect: noop, clearRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
        moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
        stroke: noop, fill: noop, clip: noop, save: noop, restore: noop, translate: noop,
        rotate: noop, scale: noop, setTransform: noop, resetTransform: noop, setLineDash: noop,
        drawImage: noop, fillText: noop,
        measureText: (t: string) => ({ width: t.length * 7 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop })
    };
    return { width, height, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

/** mulberry32 - small, fast, good enough to stand in for Math.random. */
function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Bearing (deg, + right), ground range and height of a point from the jet. */
function relative(p: { position: Vec; yaw: number }, at: Vec) {
    const dx = at.x - p.position.x, dz = at.z - p.position.z;
    let rel = Math.atan2(dx, dz) - p.yaw;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    return { bearing: rel * 57.3, range: Math.hypot(dx, dz), dy: at.y - p.position.y };
}

const FRAME_MS = 16.7;
// The project carries no Node typings; this is the one Node API used.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

async function runOnce(profile: Profile, seed: number, seconds: number): Promise<RunResult> {
    const random = vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
    const { GameLoop } = await import('../../src/core/GameLoop');
    const game = new GameLoop(stubCanvas());
    // Reach into the loop the way the smoke test does: the frame callback and
    // the selected-weapon fire are private.
    const inner = game as unknown as {
        frame: (t: number) => void;
        fireSelectedWeapon: () => void;
    };
    game.resize(1440, 900);
    const easy = profile === 'easy-hold' || profile === 'easy-relaxed';
    game.setFlyStyle(easy ? 'EASY' : 'STANDARD', false);

    let now = 0;
    const step = (frames: number) => {
        for (let i = 0; i < frames; i++) { now += FRAME_MS; inner.frame(now); }
    };
    step(160);
    game.selectScenarioById('SCRAMBLE');
    game.confirmBriefing(seed);

    const frames = Math.round(seconds * 1000 / FRAME_MS);
    const keys = game.inputState;
    const timeline: string[] = [];
    let lastWave = -1;
    let burst = 0;
    for (let f = 0; f < frames && game.phase === 'ACTIVE'; f++) {
        if (profile === 'easy-hold') {
            keys[' '] = true;
        } else if (profile === 'easy-relaxed' || profile === 'std-relaxed') {
            // v2.1.0's relaxed player: reacts every 1.5 s, presses FIRE only
            // when the coach line or the objective says so, never steers.
            if (f % 90 === 0) {
                const text = `${game.currentHint?.text ?? ''} ${game.currentObjective().title}`;
                if (/FIRE|SPACE/.test(text)) {
                    if (profile === 'easy-relaxed') game.easyFire();
                    else if (game.selectedWeapon === 'GUN') burst = 8;
                    else inner.fireSelectedWeapon();
                }
            }
            keys[' '] = burst-- > 0;
        } else if (f % 6 === 0) {
            // Bang-bang steering at 20 Hz: roll toward the designated target,
            // pull, fire a missile on the nose, guns inside 1.2 km.
            const p = game.physics;
            const d = game.tracker.designated();
            for (const key of ['a', 'd', 'w', 's', ' ']) keys[key] = false;
            if (d) {
                const { bearing, range, dy } = relative(p, d.target.position);
                const elev = Math.atan2(dy, range) * 57.3 - p.pitch * 57.3;
                const roll = p.roll * 57.3;
                keys['d'] = bearing > 6 && Math.abs(roll) < 50;
                keys['a'] = bearing < -6 && Math.abs(roll) < 50;
                keys['w'] = elev > 3 || Math.abs(bearing) > 25;
                keys['s'] = elev < -6 && p.position.y > 400 && Math.abs(bearing) < 25;
                const onNose = Math.abs(bearing) < 12;
                if (game.selectedWeapon === 'AIM9' && onNose && range < 3500 && f % 72 === 0) {
                    inner.fireSelectedWeapon();
                }
                keys[' '] = game.selectedWeapon === 'GUN' && onNose && range < 1200;
            } else {
                keys['w'] = p.position.y < 500;
            }
        }
        step(1);

        const wave = game.scramble?.wave ?? 0;
        if (env.TL && wave !== lastWave) {
            lastWave = wave;
            const b = game.score.breakdown;
            timeline.push(`w${wave}@${Math.round(f * FRAME_MS / 1000)}s cleared${game.scramble?.wavesCleared ?? 0} k${b.fighterKills + b.bomberKills} score${game.score.totalScore} hull${Math.round(game.deck.inventory.carrierHealth)}`);
        }
        if (env.DIAG_WAVE && wave === +env.DIAG_WAVE && f % 120 === 0) {
            const p = game.physics;
            const d = game.tracker.designated();
            const contacts = game.airborneTargets.filter(t => t.isAlive).map(t => {
                const r = relative(p, t.position);
                return {
                    id: t.id.slice(-8), range: Math.round(r.range), bearing: Math.round(r.bearing), dy: Math.round(r.dy),
                    speed: Math.round(Math.hypot(t.velocity.x, t.velocity.z)),
                    state: (t.aiExtendTimer ?? 0) > 0 ? 'EXTEND' : t.aiBehavior
                };
            });
            console.log(`  t=${Math.round(f * FRAME_MS / 1000)}s jet ${Math.round(p.airSpeed)} m/s ${Math.round(p.position.y)} m`,
                `| target ${d ? `${d.target.id.slice(-8)} ${Math.round(d.range)} m` : '-'}`,
                `| coach "${(game.currentHint?.text ?? '').slice(0, 32)}"`, JSON.stringify(contacts));
        }
    }

    const b = game.score.breakdown;
    random.mockRestore();
    return {
        kills: b.fighterKills + b.bomberKills,
        cleared: game.scramble?.wavesCleared ?? 0,
        wave: game.scramble?.wave ?? 0,
        score: game.score.totalScore,
        jetsLost: b.airframesLost,
        hull: Math.round(game.deck.inventory.carrierHealth),
        over: game.phase !== 'ACTIVE',
        ...(env.TL ? { timeline: timeline.join(' | ') } : {})
    };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('balance sim', () => {
    it('plays SCRAMBLE runs per profile and prints the means', async () => {
        vi.stubGlobal('document', {
            createElement: () => stubCanvas(), addEventListener: () => {},
            documentElement: { dataset: {}, style: { setProperty: () => {} } }
        });
        vi.stubGlobal('window', { addEventListener: () => {}, innerWidth: 1440, innerHeight: 900 });
        vi.stubGlobal('requestAnimationFrame', () => 0);
        vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

        if (env.PASSES === 'off') (AI_TUNING as { EXTEND_RANGE: number }).EXTEND_RANGE = 0;

        const seeds = Number(env.SEEDS ?? 8);
        const seconds = Number(env.SECS ?? 480);
        const profiles = (env.PROFILES ?? 'easy-hold,std-steer').split(',') as Profile[];
        for (const profile of profiles) {
            if (!PROFILES.includes(profile)) throw new Error(`unknown profile ${profile}; one of ${PROFILES.join(', ')}`);
        }

        const summary: Record<string, unknown>[] = [];
        for (const profile of profiles) {
            const runs: RunResult[] = [];
            for (let s = 0; s < seeds; s++) {
                const seed = 1000 + s * 7919;
                const started = Date.now();
                const run = await runOnce(profile, seed, seconds);
                runs.push(run);
                console.log(profile, `seed ${seed}`, JSON.stringify(run), `${((Date.now() - started) / 1000).toFixed(1)}s`);
            }
            summary.push({
                profile, runs: runs.length, seconds,
                kills: +mean(runs.map(r => r.kills)).toFixed(1),
                killsRange: `${Math.min(...runs.map(r => r.kills))}-${Math.max(...runs.map(r => r.kills))}`,
                cleared: +mean(runs.map(r => r.cleared)).toFixed(1),
                score: Math.round(mean(runs.map(r => r.score))),
                jetsLost: +mean(runs.map(r => r.jetsLost)).toFixed(2),
                hull: Math.round(mean(runs.map(r => r.hull))),
                over: `${runs.filter(r => r.over).length}/${runs.length}`
            });
        }
        console.log('\nSUMMARY');
        console.table(summary);
        expect(summary).toHaveLength(profiles.length);
    });
});
