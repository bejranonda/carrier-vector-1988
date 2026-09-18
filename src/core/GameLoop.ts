/**
 * CARRIER VECTOR: 1988 - The Bridge Loop (Core Simulation Coordinator)
 * Integrates:
 * - Macro Carrier Deck Logistics
 * - 3D Vector Flight Simulation
 * - Tactical Radar LOS & RWR
 * - Dynamic Threats & Weapon Combat
 * - Procedural Web Audio Engine
 */

import { AircraftPhysics } from '../flight/AircraftPhysics';
import type { Vector3 } from '../flight/AircraftPhysics';
import { VectorRenderer, WireframeModels } from '../renderer/VectorRenderer';
import { HUD } from '../renderer/HUD';
import type { AirborneTarget } from '../renderer/HUD';
import { TacticalTerrain, SensorTacticsManager } from '../tactics/RadarLOS';
import { DeckManager } from '../carrier/DeckManager';
import { WeaponsSystem } from '../flight/Weapons';
import { soundFX } from '../audio/SoundFX';

export class GameLoop {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;

    // Simulation Subsystems
    public physics: AircraftPhysics;
    public renderer: VectorRenderer;
    public hud: HUD;
    public terrain: TacticalTerrain;
    public sensors: SensorTacticsManager;
    public deck: DeckManager;
    public weapons: WeaponsSystem;

    // 3D Static World Meshes
    private carrierMesh = WireframeModels.createCarrier();
    private mig23Mesh = WireframeModels.createMiG23();
    private bomberMesh = WireframeModels.createBomber();
    private samMesh = WireframeModels.createSAMLauncher();

    // View State
    public currentView: 'MICRO_FLIGHT' | 'MACRO_DECK' = 'MICRO_FLIGHT';
    public selectedWeapon: 'GUN' | 'AIM9' | 'BOMB' = 'GUN';

    // Combat Entities
    public airborneTargets: AirborneTarget[] = [];

    // Catapult launch sequence animation
    public isCatapultLaunching: boolean = false;
    public catapultProgress: number = 0; // 0 to 1

    private lastTimestamp: number = 0;
    private audioStarted: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D canvas context');
        this.ctx = ctx;

        this.renderer = new VectorRenderer(canvas);
        this.hud = new HUD(canvas.width, canvas.height);
        this.terrain = new TacticalTerrain();
        this.sensors = new SensorTacticsManager(this.terrain);
        this.deck = new DeckManager();
        this.weapons = new WeaponsSystem();
        this.physics = new AircraftPhysics();

