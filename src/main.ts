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
import { SCENARIOS } from './core/Scenarios';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Could not find #gameCanvas');

    const game = new GameLoop(canvas);

    // Dev-only handle, so a browser session can be measured and driven from
    // the outside (time-to-first-kill, forcing a mission end for a screenshot).
    // Stripped from production builds by the bundler's dead-code elimination.
    if (import.meta.env.DEV) {
        const dev = window as unknown as Record<string, unknown>;
        dev.__game = game;
        dev.__sfx = soundFX;
    }

    /**
     * Safe-area insets, read from CSS environment variables through a probe
     * element. A notch or a home indicator is not part of the usable screen,
     * and a control drawn under one cannot be pressed.
     */
    const readInsets = () => {
        const probe = document.getElementById('safe-area-probe');
        if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
        const style = getComputedStyle(probe);
        const px = (v: string) => Number.parseFloat(v) || 0;
        return {
            top: px(style.paddingTop),
            right: px(style.paddingRight),
            bottom: px(style.paddingBottom),
            left: px(style.paddingLeft)
        };
    };

    const handleResize = () => {
        game.resize(window.innerWidth, window.innerHeight);
        game.applyControlScheme(readInsets());
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // First user gesture unlocks the Web Audio API (browser autoplay policy)
    const unlockAudio = () => {
        game.ensureAudio();
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('mousedown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('mousedown', unlockAudio);
    // A phone never produces a keydown or a mousedown, so without these two
    // the game is silent for its entire first session on a touchscreen.
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('pointerdown', unlockAudio);

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
        if (key === 'o') {
            game.cyclePacing();
            return;
        }
        // C is the debrief's "copy the daily card", so the palette only gets
        // it everywhere else.
        if (key === 'c' && game.phase !== 'DEBRIEF') {
            e.preventDefault();
            game.cyclePalette();
            return;
        }
        if (key === 'v') {
            e.preventDefault();
            if (game.phase === 'ACTIVE' && game.currentView === 'MICRO_FLIGHT') {
                game.togglePadlock();
            } else {
                game.cycleThreatLevel();
            }
            return;
        }
        if (key === 'k') {
            game.cycleControlScheme();
            return;
        }

        // --- Phase transitions ---
        if (game.phase === 'BRIEFING') {
            if (key === 'enter') {
                e.preventDefault();
                game.confirmBriefing();
            } else if (key === 'arrowup' || key === 'arrowdown') {
                e.preventDefault();
                game.cycleMapChoice(key === 'arrowup' ? -1 : 1);
            } else if (key === 'arrowleft' || key === 'arrowright') {
                e.preventDefault();
                game.selectScenario(key === 'arrowleft' ? -1 : 1);
            } else if (key >= '1' && key <= String(SCENARIOS.length)) {
                // Direct scenario pick by the number shown on its pill. Bounded
                // by the real scenario count - this accepted 1-9 while the
                // control schema documented 1-5, so four of the keys the help
                // overlay never mentioned silently did nothing.
                game.selectScenarioByIndex(Number(key) - 1);
            } else if (key === 'd') {
                // Today's daily sortie: the same seeded run for everyone.
                e.preventDefault();
                game.startDailySortie();
            } else if (key === 's') {
                // Quick start for returning players
                game.confirmBriefing();
                game.hotStartAirborne();
            }
            return;
        }
        if (game.phase === 'DEBRIEF') {
            if (key === 'enter') game.restartFromDebrief();
            else if (key === 'c') game.copyDailyCard();
            return;
        }
        if (game.phase !== 'ACTIVE') return;

        // --- View toggle ---
        if (key === 'tab') {
            e.preventDefault();
            game.currentView = game.currentView === 'MICRO_FLIGHT' ? 'MACRO_DECK' : 'MICRO_FLIGHT';
            return;
        }

        // --- Target designation ---
        if (key === 't') {
            e.preventDefault();
            game.cycleDesignation(e.shiftKey ? -1 : 1);
            return;
        }
        if (key === 'y') {
            e.preventDefault();
            game.releaseDesignation();
            return;
        }

        // --- Flight assist level ---
        if (key === 'f') {
            e.preventDefault();
            game.cycleAssistLevel();
            return;
        }

        // --- Pitch inversion toggle (I) ---
        if (key === 'i') {
            e.preventDefault();
            game.togglePitchInversion();
            return;
        }

        // --- HUD density toggle (U) ---
        if (key === 'u') {
            e.preventDefault();
            game.toggleHudDensity();
            return;
        }

        // --- Autopilot terrain following ---
        if (key === 'g') {
            e.preventDefault();
            game.toggleTerrainFollowing();
            return;
        }

        // --- Recovery assist (fly me home) ---
        if (key === 'l') {
            e.preventDefault();
            game.toggleApproachAssist();
            return;
        }

        // --- Chaff ---
        if (key === 'x') {
            e.preventDefault();
            game.releaseChaff();
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

        // --- Arcade time rewind (5 seconds) ---
        if (key === 'backspace') {
            if (game.currentView === 'MICRO_FLIGHT') {
                e.preventDefault();
                game.triggerTimeRewind();
                return;
            }
        }

        // --- Context-sensitive number keys ---
        if (key === '1' || key === '2' || key === '3' || key === '4') {
            if (game.currentView === 'MICRO_FLIGHT') {
                if (key === '1') game.selectedWeapon = 'GUN';
                else if (key === '2') game.selectedWeapon = 'AIM9';
                else if (key === '3') game.selectedWeapon = 'BOMB';
                else if (key === '4') game.selectedWeapon = 'HARM';
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

        // --- Rush the turnaround ---
        if (key === 'r') {
            if (game.currentView === 'MACRO_DECK') {
                e.preventDefault();
                game.rushTurnaround();
            }
            return;
        }

        // --- Weapon release (edge-triggered; held fire is handled in the
        //     fixed update so the cannon rate is frame-rate independent) ---
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            if (game.currentView !== 'MICRO_FLIGHT') return;
            game.fireSelectedWeapon();
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
    /** Pointer position in CSS pixels, which is what every layout uses. */
    const pointAt = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    canvas.addEventListener('pointerdown', (e) => {
        const { x, y } = pointAt(e);

        if (game.helpVisible) {
            game.helpVisible = false;
            return;
        }
        // The rotate prompt swallows input: there is nothing to press until
        // the device is turned.
        if (game.awaitingRotation) return;

        if (game.handleMenuTap(x, y)) return;
        if (game.phase !== 'ACTIVE') return;

        if (game.controlScheme === 'TOUCH') {
            e.preventDefault();
            // Register the touch FIRST. Pointer capture is a nicety - it keeps
            // a thumb that slides off the canvas reporting to us - but it
            // throws for a pointer the browser no longer considers active,
            // and a throw here would abort the handler and swallow the input
            // entirely. That is exactly what it did: the stick and the weapon
            // pills registered nothing at all.
            game.touch.down(
                { id: e.pointerId, x, y },
                game.touchLayout,
                game.currentView === 'MACRO_DECK' ? 'DECK' : 'FLIGHT'
            );
            try {
                canvas.setPointerCapture?.(e.pointerId);
            } catch {
                // Without capture the pointerup may not reach us, so the
                // window-level blur handler is the backstop.
            }
            return;
        }

        // Keyboard players still get click-to-designate, which costs nothing
        // and is the obvious thing to try with a mouse in hand.
        // Desktop button clicks (deck & HUD) take priority over designation.
        if (game.handleDesktopClick(x, y)) return;
        if (game.currentView === 'MICRO_FLIGHT') game.designateAtPoint(x, y);
    });

    canvas.addEventListener('pointermove', (e) => {
        const { x, y } = pointAt(e);
        if (game.controlScheme === 'TOUCH') {
            game.touch.move({ id: e.pointerId, x, y });
            return;
        }
        // Desktop: show pointer cursor when hovering clickable areas
        if (game.phase === 'ACTIVE') {
            canvas.style.cursor = 'default';
            // A cheap proxy: just set pointer if in the bottom HUD strip or top-right button zone
            if (game.currentView === 'MICRO_FLIGHT') {
                const nearBottom = y > game.viewHeight - 60;
                const topRight = y < 55 && x > game.viewWidth - 320;
                if (nearBottom || topRight) canvas.style.cursor = 'pointer';
            } else if (game.currentView === 'MACRO_DECK') {
                canvas.style.cursor = 'pointer';
            }
        }
    });

    const releasePointer = (e: PointerEvent) => {
        game.touch.up(e.pointerId);
    };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('lostpointercapture', releasePointer);

    // A phone browser will happily scroll, zoom or bounce the page out from
    // under a game that does not say otherwise.
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // Releasing focus must not leave keys stuck down mid-manoeuvre.
    window.addEventListener('blur', () => {
        game.inputState = {};
        game.touch.clear();
    });
    // An orientation change fires before the viewport settles on some
    // browsers, so re-solve once it has.
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 120));

    game.start();
});
