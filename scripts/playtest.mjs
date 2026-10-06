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
// A shared challenge link (v2.0.0): same waves, a score to beat
// ---------------------------------------------------------------------
await session('challenge', { width: 1280, height: 720 }, false, async (page, shot) => {
    await page.goto(`${url}?c=424242.5000.3`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);
    await shot('01-briefing');
    const state = await page.evaluate(() => ({
        scenario: window.__game.scenario.id,
        challenge: window.__game.challenge
    }));
    check('a challenge link opens SCRAMBLE with the run to beat',
        state.scenario === 'SCRAMBLE' && state.challenge?.seed === 424242 && state.challenge?.score === 5000, state);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('1'); // the one-time fly-style question: EASY
    await page.waitForTimeout(400);
    const seed = await page.evaluate(() => window.__game.scramble?.seed);
    check('the challenge flies the sharer\'s waves', seed === 424242, seed);
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

    const before = await page.evaluate(() => window.__game.physics.loadout.chaff);
    const chaff = await page.evaluate(() => window.__game.touchLayout.chaff);
    await page.tap('#gameCanvas', { position: { x: chaff.cx, y: chaff.cy } });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__game.physics.loadout.chaff);
    check(`${label}: the thumb chaff button releases chaff (#44)`, after === before - 1, { before, after });

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
}

await session('phone-landscape', { width: 844, height: 390 }, true, (page, shot) => phoneFlight(page, shot, 'phone'));
await session('phone-small', { width: 640, height: 360 }, true, (page, shot) => phoneFlight(page, shot, 'small phone'));

await session('phone-portrait', { width: 390, height: 844 }, true, async (page, shot) => {
    await shot('01-rotate');
    const rotating = await page.evaluate(() => window.__game.awaitingRotation);
    check('phone portrait asks the player to rotate', rotating === true, rotating);
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
