/**
 * CARRIER VECTOR: 1988 - Main Entry & Input Dispatcher
 *
 * Wires keyboard input, canvas resizing, audio unlock and phase
 * transitions. Continuous flight-control axes are NOT applied here: they
 * are read from GameLoop.inputState inside the fixed-timestep update, so
 * control authority stays exactly time-consistent. (The original version
 * ran controls on a separate setInterval(16ms) with a hardcoded dt=0.016,
 * which drifted from real elapsed time and decoupled input from the
 * render loop.)
 */

import './style.css';
import { GameLoop } from './core/GameLoop';
import { soundFX } from './audio/SoundFX';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Could not find #gameCanvas');

    const game = new GameLoop(canvas);

    const handleResize = () => game.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', handleResize);
    handleResize();

    // First user gesture unlocks the Web Audio API (browser autoplay policy)
    const unlockAudio = () => {
        game.ensureAudio();
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('mousedown', unlockAudio);
    };
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('mousedown', unlockAudio);

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        game.inputState[key] = true;

        // --- Global overlay / system keys ---
        if (key === 'h' || key === 'f1') {
            e.preventDefault();
            game.helpVisible = !game.helpVisible;
            return;
        }
        if (key === 'escape') {
            e.preventDefault();
            game.helpVisible = false;
            return;
        }
        if (key === 'm') {
            soundFX.toggleMute();
            return;
        }
        if (key === 'p') {
            game.cycleDisplayMode();
            return;
        }

        // --- Phase transitions ---
        if (game.phase === 'BRIEFING') {
            if (key === 'enter') {
                e.preventDefault();
                game.confirmBriefing();
            } else if (key === 'arrowleft' || key === 'arrowright') {
                e.preventDefault();
                game.selectScenario(key === 'arrowleft' ? -1 : 1);
            } else if (key >= '1' && key <= '9') {
                // Direct scenario pick by the number shown on its pill.
                game.selectScenarioByIndex(Number(key) - 1);
            } else if (key === 's') {
                // Quick start for returning players
                game.confirmBriefing();
                game.hotStartAirborne();
            }
            return;
        }
        if (game.phase === 'DEBRIEF') {
            if (key === 'enter') game.restartFromDebrief();
            return;
        }
        if (game.phase !== 'ACTIVE') return;

        // --- View toggle ---
        if (key === 'tab') {
            e.preventDefault();
            game.currentView = game.currentView === 'MICRO_FLIGHT' ? 'MACRO_DECK' : 'MICRO_FLIGHT';
            return;
        }

        // --- Weapons bay ---
        if (key === 'b') {
            e.preventDefault();
            game.physics.bayOpen = !game.physics.bayOpen;
            game.training.progress.bayToggled = true;
            game.deck.log(`WEAPONS BAY ${game.physics.bayOpen ? 'OPENED (RCS x4.0)' : 'CLOSED'}`);
            return;
        }

        // --- Context-sensitive number keys ---
        if (key === '1' || key === '2' || key === '3' || key === '4') {
            if (game.currentView === 'MICRO_FLIGHT') {
                if (key === '1') game.selectedWeapon = 'GUN';
                else if (key === '2') game.selectedWeapon = 'AIM9';
                else if (key === '3') game.selectedWeapon = 'BOMB';
            } else {
                const deck = game.deck;
                if (key === '1') deck.plannedFuel = Math.max(1000, deck.plannedFuel - 500);
                else if (key === '2') deck.plannedFuel = Math.min(game.physics.maxFuel, deck.plannedFuel + 500);
                else if (key === '3') deck.plannedLoadout.sidewinders = (deck.plannedLoadout.sidewinders + 2) % 8;
                else if (key === '4') deck.plannedLoadout.ironBombs = (deck.plannedLoadout.ironBombs + 1) % 5;
            }
            return;
        }

        // --- Catapult launch ---
        if (key === 'enter') {
            if (game.currentView === 'MACRO_DECK') {
                game.requestCatapultLaunch();
            }
            return;
        }

        // --- Weapon release (edge-triggered; held fire is handled in the
        //     fixed update so the cannon rate is frame-rate independent) ---
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            if (game.currentView !== 'MICRO_FLIGHT') return;
            if (game.selectedWeapon === 'AIM9') {
                game.weapons.fireSidewinder(game.physics, game.airborneTargets);
            } else if (game.selectedWeapon === 'BOMB') {
                game.weapons.dropBomb(game.physics);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        game.inputState[e.key.toLowerCase()] = false;
    });

    /**
     * Click-to-continue on the menu screens. A keyboard-only game still owes
     * a new player an obvious way past the title card: clicking the briefing
     * or the debrief does what the highlighted key does. Deliberately NOT
     * wired into the deck or the cockpit, where a stray click must never
     * fire a catapult.
     */
    canvas.addEventListener('pointerdown', () => {
        if (game.helpVisible) {
            game.helpVisible = false;
            return;
        }
        if (game.phase === 'BRIEFING') game.confirmBriefing();
        else if (game.phase === 'DEBRIEF') game.restartFromDebrief();
    });

    // Releasing focus must not leave keys stuck down mid-manoeuvre.
    window.addEventListener('blur', () => {
        game.inputState = {};
    });

    game.start();
});
