/**
 * CARRIER VECTOR: 1988 - Main Entry & Input Dispatcher
 * Wires keyboard inputs, canvas resizing, audio initiation, and view transitions.
 */

import './style.css';
import { GameLoop } from './core/GameLoop';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Could not find #gameCanvas');

    const game = new GameLoop(canvas);

    // Dynamic resize handler
    const handleResize = () => {
        game.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Track held keys
    const keys: Record<string, boolean> = {};

    // First user gesture unlocks Web Audio API
    const unlockAudio = () => {
        game.ensureAudio();
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('mousedown', unlockAudio);
    };
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('mousedown', unlockAudio);

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        keys[key] = true;

        // View toggle
        if (e.key === 'Tab') {
            e.preventDefault();
            game.currentView = game.currentView === 'MICRO_FLIGHT' ? 'MACRO_DECK' : 'MICRO_FLIGHT';
            return;
        }

        // Weapons Bay Door Toggle (key 'B')
        if (key === 'b') {
            e.preventDefault();
            game.physics.bayOpen = !game.physics.bayOpen;
            game.deck.log(`WEAPONS BAY ${game.physics.bayOpen ? 'OPENED (RCS x4.0)' : 'CLOSED'}`);
        }

        // Weapon Selection
        if (key === '1') {
            if (game.currentView === 'MICRO_FLIGHT') {
                game.selectedWeapon = 'GUN';
            } else {
                // Deck View: Adjust Fuel -500L
                game.deck.plannedFuel = Math.max(1000, game.deck.plannedFuel - 500);
            }
        } else if (key === '2') {
            if (game.currentView === 'MICRO_FLIGHT') {
                game.selectedWeapon = 'AIM9';
            } else {
                // Deck View: Adjust Fuel +500L
                game.deck.plannedFuel = Math.min(game.physics.maxFuel, game.deck.plannedFuel + 500);
            }
        } else if (key === '3') {
            if (game.currentView === 'MICRO_FLIGHT') {
                game.selectedWeapon = 'BOMB';
            } else {
                // Deck View: Cycle Sidewinders (0 to 6)
                game.deck.plannedLoadout.sidewinders = (game.deck.plannedLoadout.sidewinders + 2) % 8;
            }
        } else if (key === '4') {
            if (game.currentView === 'MACRO_DECK') {
                // Deck View: Cycle Bombs (0 to 4)
                game.deck.plannedLoadout.ironBombs = (game.deck.plannedLoadout.ironBombs + 1) % 5;
            }
        }

        // Launch Catapult in Deck View
        if (e.key === 'Enter') {
            if (game.currentView === 'MACRO_DECK' && game.deck.aircraftState === 'CATAPULT_READY') {
                const launched = game.deck.triggerCatapultLaunch();
                if (launched) {
                    // Sync loaded munitions to aircraft
                    game.physics.fuel = game.deck.plannedFuel;
                    game.physics.loadout = { ...game.deck.plannedLoadout };
                    game.spawnInitialSortie();
                }
            }
        }

        // Fire Weapons (Spacebar)
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            if (game.currentView === 'MICRO_FLIGHT') {
                if (game.selectedWeapon === 'GUN') {
                    game.weapons.fireGun(game.physics);
                } else if (game.selectedWeapon === 'AIM9') {
                    game.weapons.fireSidewinder(game.physics, game.airborneTargets);
                } else if (game.selectedWeapon === 'BOMB') {
                    game.weapons.dropBomb(game.physics);
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });

    // Continuous Flight Control Input Tick (60Hz)
    setInterval(() => {
        if (game.currentView !== 'MICRO_FLIGHT') return;

        const dt = 0.016;

        // Pitch (Elevator)
        if (keys['w'] || keys['arrowup']) game.physics.applyPitchInput(1.0, dt); // Nose up
        if (keys['s'] || keys['arrowdown']) game.physics.applyPitchInput(-1.0, dt); // Nose down

        // Roll (Ailerons)
        if (keys['a'] || keys['arrowleft']) game.physics.applyRollInput(-1.0, dt); // Roll left
        if (keys['d'] || keys['arrowright']) game.physics.applyRollInput(1.0, dt); // Roll right

        // Yaw (Rudder)
        if (keys['q']) game.physics.applyYawInput(-1.0, dt); // Yaw left
        if (keys['e']) game.physics.applyYawInput(1.0, dt); // Yaw right

        // Throttle (Shift to advance, Ctrl to retard)
        if (keys['shift']) {
            game.physics.throttle = Math.min(1.5, game.physics.throttle + 0.5 * dt);
        }
        if (keys['control']) {
            game.physics.throttle = Math.max(0.0, game.physics.throttle - 0.5 * dt);
        }

        // Rapid fire Vulcan cannon while holding space
        if (keys[' '] && game.selectedWeapon === 'GUN') {
            game.weapons.fireGun(game.physics);
        }
    }, 16);

    // Start Bridge Loop
    game.start();
});
