#!/usr/bin/env node
/**
 * CARRIER VECTOR: 1988 - Instrumented first-session playtest
 *
 * WHY THIS EXISTS
 * Five review suites (3,438 lines) read the source carefully and none of them
 * noticed that four pairs of HUD elements were being drawn into the same
 * rectangle on every frame, that the tutorial was strafing the player's own
 * carrier, or that the most-seen coaching hint was wrong on every launch. 921
 * unit tests were green throughout. Twenty minutes of a real browser found all
 * of it. This script is that browser, checked in, so the next regression is
 * caught by a command rather than by a player.
 *
 * WHAT IT DOES
 * Starts its own Vite dev server (for the `window.__game` telemetry handle),
 * then plays the first session the way a beginner does - at desktop and phone
 * sizes, with a fresh profile - screenshotting every screen and asserting the
 * things a player would feel:
 *
 *   - no page errors, anywhere
 *   - a new pilot is routed to SCRAMBLE, on the FIRST_FLIGHT HUD, and is
 *     airborne the moment they press ENTER (v2.0.0)
 *   - a first SPACE scores a kill within seconds; a chain banner, the medal
 *     debrief and FLY AGAIN all work in a real browser
 *   - idling on the deck of the training sortie costs the carrier nothing
 *   - no coaching hint contradicts the objective during the climb-out
 *   - a held bank on default settings is a turn, with the nose on the horizon
 *   - a hands-off pilot comes out of afterburner
 *
 * USAGE
 *   npm run playtest                  # all checks, screenshots to playtest-output/
 *   PLAYTEST_SLOW=1 npm run playtest  # include the 40 s idle-on-deck check
 *
 * Chromium comes from PLAYWRIGHT_BROWSERS_PATH (pre-installed in Claude Code
 * cloud sessions) or `npx playwright-core install chromium` locally.
 */

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('playtest-output');
mkdirSync(OUT, { recursive: true });
const SLOW = process.env.PLAYTEST_SLOW === '1';

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
}

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}/`;

const browser = await chromium.launch();

/** Snapshot of the running game, read through the dev-only handle. */
const snapshot = (page) => page.evaluate(() => {
    const g = window.__game;
    const p = g.physics;
    const deg = (r) => Math.round(r * 180 / Math.PI);
    return {
        phase: g.phase, scenario: g.scenario.id, view: g.currentView, density: g.hud.hudDensity,
        hdg: ((deg(p.yaw) % 360) + 360) % 360, pitch: deg(p.pitch), roll: deg(p.roll),
        alt: Math.round(p.position.y), speed: Math.round(p.airSpeed), throttle: +p.throttle.toFixed(2),
        hull: g.deck.inventory.carrierHealth, deck: g.deck.aircraftState,
        objective: g.currentObjective()?.title ?? null, objectiveKey: g.currentObjective()?.key ?? null,
        hint: g.currentHint?.text ?? null, hintSeverity: g.currentHint?.severity ?? null,
        contacts: g.airborneTargets.filter((t) => t.isAlive).length,
        wave: g.scramble?.wave ?? null,
        kills: g.score.breakdown.fighterKills + g.score.breakdown.bomberKills,
        weapon: g.selectedWeapon
    };
});

async function session(name, viewport, touch, body, options = {}) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600); // CRT warm-up -> briefing
    const shot = (label) => page.screenshot({ path: `${OUT}/${name}-${label}.png` });
    try {
        await body(page, shot);
    } catch (e) {
        check(`${name}: session ran to completion`, false, String(e));
    }
    if (!options.expectErrors) check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 3));
    await context.close();
}

// ---------------------------------------------------------------------
// Desktop, first session
// ---------------------------------------------------------------------
await session('desktop', { width: 1440, height: 900 }, false, async (page, shot) => {
    await shot('01-briefing');
    let s = await snapshot(page);
    check('new pilot is routed to SCRAMBLE', s.scenario === 'SCRAMBLE', s.scenario);
    const feedbackOnMenu = await page.evaluate(() => {
        const a = document.getElementById('feedback-link');
        return a && !a.hidden ? a.href : null;
    });
    check('the briefing offers a pre-filled feedback link',
        typeof feedbackOnMenu === 'string' && feedbackOnMenu.includes('/issues/new') && feedbackOnMenu.includes('Version'),
        feedbackOnMenu ? 'ok' : feedbackOnMenu);
    check('new pilot flies the FIRST_FLIGHT HUD', s.density === 'FIRST_FLIGHT', s.density);

    // v2.1.0: a brand-new pilot is asked once how they want to fly.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const chooser = await page.evaluate(() => window.__game.flyStyleChooserOpen);
    check('a brand-new pilot is asked how they want to fly, once', chooser === true, chooser);
    await shot('01b-fly-style');
    // This session models a STANDARD pilot; the older-player session flies EASY.
    const t0 = Date.now();
    await page.keyboard.press('2');
    await page.waitForTimeout(400);
    s = await snapshot(page);
    check('ENTER on the briefing puts a new pilot straight into the air',
        s.phase === 'ACTIVE' && s.view === 'MICRO_FLIGHT' && s.deck === 'AIRBORNE', s);
    check('missiles are armed for the first shot', s.weapon === 'AIM9', s.weapon);

    // The first shot, the way the wave banner says: SPACE once it is up.
    let firstKill = null;
    for (let i = 0; i < 60 && firstKill === null; i++) {
        await page.waitForTimeout(250);
        s = await snapshot(page);
        if (s.wave >= 1 && i % 4 === 0) await page.keyboard.press(' ');
        if (s.kills > 0) firstKill = (Date.now() - t0) / 1000;
        if (i === 6) await shot('02-wave-one');
    }
    await shot('03-first-kill');
    check('a first SPACE scores a kill within 10 s of pressing ENTER',
        firstKill !== null && firstKill < 10, { secondsToFirstKill: firstKill });
    s = await snapshot(page);
    check('no routine hint contradicts the objective in SCRAMBLE', !(s.hint ?? '').includes('APPROACH'), s.hint);

    // A held bank, the way a beginner turns: hold A, touch nothing else.
    await page.evaluate(() => {
        const p = window.__game.physics;
        p.position = { x: 0, y: 2500, z: 0 };
        p.velocity = { x: 0, y: 0, z: 220 };
        p.pitch = 0; p.roll = 0; p.yaw = 0;
    });
    let prev = (await snapshot(page)).hdg;
    let turned = 0;
    await page.keyboard.down('a');
    for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(1000);
        const now = (await snapshot(page)).hdg;
        let d = now - prev;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        turned += d;
        prev = now;
    }
    s = await snapshot(page);
    await shot('04-held-bank');
    await page.keyboard.up('a');
    check('a held bank turns briskly (> 9 deg/s)', Math.abs(turned) / 8 > 9, { degPerSecond: +(Math.abs(turned) / 8).toFixed(1) });
    check('the nose stays near the horizon in a held bank', Math.abs(s.pitch) < 15, { pitch: s.pitch });

    await page.waitForTimeout(12000);
    s = await snapshot(page);
    check('a hands-off pilot comes out of afterburner', s.throttle <= 1.0, { throttle: s.throttle });

    await page.keyboard.press('u');
    await page.waitForTimeout(400);
    await shot('05-arcade-hud');
    s = await snapshot(page);
    check('U steps FIRST_FLIGHT -> ARCADE', s.density === 'ARCADE', s.density);

    // Pilot menu (v1.11.0): "I should have menu to click and select what to
    // do" - a real, clickable, always-reachable pause menu.
    const menuButtonVisible = await page.evaluate(() => {
        const b = document.getElementById('menu-button');
        return b && !b.hidden;
    });
    check('the MENU button is visible in flight on desktop', menuButtonVisible === true, menuButtonVisible);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shot('06-pilot-menu');
    let menuState = await page.evaluate(() => ({ open: window.__game.menuOpen, paused: window.__game.paused }));
    check('ESC opens the pilot menu and pauses the sortie', menuState.open && menuState.paused, menuState);

    const posBefore = await page.evaluate(() => ({ ...window.__game.physics.position }));
    await page.waitForTimeout(1000);
    const posAfter = await page.evaluate(() => ({ ...window.__game.physics.position }));
    check('the sortie is genuinely frozen while the menu is open',
        JSON.stringify(posBefore) === JSON.stringify(posAfter), { posBefore, posAfter });

    const objectivePanel = await page.evaluate(() => window.__game.menuObjective());
    check('the menu restates the current objective in plain words',
        typeof objectivePanel.plain === 'string' && objectivePanel.plain.length > 10, objectivePanel);

    await page.keyboard.press('Enter'); // RESUME is always the first item
    await page.waitForTimeout(300);
    menuState = await page.evaluate(() => ({ open: window.__game.menuOpen, phase: window.__game.phase }));
    check('ENTER on RESUME closes the menu and changes nothing else',
        !menuState.open && menuState.phase === 'ACTIVE', menuState);

    await page.keyboard.press('h');
    await page.waitForTimeout(400);
    await shot('07-help');
    await page.keyboard.press('Escape');

    // The renovated debrief (v2.0.0): stars, XP, FLY AGAIN on ENTER.
    await page.evaluate(() => {
        const g = window.__game;
        g.scramble.wavesCleared = 5;
        g.deck.inventory.carrierHealth = 0;
    });
    await page.waitForTimeout(2600);
    await shot('08-debrief');
    const debrief = await page.evaluate(() => ({
        phase: window.__game.phase,
        stars: window.__game.medals.SCRAMBLE ?? 0,
        xp: window.__game.career.xp
    }));
    check('the run ends in a debrief that pays a star and career XP',
        debrief.phase === 'DEBRIEF' && debrief.stars > 0 && debrief.xp > 0, debrief);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    s = await snapshot(page);
    check('ENTER on the debrief flies the same mission again, airborne',
        s.phase === 'ACTIVE' && s.scenario === 'SCRAMBLE' && s.deck === 'AIRBORNE', s);
});

// ---------------------------------------------------------------------
// Desktop, the guided training sortie (deck, catapult, climb-out)
// ---------------------------------------------------------------------
await session('training', { width: 1440, height: 900 }, false, async (page, shot) => {
    await page.keyboard.press('2');
    await page.waitForTimeout(200);
    let s = await snapshot(page);
    check('key 2 selects the training sortie', s.scenario === 'TRAINING_SORTIE', s.scenario);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('2'); // the one-time fly-style question: STANDARD
    await page.waitForTimeout(800);
    await shot('01-deck');
    s = await snapshot(page);
    check('ENTER on the training briefing reaches the deck', s.phase === 'ACTIVE' && s.view === 'MACRO_DECK', s);

    await page.waitForTimeout(SLOW ? 40000 : 12000);
    s = await snapshot(page);
    check('idling on the training deck costs the carrier nothing', s.hull === 100, { hull: s.hull, slow: SLOW });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(4500);
    await shot('02-climb-out');
    s = await snapshot(page);
    check('catapult launch puts the jet in the air', s.deck === 'AIRBORNE' && s.view === 'MICRO_FLIGHT', s);
    const feedbackInFlight = await page.evaluate(() => document.getElementById('feedback-link')?.hidden);
    check('the feedback link is hidden in flight', feedbackInFlight === true, feedbackInFlight);
    const contradicts = s.hint !== null && s.hintSeverity === 'INFO' && s.objectiveKey === 'W';
    check('no routine hint contradicts the climb-out order', !contradicts, { objective: s.objective, hint: s.hint });
    check('no trap-speed nag on the climb-out', !(s.hint ?? '').includes('TOO FAST'), s.hint);
    check('no "line up with the deck" on the climb-out', !(s.hint ?? '').includes('APPROACH'), s.hint);
});

// ---------------------------------------------------------------------
// Laptop, a returning pilot who has completed a mission
// ---------------------------------------------------------------------
await session('laptop', { width: 1280, height: 720 }, false, async (page, shot) => {
    await page.evaluate(() => {
        localStorage.setItem('carrier-vector-1988.missionRecords',
            JSON.stringify({ TRAINING_SORTIE: { best: 900, completions: 1, attempts: 1 } }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    await shot('01-briefing');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    await shot('02-cockpit');
    const s = await snapshot(page);
    check('a pilot with a completed mission graduates to ARCADE', s.density === 'ARCADE', s.density);

    // v2.0.0 playtest: the six-step "hold W" checkout was pinned over every
    // endless run a veteran flew. It is for pilots who have completed nothing.
    await page.evaluate(() => { window.__game.returnToBriefing(); window.__game.selectScenarioById('CARRIER_DEFENSE'); });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const checklist = await page.evaluate(() => window.__game.training.checklist().length);
    check('a veteran is not shown the beginner flight checkout', checklist === 0, checklist);
    await shot('03-veteran-deck');
});

// ---------------------------------------------------------------------
// An older, non-gamer player (v2.1.0): EXTRA LARGE text, mouse only, EASY
// ---------------------------------------------------------------------
await session('older-player', { width: 1440, height: 900 }, false, async (page, shot) => {
    // Text size is the first thing they change, from the briefing itself.
    await page.keyboard.press('t');
    await page.keyboard.press('t');
    await page.waitForTimeout(300);
    const z = await page.evaluate(() => ({ size: window.__game.textSize, zoom: window.__game.uiZoom }));
    check('T on the briefing enlarges every word (EXTRA LARGE = 150% zoom)', z.size === 'HUGE' && z.zoom === 1.5, z);
    await shot('01-briefing-xl');

    // Mouse only from here: click the big FLY button...
    await page.mouse.click(720, 900 - 100);
    await page.waitForTimeout(400);
    await shot('02-fly-style-xl');
    // ...then the EASY card.
    const card = await page.evaluate(() => {
        const g = window.__game;
        const l = window.__ui.flyStyleLayout(g.viewWidth, g.viewHeight);
        return { x: (l.easy.x + 40) * g.uiZoom, y: (l.easy.y + 40) * g.uiZoom, open: g.flyStyleChooserOpen };
    });
    check('one click on FLY opens the fly-style question', card.open === true, card.open);
    await page.mouse.click(card.x, card.y);
    await page.waitForTimeout(500);
    let s = await snapshot(page);
    const easy = await page.evaluate(() => window.__game.easyMode);
    check('one click on EASY puts them in the air on EASY', easy === true && s.deck === 'AIRBORNE', { easy, deck: s.deck });

    // Hold the mouse button down - the EASY advice - and touch nothing else.
    const t0 = Date.now();
    const hints = new Set();
    await page.mouse.move(720, 450);
    await page.mouse.down();
    let kills = 0;
    for (let i = 0; i < 90 && kills < 3; i++) {
        await page.waitForTimeout(500);
        s = await snapshot(page);
        if (s.hint) hints.add(s.hint);
        kills = s.kills;
        if (i === 8) await shot('03-easy-flight-xl');
    }
    await page.mouse.up();
    check('holding the mouse button alone shoots down 3 planes within 45 s',
        kills >= 3, { kills, seconds: (Date.now() - t0) / 1000 });
    const steering = [...hints].filter(h => /TURN TOWARD|PRESS \[T\]|A \/ D|HOLD A OR D/.test(h));
    check('the coach never asks an EASY pilot to steer', steering.length === 0, steering);

    // The pause menu has the two switches they need.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shot('04-menu-xl');
    const ids = await page.evaluate(() => window.__game.menuItems().map(i => i.id));
    check('the pause menu offers EASY FLYING and TEXT SIZE', ids.includes('EASY') && ids.includes('TEXT_SIZE'), ids);
    await page.keyboard.press('Escape');

    // End the run; FLY AGAIN by clicking it.
    await page.evaluate(() => { const g = window.__game; g.scramble.wavesCleared = 5; g.deck.inventory.carrierHealth = 0; });
    await page.waitForTimeout(2800);
    await shot('05-debrief-xl');
    const again = await page.evaluate(() => {
        const g = window.__game;
        const l = window.__ui.debriefLayout(g.viewWidth, g.viewHeight, g.debriefData());
        return { x: (l.again.x + l.again.w / 2) * g.uiZoom, y: (l.again.y + l.again.h / 2) * g.uiZoom };
    });
    await page.mouse.click(again.x, again.y);
    await page.waitForTimeout(500);
    s = await snapshot(page);
    check('a click on FLY AGAIN flies again', s.phase === 'ACTIVE' && s.deck === 'AIRBORNE', s.phase);
});

// ---------------------------------------------------------------------
// A shared challenge link, both ends (v2.0.0; v2.3.0: the friend's own first
// screen, the score to beat in flight, and a share panel to reply with)
// ---------------------------------------------------------------------
await session('challenge', { width: 1280, height: 720 }, false, async (page, shot) => {
    // The shape a real link has: /c/, the run in the query, the name after #.
    await page.goto(`${url}c/?c=424242.5000.3.e#n=Anna`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    await shot('01-welcome');
    const state = await page.evaluate(() => ({
        scenario: window.__game.scenario.id,
        challenge: window.__game.challenge,
        welcome: window.__game.challengeWelcomeOpen,
        title: document.title
    }));
    check('a challenge link opens on "ANNA CHALLENGES YOU", with SCRAMBLE and the run to beat loaded',
        state.welcome === true && state.scenario === 'SCRAMBLE' && state.challenge?.seed === 424242
        && state.challenge?.score === 5000 && state.challenge?.name === 'Anna', state);
    check('the browser tab says who sent it', /^Anna challenges you/.test(state.title), state.title);
    await page.keyboard.press('Enter'); // PLAY - IT'S FREE
    await page.waitForTimeout(500);
    let flight = await page.evaluate(() => ({
        phase: window.__game.phase, seed: window.__game.scramble?.seed, easy: window.__game.easyMode,
        chooser: window.__game.flyStyleChooserOpen, target: window.__game.scoreTarget
    }));
    // Anna flew EASY: a newcomer flies EASY too, without the question.
    check('ACCEPT flies the sharer\'s waves on their fly style, no question asked',
        flight.phase === 'ACTIVE' && flight.seed === 424242 && flight.easy === true && flight.chooser === false, flight);
    check('the run chases Anna\'s score', flight.target?.score === 5000 && flight.target?.who === 'ANNA', flight.target);
    await page.evaluate(() => window.__game.score.recordBonus(5100));
    // Its own moment: it may wait (up to 2.5 s) for a wave banner to clear.
    await page.waitForFunction(() => window.__game.callouts.active().some((c) => c.group === 'RECORD'), null, { timeout: 4000 }).catch(() => {});
    const banners = await page.evaluate(() => window.__game.callouts.active().map((c) => c.text));
    await shot('02-passed');
    // "Ahead", not "beat": the run is not over, and the debrief says who won.
    check('passing it puts "AHEAD OF ANNA!" on screen, there and then', banners.includes('AHEAD OF ANNA!'), banners);

    await page.evaluate(() => { window.__game.deck.inventory.carrierHealth = 0; });
    await page.waitForTimeout(2800);
    await shot('03-debrief');
    const debrief = await page.evaluate(() => {
        const d = window.__game.debriefData();
        return { headline: d.headline, label: d.share?.label, line: d.share?.text };
    });
    check('the debrief leads with the win and offers the reply', debrief.headline === 'YOU BEAT ANNA!' && debrief.label === 'REPLY TO ANNA', debrief);

    await page.keyboard.press('c');
    await page.waitForTimeout(1200);
    const panel = await page.evaluate(() => {
        const img = document.getElementById('share-picture');
        return { open: !document.getElementById('share').hidden, picture: img.src.startsWith('blob:'), width: img.naturalWidth };
    });
    check('C opens the share panel with the picture drawn (1080 square)', panel.open && panel.picture && panel.width === 1080, panel);
    // Typing a name is the pilot's, not the game's: M must not mute, K must
    // not switch controls, and it goes on the link after the #.
    const before = await page.evaluate(() => ({ muted: window.__sfx.muted, scheme: window.__game.controlScheme }));
    await page.click('#share-name');
    await page.keyboard.type('Mike');
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({
        phase: window.__game.phase, muted: window.__sfx.muted, scheme: window.__game.controlScheme,
        name: window.__game.pilotName, url: window.__game.currentShare().url,
        message: document.getElementById('share-message').textContent
    }));
    check('a name typed in the panel goes on the link, and nowhere else',
        after.phase === 'DEBRIEF' && after.muted === before.muted && after.scheme === before.scheme
        && after.name === 'Mike' && /\/c\/\?c=424242\.\d+\.\d+\.e#n=Mike$/.test(after.url), after);
    check('the message ends with the link, alone on its line', after.message.split('\n').pop() === after.url, after.message.slice(-90));
    await shot('04-share-panel');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const closed = await page.evaluate(() => ({ open: !document.getElementById('share').hidden, phase: window.__game.phase }));
    check('ESC closes the panel and leaves the debrief where it was', !closed.open && closed.phase === 'DEBRIEF', closed);

    // Opened by a MOUSE click (v2.3.0 review): the press used to end by
    // handing focus back to the canvas, and ESC then did nothing.
    const reply = await page.evaluate(() => {
        const g = window.__game;
        const l = window.__ui.debriefLayout(g.viewWidth, g.viewHeight, g.debriefData());
        return { x: (l.share.x + l.share.w / 2) * g.uiZoom, y: (l.share.y + l.share.h / 2) * g.uiZoom };
    });
    await page.mouse.click(reply.x, reply.y);
    await page.waitForTimeout(400);
    const clicked = await page.evaluate(() => ({
        open: !document.getElementById('share').hidden,
        focusInside: document.getElementById('share').contains(document.activeElement)
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const after2 = await page.evaluate(() => !document.getElementById('share').hidden);
    check('a click on REPLY TO ANNA opens the panel with the keyboard in it, and ESC closes it',
        clicked.open && clicked.focusInside && !after2, { clicked, openAfterEsc: after2 });
});

// A STANDARD challenge link: a newcomer is asked how to fly first, then flies
// the sharer's waves (v2.3.0 review - the session above only opens .e links).
await session('challenge-standard', { width: 1280, height: 720 }, false, async (page) => {
    await page.goto(`${url}c/?c=424242.5000.3#n=Anna`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const asked = await page.evaluate(() => ({ chooser: window.__game.flyStyleChooserOpen, phase: window.__game.phase }));
    check('a STANDARD challenge asks a newcomer how to fly first', asked.chooser === true, asked);
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    const flying = await page.evaluate(() => ({
        phase: window.__game.phase, seed: window.__game.scramble?.seed, easy: window.__game.easyMode, target: window.__game.scoreTarget
    }));
    check('...then flies the same waves, chasing Anna\'s score', flying.phase === 'ACTIVE' && flying.seed === 424242
        && flying.easy === true && flying.target?.score === 5000, flying);
});

// ---------------------------------------------------------------------
// Phones
// ---------------------------------------------------------------------
/** Phone: brief, straight into SCRAMBLE, thumb chaff; then the deck via the training sortie. */
async function phoneFlight(page, shot, label) {
    await shot('01-briefing');
    const vp = page.viewportSize();
    await page.tap('#gameCanvas', { position: { x: vp.width / 2, y: vp.height - 60 } });
    await page.waitForTimeout(400);
    // The one-time fly-style question: tap the EASY card.
    const easyCard = await page.evaluate(() => {
        const g = window.__game;
        const l = window.__ui.flyStyleLayout(g.viewWidth, g.viewHeight);
        return { x: (l.easy.x + l.easy.w / 2) * g.uiZoom, y: (l.easy.y + l.easy.h / 2) * g.uiZoom, open: g.flyStyleChooserOpen };
    });
    check(`${label}: the fly-style question appears and is tappable`, easyCard.open === true, easyCard.open);
    await page.tap('#gameCanvas', { position: { x: easyCard.x, y: easyCard.y } });
    await page.waitForTimeout(900);
    await shot('02-airborne');
    let s = await snapshot(page);
    check(`${label}: tapping FLY puts a new pilot in the air`, s.phase === 'ACTIVE' && s.deck === 'AIRBORNE', s.deck);
    const easy = await page.evaluate(() => window.__game.easyMode);
    check(`${label}: tapping EASY turns EASY flying on`, easy === true, easy);

    // v2.2.0: EASY in SCRAMBLE needs one control. No stick, no pills, no
    // chaff (nothing fires a missile at the jet), no recovery button.
    const kit = await page.evaluate(() => window.__game.touchLayout.kit);
    check(`${label}: EASY in SCRAMBLE shows one big FIRE and nothing it does not use`,
        kit.flight === false && kit.chaff === false && kit.recover === false && kit.bigFire === true
        && kit.stores.every(v => v === false), kit);
    // ...and a thumb anywhere on the world is the trigger.
    for (let i = 0; i < 40; i++) {
        const ready = await page.evaluate(() => window.__game.easyTriggerChoice() !== 'NOT_YET');
        if (ready) break;
        await page.waitForTimeout(150);
    }
    const rails = await page.evaluate(() => window.__game.physics.loadout.sidewinders);
    await page.tap('#gameCanvas', { position: { x: vp.width * 0.18, y: vp.height * 0.7 } });
    await page.waitForTimeout(300);
    const railsAfter = await page.evaluate(() => window.__game.physics.loadout.sidewinders);
    check(`${label}: on EASY a tap anywhere fires when a shot is good`, railsAfter === rails - 1, { rails, railsAfter });
    await shot('02b-easy-controls');

    // The deck still works on a phone: training sortie, FLY, LAUNCH.
    await page.evaluate(() => { window.__game.returnToBriefing(); window.__game.selectScenarioById('TRAINING_SORTIE'); });
    await page.waitForTimeout(300);
    await page.tap('#gameCanvas', { position: { x: vp.width / 2, y: vp.height - 60 } });
    await page.waitForTimeout(900);
    await shot('03-deck');
    s = await snapshot(page);
    check(`${label}: the training sortie reaches the deck`, s.phase === 'ACTIVE' && s.view === 'MACRO_DECK', s.view);
    const launch = await page.evaluate(() => window.__game.touchLayout.launch);
    await page.tap('#gameCanvas', { position: { x: launch.x + launch.w / 2, y: launch.y + launch.h / 2 } });
    await page.waitForTimeout(4500);
    await shot('04-cockpit');
    s = await snapshot(page);
    check(`${label}: tapping LAUNCH puts the jet in the air`, s.deck === 'AIRBORNE', s.deck);

    // A deck mission keeps its countermeasure: SAMs fire missiles here.
    const before = await page.evaluate(() => window.__game.physics.loadout.chaff);
    const chaff = await page.evaluate(() => window.__game.touchLayout.chaff);
    await page.tap('#gameCanvas', { position: { x: chaff.cx, y: chaff.cy } });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__game.physics.loadout.chaff);
    check(`${label}: the thumb chaff button releases chaff in a deck mission (#44)`, after === before - 1, { before, after });
}

await session('phone-landscape', { width: 844, height: 390 }, true, (page, shot) => phoneFlight(page, shot, 'phone'));
await session('phone-small', { width: 640, height: 360 }, true, (page, shot) => phoneFlight(page, shot, 'small phone'));

await session('phone-portrait', { width: 390, height: 844 }, true, async (page, shot) => {
    await shot('01-briefing-upright');
    // v2.2.0: the menus work upright - a tap on FLY used to be swallowed
    // with no prompt. The flight itself still asks for landscape.
    await page.tap('#gameCanvas', { position: { x: 195, y: 844 - 60 } });
    await page.waitForTimeout(400);
    const asked = await page.evaluate(() => window.__game.flyStyleChooserOpen);
    check('phone portrait: the briefing takes a tap upright', asked === true, asked);
    await page.evaluate(() => window.__game.chooseFlyStyle('EASY'));
    await page.waitForTimeout(400);
    await shot('02-rotate');
    const rotating = await page.evaluate(() => window.__game.phase === 'ACTIVE' && window.__game.awaitingRotation);
    check('phone portrait: the flight asks the player to rotate', rotating === true, rotating);
});

// A phone shares with a tap (v2.3.0): the panel must survive the tap that
// opened it (the first build closed itself on the tap's own click).
await session('phone-share', { width: 844, height: 390 }, true, async (page, shot) => {
    await page.evaluate(() => {
        const g = window.__game;
        g.setFlyStyle('EASY');
        g.selectScenarioById('SCRAMBLE');
        g.confirmBriefing(7);
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const g = window.__game; g.score.recordBonus(3000); g.deck.inventory.carrierHealth = 0; });
    await page.waitForTimeout(2800);
    const share = await page.evaluate(() => {
        const g = window.__game;
        const r = window.__ui.debriefLayout(g.viewWidth, g.viewHeight, g.debriefData()).share;
        return { x: (r.x + r.w / 2) * g.uiZoom, y: (r.y + r.h / 2) * g.uiZoom };
    });
    await page.tap('#gameCanvas', { position: share });
    await page.waitForTimeout(1200);
    await shot('01-panel');
    const panel = await page.evaluate(() => ({
        open: !document.getElementById('share').hidden,
        picture: document.getElementById('share-picture').naturalWidth,
        // No share sheet in a headless browser: the app links stand in.
        apps: [...document.querySelectorAll('#share-apps a')].map((a) => a.textContent),
        phase: window.__game.phase
    }));
    check('phone: a tap on SHARE opens the panel and it stays open', panel.open && panel.phase === 'DEBRIEF', panel);
    check('phone: with no share sheet, WhatsApp, LINE and a text message are offered',
        panel.picture === 1080 && panel.apps.join(',') === 'WHATSAPP,LINE,TEXT MESSAGE', panel);
});

// ---------------------------------------------------------------------
// A fatal failure shows a recovery screen instead of a frozen canvas
// ---------------------------------------------------------------------
await session('crash', { width: 1280, height: 720 }, false, async (page, shot) => {
    await page.evaluate(() => {
        // Break every frame from here on, the way a real renderer fault would.
        window.__game.frame = () => { throw new Error('playtest: forced frame failure'); };
    });
    await page.waitForTimeout(1500);
    await shot('01-crash-screen');
    const state = await page.evaluate(() => ({
        visible: !document.getElementById('crash')?.hidden,
        report: document.getElementById('crash-report')?.href ?? ''
    }));
    check('a persistent frame failure shows the crash screen', state.visible, state.visible);
    check('the crash screen links a pre-filled report', state.report.includes('Crash+report') || state.report.includes('Crash%20report'), state.report.slice(0, 80));
}, { expectErrors: true });

await browser.close();
await server.close();

const failed = results.filter((r) => !r.ok);
writeFileSync(`${OUT}/report.json`, JSON.stringify({ url, slow: SLOW, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed.length === 0 ? 0 : 1);
