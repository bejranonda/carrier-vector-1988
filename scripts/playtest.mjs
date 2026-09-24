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
 *   - a new pilot is routed to the training sortie, on the FIRST_FLIGHT HUD
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
        contacts: g.airborneTargets.filter((t) => t.isAlive).length
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
    check('new pilot is routed to the training sortie', s.scenario === 'TRAINING_SORTIE', s.scenario);
    const feedbackOnMenu = await page.evaluate(() => {
        const a = document.getElementById('feedback-link');
        return a && !a.hidden ? a.href : null;
    });
    check('the briefing offers a pre-filled feedback link',
        typeof feedbackOnMenu === 'string' && feedbackOnMenu.includes('/issues/new') && feedbackOnMenu.includes('Version'),
        feedbackOnMenu ? 'ok' : feedbackOnMenu);
    check('new pilot flies the FIRST_FLIGHT HUD', s.density === 'FIRST_FLIGHT', s.density);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await shot('02-deck');
    s = await snapshot(page);
    check('ENTER on the briefing reaches the deck', s.phase === 'ACTIVE' && s.view === 'MACRO_DECK', s);

    await page.waitForTimeout(SLOW ? 40000 : 12000);
    s = await snapshot(page);
    check('idling on the training deck costs the carrier nothing', s.hull === 100, { hull: s.hull, slow: SLOW });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(4500);
    await shot('03-climb-out');
    s = await snapshot(page);
    check('catapult launch puts the jet in the air', s.deck === 'AIRBORNE' && s.view === 'MICRO_FLIGHT', s);
    const feedbackInFlight = await page.evaluate(() => document.getElementById('feedback-link')?.hidden);
    check('the feedback link is hidden in flight', feedbackInFlight === true, feedbackInFlight);
    const contradicts = s.hint !== null && s.hintSeverity === 'INFO' && s.objectiveKey === 'W';
    check('no routine hint contradicts the climb-out order', !contradicts, { objective: s.objective, hint: s.hint });
    check('no trap-speed nag on the climb-out', !(s.hint ?? '').includes('TOO FAST'), s.hint);

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

    await page.keyboard.press('h');
    await page.waitForTimeout(400);
    await shot('06-help');
    await page.keyboard.press('Escape');
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
    await page.waitForTimeout(600);
    await shot('02-deck');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4500);
    await shot('03-cockpit');
    const s = await snapshot(page);
    check('a pilot with a completed mission graduates to ARCADE', s.density === 'ARCADE', s.density);
});

// ---------------------------------------------------------------------
// Phones
// ---------------------------------------------------------------------
/** Phone: brief, deck, launch, fly, and use the thumb chaff button. */
async function phoneFlight(page, shot, label) {
    await shot('01-briefing');
    const vp = page.viewportSize();
    await page.tap('#gameCanvas', { position: { x: vp.width / 2, y: vp.height - 60 } });
    await page.waitForTimeout(900);
    await shot('02-deck');
    let s = await snapshot(page);
    check(`${label}: tapping FLY reaches the deck`, s.phase === 'ACTIVE', s.phase);

    const launch = await page.evaluate(() => window.__game.touchLayout.launch);
    await page.tap('#gameCanvas', { position: { x: launch.x + launch.w / 2, y: launch.y + launch.h / 2 } });
    await page.waitForTimeout(4500);
    await shot('03-cockpit');
    s = await snapshot(page);
    check(`${label}: tapping LAUNCH puts the jet in the air`, s.deck === 'AIRBORNE', s.deck);

    const before = await page.evaluate(() => window.__game.physics.loadout.chaff);
    const chaff = await page.evaluate(() => window.__game.touchLayout.chaff);
    await page.tap('#gameCanvas', { position: { x: chaff.cx, y: chaff.cy } });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__game.physics.loadout.chaff);
    check(`${label}: the thumb chaff button releases chaff (#44)`, after === before - 1, { before, after });
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