        this.spawnInitialSortie();
    }

    public spawnInitialSortie() {
        // Start airborne on sortie over the canyon
        this.physics.position = { x: 0, y: 750, z: 1200 };
        this.physics.velocity = { x: 0, y: 0, z: 230 };
        this.physics.pitch = 0;
        this.physics.yaw = 0;
        this.physics.roll = 0;
        this.physics.throttle = 0.7;
        this.physics.fuel = 4500;
        this.deck.aircraftState = 'AIRBORNE';

        this.spawnEnemyThreats();
    }

    private spawnEnemyThreats() {
        this.airborneTargets = [
            {
                id: 'MIG-23-A',
                name: 'MiG-23 FLOGGER #1',
                position: { x: -400, y: 650, z: 7500 },
                velocity: { x: 20, y: 0, z: -180 },
                isAlive: true
            },
            {
                id: 'MIG-23-B',
                name: 'MiG-23 FLOGGER #2',
                position: { x: 300, y: 700, z: 7800 },
                velocity: { x: -15, y: 0, z: -180 },
                isAlive: true
            },
            {
                id: 'TU-22-BACKFIRE',
                name: 'Tu-22M BACKFIRE',
                position: { x: 0, y: 1200, z: 11000 },
                velocity: { x: 0, y: 0, z: -210 },
                isAlive: true
            }
        ];
    }

    public resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.renderer.resize(width, height);
        this.hud.resize(width, height);
    }

    public start() {
        requestAnimationFrame(this.step.bind(this));
    }

    public ensureAudio() {
        if (!this.audioStarted) {
            soundFX.init();
            this.audioStarted = true;
        }
    }

    private step(timestamp: number) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        let dt = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;

        if (dt > 0.1) dt = 0.1; // clamp delta

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.step.bind(this));
    }

    private update(dt: number) {
        // 1. Always tick the macro carrier logistics engine
        this.deck.update(dt);

        // 2. Handle Catapult launch sequence if active
        if (this.deck.aircraftState === 'CATAPULT_LAUNCHING') {
            this.isCatapultLaunching = true;
            this.catapultProgress += dt / 2.5;

            // Accelerate along catapult track on the carrier deck
            const trackStartZ = -30;
            const trackEndZ = 140;
            const curZ = trackStartZ + (trackEndZ - trackStartZ) * (this.catapultProgress ** 1.8);

            this.physics.position = { x: 5, y: 22.5, z: curZ };
            this.physics.velocity = { x: 0, y: 0, z: 40 + this.catapultProgress * 120 };
            this.physics.pitch = 0.05;
            this.physics.roll = 0;
            this.physics.yaw = 0;
            this.physics.throttle = 1.5; // Full afterburner for cat shot

            if (this.catapultProgress >= 1.0) {
                this.isCatapultLaunching = false;
                this.catapultProgress = 0;
                this.currentView = 'MICRO_FLIGHT'; // Jump into cockpit
                soundFX.playCatapultLaunch();
            }
        }

        // 3. Flight Sortie update
        if (this.deck.aircraftState === 'AIRBORNE') {
            this.physics.update(dt);

            // Audio update
            soundFX.updateEngine(this.physics.throttle, true);

            // Update Tactical Sensors & RWR
            this.sensors.update(dt, this.physics);
            soundFX.setRWRState(this.sensors.masterRwrState);

            // Update Weapons & Combat
            this.weapons.update(
                dt,
                this.terrain,
                this.airborneTargets,
                this.sensors.samSites,
                (destroyedTarget) => {
                    this.deck.log(`COMBAT REPORT: ${destroyedTarget.name} DESTROYED.`);
                    // Check if all threats in strike package are dead
                    const livingMiGs = this.airborneTargets.filter(t => t.isAlive && t.id.startsWith('MIG'));
                    if (livingMiGs.length === 0) {
                        this.deck.markStrikeIntercepted('STRIKE-1');
                    }
                    if (destroyedTarget.id === 'TU-22-BACKFIRE') {
                        this.deck.markStrikeIntercepted('STRIKE-2');
                    }
                },
                (destroyedSAM) => {
                    this.deck.log(`RADAR STRIKE: ${destroyedSAM.name} NEUTRALIZED BY MK.82.`);
                }
            );

            // Update AI airborne targets
            for (const t of this.airborneTargets) {
                if (!t.isAlive) continue;
                t.position.x += t.velocity.x * dt;
                t.position.y += t.velocity.y * dt;
                t.position.z += t.velocity.z * dt;
            }

            // Terrain collision check (CFIT - Controlled Flight Into Terrain)
            const groundElevation = this.terrain.getElevation(this.physics.position.x, this.physics.position.z);
            if (this.physics.position.y <= groundElevation + 2) {
                // Ground crash!
                this.weapons.spawnExplosion(this.physics.position, 40, '#ff3300');
                this.deck.inventory.spareAirframes = Math.max(0, this.deck.inventory.spareAirframes - 1);
                this.deck.log('MAYDAY: AIRCRAFT LOST TO TERRAIN IMPACT IN CANYON!');
                this.physics.position.y = groundElevation + 2;
                this.physics.velocity = { x: 0, y: 0, z: 0 };
                this.physics.throttle = 0;
                this.deck.aircraftState = 'HANGAR_MAINTENANCE';
                this.deck.currentTaskProgress = 0;
                this.currentView = 'MACRO_DECK';
            }

            // Carrier Recovery Check (Arresting gear trap at CV-68 near z=0, x=0)
            const distToCarrier = Math.hypot(this.physics.position.x, this.physics.position.z);
            if (distToCarrier < 180 && this.physics.position.y >= 18 && this.physics.position.y <= 28) {
                if (this.physics.airSpeed < 90) { // Landing speed
                    this.deck.processTrapRecovery(this.physics.fuel, false);
                    this.currentView = 'MACRO_DECK';
                }
            }
        } else {
            soundFX.updateEngine(0, false);
            soundFX.setRWRState('SILENT');
        }
    }

    private draw() {
        this.renderer.clear();

        if (this.currentView === 'MICRO_FLIGHT') {
            this.drawCockpitSim();
        } else {
            this.drawMacroDeck();
        }
    }

    private drawCockpitSim() {
        const camPos = this.physics.position;
        const camPitch = this.physics.pitch;
        const camYaw = this.physics.yaw;
        const camRoll = this.physics.roll;

        // 1. Render Aircraft Carrier in the ocean at origin
        this.renderer.renderMesh(this.carrierMesh, { x: 0, y: 0, z: 0 }, 0, camPos, camPitch, camYaw, camRoll);

        // 2. Render Procedural Wireframe Canyon Terrain
        this.terrain.render(this.renderer, camPos, camPitch, camYaw, camRoll);

        // 3. Render Ground SAM Sites
        for (const sam of this.sensors.samSites) {
            this.renderer.renderMesh(this.samMesh, sam.position, 0, camPos, camPitch, camYaw, camRoll, '#ff4422');

            // Render SAM missile in flight if active
            if (sam.missileActive && sam.missilePos && sam.missileVel) {
                const tail: Vector3 = {
                    x: sam.missilePos.x - (sam.missileVel.x / 480) * 8,
                    y: sam.missilePos.y - (sam.missileVel.y / 480) * 8,
                    z: sam.missilePos.z - (sam.missileVel.z / 480) * 8
                };
                this.renderer.drawLine(tail, sam.missilePos, camPos, camPitch, camYaw, camRoll, '#ff1111', 2.8);
            }
        }

        // 4. Render Airborne Targets (MiG-23s, Tu-22)
        for (const target of this.airborneTargets) {
            if (!target.isAlive) continue;
            const mesh = target.id.startsWith('MIG') ? this.mig23Mesh : this.bomberMesh;
            const targetYaw = Math.atan2(target.velocity.x, target.velocity.z);
            this.renderer.renderMesh(mesh, target.position, targetYaw, camPos, camPitch, camYaw, camRoll);
        }

        // 5. Render Weapons (Tracers, Sidewinder missiles, Bombs, Explosions)
        this.weapons.render(this.renderer, camPos, camPitch, camYaw, camRoll);

        // 6. Cockpit HUD Overlay
        this.hud.draw(
            this.ctx,
            this.physics,
            this.sensors,
            this.airborneTargets,
            this.selectedWeapon,
            this.renderer
        );
    }

    private drawMacroDeck() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        ctx.fillStyle = '#00ff66';
        ctx.strokeStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 4;
        ctx.font = '14px monospace';

        // Title Header
        ctx.font = 'bold 20px monospace';
        ctx.fillText('CV-68 USS NIMITZ // TACTICAL FLIGHT DECK LOGISTICS', 40, 45);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, 55);
        ctx.lineTo(w - 40, 55);
        ctx.stroke();

        // 1. Carrier Status Panel (Left)
        ctx.font = 'bold 15px monospace';
        ctx.fillText('STRIKE GROUP STATUS', 50, 90);
        ctx.font = '13px monospace';
        ctx.fillText(`HULL INTEGRITY:    ${this.deck.inventory.carrierHealth}%`, 50, 115);
        ctx.fillText(`SPARE AIRFRAMES:   ${this.deck.inventory.spareAirframes} F/A-18C`, 50, 135);
        ctx.fillText(`JP-5 AVIATION FUEL:${this.deck.inventory.fuelLiters.toLocaleString()} L`, 50, 155);
        ctx.fillText(`20MM VULCAN AMMO:  ${this.deck.inventory.vulcanRounds.toLocaleString()} RDS`, 50, 175);
        ctx.fillText(`AIM-9L SIDEWINDERS:${this.deck.inventory.sidewinders} UNITS`, 50, 195);
        ctx.fillText(`MK.82 500LB BOMBS: ${this.deck.inventory.ironBombs} UNITS`, 50, 215);

        // 2. Flight Deck Aircraft State Machine (Center)
        ctx.font = 'bold 15px monospace';
        ctx.fillText('AIRCRAFT TURNAROUND QUEUE', 420, 90);

        ctx.strokeRect(420, 105, 340, 125);
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`STATE: ${this.deck.aircraftState}`, 440, 135);

        // Task progress bar
        ctx.font = '12px monospace';
        ctx.fillText(`TASK PROGRESS: ${Math.floor(this.deck.currentTaskProgress)}%`, 440, 165);
        ctx.strokeRect(440, 175, 300, 18);
        ctx.fillRect(442, 177, (296 * this.deck.currentTaskProgress) / 100, 14);

        if (this.deck.aircraftState === 'CATAPULT_READY') {
            ctx.fillStyle = '#ffff33';
            ctx.shadowColor = '#ffff33';
            ctx.font = 'bold 15px monospace';
            ctx.fillText('READY ON CAT NO.1 -> PRESS [ENTER] TO LAUNCH', 430, 255);
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
        }

        // 3. Deck Crew Stamina Meters
        ctx.font = 'bold 15px monospace';
        ctx.fillText('DECK CREW WORKFORCE & STAMINA', 50, 260);
        let crewY = 285;
        for (const crew of this.deck.crews) {
            ctx.font = '13px monospace';
            ctx.fillText(`${crew.name} (${crew.role}):`, 50, crewY);

            // Stamina bar
            ctx.strokeRect(260, crewY - 12, 120, 14);
            ctx.fillRect(262, crewY - 10, (116 * crew.stamina) / 100, 10);
            ctx.fillText(`${Math.floor(crew.stamina)}%`, 390, crewY);
            crewY += 25;
        }

        // 4. Dynamic Threat Timeline (Right)
        ctx.font = 'bold 15px monospace';
        ctx.fillText('MACRO RADAR EARLY WARNING TIMELINE', 800, 90);

        let threatY = 120;
        for (const pkg of this.deck.strikeTimeline) {
            ctx.strokeRect(800, threatY - 16, w - 840, 52);
            if (pkg.isIntercepted) {
                ctx.fillStyle = '#008833';
                ctx.fillText(`[SPLASHED] ${pkg.description}`, 815, threatY + 4);
                ctx.fillText(`STATUS: INTERCEPTED & NEUTRALIZED`, 815, threatY + 24);
                ctx.fillStyle = '#00ff66';
            } else if (pkg.hasAttacked) {
                ctx.fillStyle = '#ff2222';
                ctx.fillText(`[HOSTILE HIT] ${pkg.description}`, 815, threatY + 4);
                ctx.fillText(`PENETRATED DEFENSE - STRUCK FLIGHT DECK!`, 815, threatY + 24);
                ctx.fillStyle = '#00ff66';
            } else {
                const isUrgent = pkg.etaSeconds <= 120;
                if (isUrgent) {
                    ctx.fillStyle = '#ff3333';
                    ctx.shadowColor = '#ff3333';
                }
                ctx.fillText(`${pkg.description} (BRG ${pkg.bearingDeg}°)` , 815, threatY + 4);
                ctx.fillText(`ETA: ${Math.max(0, Math.floor(pkg.etaSeconds))} SECONDS`, 815, threatY + 24);
                ctx.fillStyle = '#00ff66';
                ctx.shadowColor = '#00ff66';
            }
            threatY += 65;
        }

        // 5. Scramble Alert Klaxon Banner
        if (this.deck.scrambleAlert) {
            ctx.font = 'bold 24px monospace';
            ctx.fillStyle = '#ff1111';
            ctx.shadowColor = '#ff1111';
            if (Math.floor(Date.now() / 250) % 2 === 0) {
                ctx.fillText('>>> GENERAL QUARTERS: SCRAMBLE ALERT <<<', 420, 295);
            }
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
        }

        // 6. Sortie Payload Allocation Controls
        ctx.font = 'bold 15px monospace';
        ctx.fillText('NEXT SORTIE PAYLOAD ALLOCATION', 420, 335);
        ctx.font = '13px monospace';
        ctx.fillText(`[1/2] FUEL: ${this.deck.plannedFuel} L`, 420, 360);
        ctx.fillText(`[3]   AIM-9 SIDEWINDERS: ${this.deck.plannedLoadout.sidewinders} / 6`, 420, 380);
        ctx.fillText(`[4]   MK.82 IRON BOMBS:  ${this.deck.plannedLoadout.ironBombs} / 4`, 420, 400);

        // 7. Tactical Comm Log (Bottom)
        ctx.font = 'bold 14px monospace';
        ctx.fillText('TACTICAL LOG & TELEMETRY STREAM', 50, 440);
        ctx.strokeRect(50, 450, w - 100, 130);
        ctx.font = '12px monospace';
        let logY = 472;
        for (const entry of this.deck.alertLog) {
            ctx.fillText(entry, 65, logY);
            logY += 15;
        }

        // Bottom instruction bar
        ctx.font = 'bold 14px monospace';
        ctx.fillText('[TAB] Toggle Flight/Deck View | [ENTER] Launch Catapult | [1-4] Modify Payload | [SPACE] Combat Fire', 50, h - 25);

        ctx.restore();
    }
}
