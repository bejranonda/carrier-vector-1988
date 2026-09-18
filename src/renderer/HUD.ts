/**
 * CARRIER VECTOR: 1988 - Vector Cockpit HUD Overlay
 * Pure vector drawing:
 * - Rotating pitch ladder
 * - Velocity vector (Flight Path Marker)
 * - Altitude tape (MSL & AGL radar altimeter)
 * - Airspeed tape
 * - 360-degree compass heading tape
 * - Target box & 20mm Vulcan lead computing reticle
 * - Radar Warning Receiver (RWR) azimuth display
 * - Weapons status, G-meter, and Terrain Masking annunciator
 */

import type { AircraftPhysics, Vector3 } from '../flight/AircraftPhysics';
import type { SensorTacticsManager } from '../tactics/RadarLOS';
import type { VectorRenderer } from './VectorRenderer';
import type { Hint } from '../core/Tutorial';
import type { ScoreKeeper } from '../core/ScoreKeeper';

export interface AirborneTarget {
    id: string;
    name: string;
    position: Vector3;
    velocity: Vector3;
    isAlive: boolean;

    /**
     * Visual orientation, derived from the velocity vector by EnemyAI so
     * wireframe models bank and pitch into their manoeuvres. Optional and
     * defaulted to 0 by the renderer, so plain target literals still work.
     */
    pitch?: number;
    roll?: number;
    yaw?: number;

    /** Enemy AI state, stored on the contact itself to avoid a parallel map. */
    aiBehavior?: 'INGRESS' | 'ENGAGE' | 'RTB';
    aiFireCooldown?: number;
    aiTurnDemand?: number;
}

export class HUD {
    public width: number;
    public height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public draw(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        targets: AirborneTarget[],
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB',
        renderer: VectorRenderer,
        hint?: Hint | null,
        score?: ScoreKeeper
    ) {
        const cx = this.width / 2;
        const cy = this.height / 2;

        ctx.save();
        ctx.strokeStyle = '#00ff66';
        ctx.fillStyle = '#00ff66';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 4;
        ctx.font = '14px monospace';

        // 1. Waterline Bore Sight (+W symbol at center)
        this.drawWaterline(ctx, cx, cy);

        // 2. Flight Path Marker (Velocity Vector)
        this.drawFlightPathMarker(ctx, physics, renderer);

        // 3. Pitch Ladder (rotates with roll, translates with pitch)
        this.drawPitchLadder(ctx, physics, renderer, cx, cy);

        // 4. Compass Heading Tape (at top)
        this.drawCompassTape(ctx, physics, cx);

        // 5. Airspeed Tape (Left) & Altitude Tape (Right)
        this.drawSpeedAndAltitudeTapes(ctx, physics, sensors, cx, cy);

        // 6. Target Box & Cannon Lead Reticle
        this.drawCombatReticles(ctx, physics, targets, selectedWeapon, renderer);

        // 7. Radar Warning Receiver (RWR) Dial (Bottom-right)
        this.drawRWR(ctx, sensors);

        // 8. Annunciator Panel (Bottom-left & center warnings)
        this.drawAnnunciatorPanel(ctx, physics, sensors, selectedWeapon);

        // 9. Carrier approach aids (meatball / AoA indexer / lineup)
        this.drawLandingAids(ctx, physics, cx, cy);

        // 10. Contextual coach ticker
        if (hint) this.drawCoachTicker(ctx, hint, cx);

        // 11. Score readout
        if (score) {
            ctx.textAlign = 'right';
            ctx.font = '12px monospace';
            ctx.fillStyle = '#00aa44';
            ctx.shadowColor = '#00aa44';
            ctx.fillText(`SCORE ${score.totalScore}  ${score.rank}`, this.width - 30, 26);
            ctx.textAlign = 'left';
        }

        ctx.restore();
    }

    /**
     * Fresnel lens "meatball" glideslope, AoA approach indexer and deck
     * lineup cue. Only shown on approach - landing was previously a blind
     * guess at a 180m / 18-28m / sub-90 m/s envelope with no visual aid.
     */
    private drawLandingAids(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, cx: number, cy: number) {
        const rangeToShip = Math.hypot(physics.position.x, physics.position.z);
        if (rangeToShip > 3000 || physics.position.y > 400) return;

        const DECK_Y = 20;
        const GLIDESLOPE_RAD = 3.5 * (Math.PI / 180);
        const desiredAlt = DECK_Y + Math.tan(GLIDESLOPE_RAD) * rangeToShip;
        const error = physics.position.y - desiredAlt;

        // --- Meatball: 5 cells, datum bars either side ---
        const ballX = cx - 210;
        const ballY = cy;
        const cell = 17;
        const index = Math.max(-2, Math.min(2, Math.round(error / 6)));

        ctx.strokeStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.lineWidth = 2;
        // Datum bars
        ctx.beginPath();
        ctx.moveTo(ballX - 26, ballY); ctx.lineTo(ballX - 11, ballY);
        ctx.moveTo(ballX + 11, ballY); ctx.lineTo(ballX + 26, ballY);
        ctx.stroke();

        // Cell track
        ctx.globalAlpha = 0.3;
        ctx.strokeRect(ballX - 9, ballY - cell * 2.5, 18, cell * 5);
        ctx.globalAlpha = 1;

        // The ball itself: high = above glideslope, low = red (dangerous)
        const ballCy = ballY - index * cell;
        const low = index <= -2;
        ctx.fillStyle = low ? '#ff3333' : '#ffff33';
        ctx.shadowColor = low ? '#ff3333' : '#ffff33';
        ctx.beginPath();
        ctx.arc(ballX, ballCy, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '10px monospace';
        ctx.fillStyle = '#00aa44';
        ctx.shadowColor = '#00aa44';
        ctx.textAlign = 'center';
        ctx.fillText('BALL', ballX, ballY + cell * 3 + 6);
        ctx.textAlign = 'left';

        // --- AoA approach indexer (carrier-standard 3 symbols) ---
        const idxX = cx - 150;
        const alphaDeg = physics.alpha * (180 / Math.PI);
        const onSpeed = Math.abs(alphaDeg - 8.1) <= 1.2;
        const fast = alphaDeg < 8.1 - 1.2;

        ctx.lineWidth = 2;
        // Fast chevron (pointing down)
        ctx.strokeStyle = fast ? '#ffaa00' : '#003311';
        ctx.shadowColor = fast ? '#ffaa00' : '#003311';
        ctx.beginPath();
        ctx.moveTo(idxX - 8, cy - 26); ctx.lineTo(idxX, cy - 18); ctx.lineTo(idxX + 8, cy - 26);
        ctx.stroke();
        // On-speed circle
        ctx.strokeStyle = onSpeed ? '#00ff66' : '#003311';
        ctx.shadowColor = onSpeed ? '#00ff66' : '#003311';
        ctx.beginPath();
        ctx.arc(idxX, cy, 8, 0, Math.PI * 2);
        ctx.stroke();
        // Slow chevron (pointing up)
        const slow = alphaDeg > 8.1 + 1.2;
        ctx.strokeStyle = slow ? '#ff3333' : '#003311';
        ctx.shadowColor = slow ? '#ff3333' : '#003311';
        ctx.beginPath();
        ctx.moveTo(idxX - 8, cy + 26); ctx.lineTo(idxX, cy + 18); ctx.lineTo(idxX + 8, cy + 26);
        ctx.stroke();

        // --- Approach data block ---
        ctx.font = '12px monospace';
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.textAlign = 'center';
        ctx.fillText(
            `CALL THE BALL   RNG ${(rangeToShip / 1000).toFixed(1)}KM   ALT ${Math.round(physics.position.y)}M   ${Math.round(physics.airSpeed)}M/S`,
            cx,
            this.height - 150
        );
        ctx.textAlign = 'left';
    }

    /** Single-channel contextual coaching line. */
    private drawCoachTicker(ctx: CanvasRenderingContext2D, hint: Hint, cx: number) {
        const color = hint.severity === 'CRITICAL' ? '#ff3333'
            : hint.severity === 'WARNING' ? '#ffaa00'
                : '#00ff66';

        // Critical cues blink so they can't be tuned out.
        if (hint.severity === 'CRITICAL' && Math.floor(Date.now() / 250) % 2 !== 0) return;

        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(hint.text).width;

        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(cx - textW / 2 - 14, 92, textW + 28, 26);
        ctx.globalAlpha = 1;

        ctx.fillStyle = color;
        ctx.fillText(hint.text, cx, 110);
        ctx.textAlign = 'left';
    }

    private drawWaterline(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        ctx.beginPath();
        // Left wing
        ctx.moveTo(cx - 30, cy);
        ctx.lineTo(cx - 10, cy);
        ctx.lineTo(cx - 10, cy + 6);
        // Center dot
        ctx.moveTo(cx - 2, cy);
        ctx.lineTo(cx + 2, cy);
        // Right wing
        ctx.moveTo(cx + 10, cy + 6);
        ctx.lineTo(cx + 10, cy);
        ctx.lineTo(cx + 30, cy);
        ctx.stroke();
    }

    private drawFlightPathMarker(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        renderer: VectorRenderer
    ) {
        const speed = physics.airSpeed;
        if (speed < 5) return;

        const vNorm = {
            x: physics.velocity.x / speed,
            y: physics.velocity.y / speed,
            z: physics.velocity.z / speed
        };

        // Project a point far along the actual velocity vector through the
        // SAME camera pipeline the 3D world uses (transformToCamera +
        // projectCameraPoint), instead of the old small-angle approximation
        // (dot products with up/right treated directly as radians, scaled
        // by a hand-tuned pxPerRad=520 that didn't match the renderer's
        // fov=380). That mismatch meant the FPM never actually sat on the
        // real flight path in the 3D scene. This way it always does, by
        // construction - it's the same math used for target reticles.
        const probe: Vector3 = {
            x: physics.position.x + vNorm.x * 5000,
            y: physics.position.y + vNorm.y * 5000,
            z: physics.position.z + vNorm.z * 5000
        };
        const camPt = renderer.transformToCamera(probe, physics.position, physics.pitch, physics.yaw, physics.roll);
        if (camPt.z < renderer.nearPlane) return; // velocity vector points behind the canopy

        const proj = renderer.projectCameraPoint(camPt);
        const fpmX = proj.x;
        const fpmY = proj.y;

        // Circle with wings and fin
        ctx.beginPath();
        ctx.arc(fpmX, fpmY, 8, 0, Math.PI * 2);
        // Left fin
        ctx.moveTo(fpmX - 8, fpmY);
        ctx.lineTo(fpmX - 18, fpmY);
        // Right fin
        ctx.moveTo(fpmX + 8, fpmY);
        ctx.lineTo(fpmX + 18, fpmY);
        // Top fin
        ctx.moveTo(fpmX, fpmY - 8);
        ctx.lineTo(fpmX, fpmY - 14);
        ctx.stroke();
    }

    private drawPitchLadder(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, renderer: VectorRenderer, cx: number, cy: number) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-physics.roll);

        const pitchDeg = physics.pitch * (180 / Math.PI);

        // Ladder spans +/- 40 degrees around current pitch
        const startDeg = Math.floor((pitchDeg - 35) / 5) * 5;
        const endDeg = Math.floor((pitchDeg + 35) / 5) * 5;

        for (let deg = startDeg; deg <= endDeg; deg += 5) {
            if (deg < -85 || deg > 85) continue;

            // Exact projection instead of a hand-tuned px/degree constant:
            // a world ray at angular depression delta from boresight
            // projects to fov*tan(delta) pixels from screen center (derived
            // from the same perspective-divide formula VectorRenderer uses
            // for every other point in the scene). This makes each rung
            // land exactly on the corresponding point of the real 3D
            // horizon/terrain instead of being ~28% too large, as the old
            // hardcoded 8.5 px/degree (~487 px/rad) was versus the
            // renderer's actual fov=380.
            const deltaRad = (pitchDeg - deg) * (Math.PI / 180);
            if (Math.abs(deltaRad) > 1.45) continue; // tan() blows up near +/-90 deg
            const yOffset = renderer.fov * Math.tan(deltaRad);

            if (deg === 0) {
                // Horizon line (Long solid)
                ctx.beginPath();
                ctx.lineWidth = 2.0;
                ctx.moveTo(-160, yOffset);
                ctx.lineTo(-40, yOffset);
                ctx.moveTo(40, yOffset);
                ctx.lineTo(160, yOffset);
                ctx.stroke();
                ctx.fillText('00', -185, yOffset + 5);
                ctx.fillText('00', 165, yOffset + 5);
            } else if (deg > 0) {
                // Positive pitch: Solid line with downward ticks
                ctx.beginPath();
                ctx.lineWidth = 1.4;
                const halfW = deg % 10 === 0 ? 50 : 32;
                ctx.moveTo(-halfW - 30, yOffset);
                ctx.lineTo(-30, yOffset);
                ctx.lineTo(-30, yOffset + 8);

                ctx.moveTo(halfW + 30, yOffset);
                ctx.lineTo(30, yOffset);
                ctx.lineTo(30, yOffset + 8);
                ctx.stroke();

                if (deg % 10 === 0) {
                    const text = deg.toString().padStart(2, '0');
                    ctx.fillText(text, -halfW - 55, yOffset + 5);
                    ctx.fillText(text, halfW + 36, yOffset + 5);
                }
            } else {
                // Negative pitch: Dashed line with upward ticks
                ctx.save();
                ctx.setLineDash([6, 5]);
                ctx.lineWidth = 1.4;
                const halfW = deg % 10 === 0 ? 50 : 32;
                ctx.beginPath();
                ctx.moveTo(-halfW - 30, yOffset);
                ctx.lineTo(-30, yOffset);
                ctx.moveTo(halfW + 30, yOffset);
                ctx.lineTo(30, yOffset);
                ctx.stroke();
                ctx.restore();

                // Solid ticks pointing up
                ctx.beginPath();
                ctx.moveTo(-30, yOffset);
                ctx.lineTo(-30, yOffset - 8);
                ctx.moveTo(30, yOffset);
                ctx.lineTo(30, yOffset - 8);
                ctx.stroke();

                if (deg % 10 === 0) {
                    const text = Math.abs(deg).toString().padStart(2, '0');
                    ctx.fillText(text, -halfW - 55, yOffset + 5);
                    ctx.fillText(text, halfW + 36, yOffset + 5);
                }
            }
        }

        ctx.restore();
    }

    private drawCompassTape(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, cx: number) {
        const topY = 45;
        const tapeWidth = 360;
        const pxPerDegree = 4.0;

        let headingDeg = (physics.yaw * (180 / Math.PI)) % 360;
        if (headingDeg < 0) headingDeg += 360;

        // Bounding tape line
        ctx.beginPath();
        ctx.moveTo(cx - tapeWidth / 2, topY);
        ctx.lineTo(cx + tapeWidth / 2, topY);
        // Center lubber line
        ctx.moveTo(cx, topY);
        ctx.lineTo(cx, topY + 12);
        ctx.moveTo(cx - 6, topY + 14);
        ctx.lineTo(cx + 6, topY + 14);
        ctx.lineTo(cx, topY + 8);
        ctx.closePath();
        ctx.stroke();

        // Draw compass marks
        const minHeading = headingDeg - (tapeWidth / 2) / pxPerDegree;
        const maxHeading = headingDeg + (tapeWidth / 2) / pxPerDegree;

        const startH = Math.floor(minHeading / 5) * 5;
        const endH = Math.ceil(maxHeading / 5) * 5;

        for (let h = startH; h <= endH; h += 5) {
            let normH = ((h % 360) + 360) % 360;
            const xOffset = cx + (h - headingDeg) * pxPerDegree;

            if (xOffset < cx - tapeWidth / 2 || xOffset > cx + tapeWidth / 2) continue;

            if (normH % 10 === 0) {
                // Major tick
                ctx.beginPath();
                ctx.moveTo(xOffset, topY);
                ctx.lineTo(xOffset, topY - 8);
                ctx.stroke();

                // Cardinal letters or numbers
                let label = (normH / 10).toString().padStart(2, '0');
                if (normH === 0) label = 'N';
                else if (normH === 90) label = 'E';
                else if (normH === 180) label = 'S';
                else if (normH === 270) label = 'W';

                ctx.textAlign = 'center';
                ctx.fillText(label, xOffset, topY - 12);
            } else {
                // Minor tick
                ctx.beginPath();
                ctx.moveTo(xOffset, topY);
                ctx.lineTo(xOffset, topY - 4);
                ctx.stroke();
            }
        }
    }

    private drawSpeedAndAltitudeTapes(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        cx: number,
        cy: number
    ) {
        // Airspeed in knots (1 m/s ~ 1.94384 knots)
        const knots = Math.floor(physics.airSpeed * 1.94384);
        const altMsl = Math.floor(physics.position.y * 3.28084); // feet
        const terrainAltMsl = Math.floor(sensors.terrain.getElevation(physics.position.x, physics.position.z) * 3.28084);
        const altAgl = Math.max(0, altMsl - terrainAltMsl);

        // Airspeed Box (Left)
        const leftX = cx - 260;
        ctx.strokeRect(leftX - 35, cy - 18, 70, 36);
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`${knots}`, leftX, cy + 6);
        ctx.font = '12px monospace';
        ctx.fillText('KTS', leftX, cy - 24);

        // Mach number
        const mach = (physics.airSpeed / 340).toFixed(2);
        ctx.fillText(`M ${mach}`, leftX, cy + 36);

        // Altitude Box (Right)
        const rightX = cx + 260;
        ctx.strokeRect(rightX - 45, cy - 18, 90, 36);
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`${altMsl}`, rightX, cy + 6);
        ctx.font = '12px monospace';
        ctx.fillText('MSL FT', rightX, cy - 24);

        // Radar Altimeter (AGL)
        ctx.font = '13px monospace';
        if (altAgl < 1500) {
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ffaa00';
        }
        ctx.fillText(`R: ${altAgl} AGL`, rightX, cy + 36);
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
    }

    private drawCombatReticles(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        targets: AirborneTarget[],
        _selectedWeapon: 'GUN' | 'AIM9' | 'BOMB',
        renderer: VectorRenderer
    ) {
        const bulletSpeed = 1050; // m/s for 20mm Vulcan M61A1

        for (const target of targets) {
            if (!target.isAlive) continue;

            // Distance to target
            const dx = target.position.x - physics.position.x;
            const dy = target.position.y - physics.position.y;
            const dz = target.position.z - physics.position.z;
            const dist = Math.hypot(dx, dy, dz);

            if (dist > 7000) continue;

            // Transform target position to camera space
            const camPt = renderer.transformToCamera(
                target.position,
                physics.position,
                physics.pitch,
                physics.yaw,
                physics.roll
            );

            if (camPt.z < 2.0) continue; // Behind player

            const proj = renderer.projectCameraPoint(camPt);

            // Draw target box (square with diamond)
            const boxSize = Math.max(16, Math.min(60, 24000 / dist));
            ctx.strokeStyle = '#ff3333';
            ctx.shadowColor = '#ff3333';
            ctx.strokeRect(proj.x - boxSize / 2, proj.y - boxSize / 2, boxSize, boxSize);

            ctx.font = '11px monospace';
            ctx.fillStyle = '#ff3333';
            ctx.fillText(`${target.name}`, proj.x + boxSize / 2 + 4, proj.y - 4);
            ctx.fillText(`${(dist / 1000).toFixed(1)}KM`, proj.x + boxSize / 2 + 4, proj.y + 10);

            // Compute Gun Lead Reticle
            const timeToImpact = dist / bulletSpeed;
            const leadWorldPos: Vector3 = {
                x: target.position.x + target.velocity.x * timeToImpact,
                y: target.position.y + target.velocity.y * timeToImpact - 0.5 * 9.81 * (timeToImpact ** 2),
                z: target.position.z + target.velocity.z * timeToImpact
            };

            const leadCamPt = renderer.transformToCamera(
                leadWorldPos,
                physics.position,
                physics.pitch,
                physics.yaw,
                physics.roll
            );

            if (leadCamPt.z >= 2.0) {
                const leadProj = renderer.projectCameraPoint(leadCamPt);

                // Draw Lead Computing Pipper (Circle with center dot)
                ctx.beginPath();
                ctx.arc(leadProj.x, leadProj.y, 14, 0, Math.PI * 2);
                ctx.moveTo(leadProj.x - 4, leadProj.y);
                ctx.lineTo(leadProj.x + 4, leadProj.y);
                ctx.moveTo(leadProj.x, leadProj.y - 4);
                ctx.lineTo(leadProj.x, leadProj.y + 4);
                ctx.stroke();

                // Pipper alignment cue
                const offsetToBore = Math.hypot(leadProj.x - this.width / 2, leadProj.y - this.height / 2);
                if (offsetToBore < 25 && dist < 2200) {
                    ctx.font = 'bold 16px monospace';
                    ctx.fillText('SHOOT', this.width / 2 - 25, this.height / 2 + 60);
                }
            }
        }
    }

    private drawRWR(ctx: CanvasRenderingContext2D, sensors: SensorTacticsManager) {
        const rwrX = this.width - 95;
        const rwrY = this.height - 95;
        const rwrRadius = 60;

        // Outer scope ring
        ctx.strokeStyle = '#00aa44';
        ctx.shadowColor = '#00aa44';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rwrX, rwrY, rwrRadius, 0, Math.PI * 2);
        // Inner ring
        ctx.arc(rwrX, rwrY, rwrRadius * 0.5, 0, Math.PI * 2);
        // Azimuth ticks
        ctx.moveTo(rwrX, rwrY - rwrRadius);
        ctx.lineTo(rwrX, rwrY + rwrRadius);
        ctx.moveTo(rwrX - rwrRadius, rwrY);
        ctx.lineTo(rwrX + rwrRadius, rwrY);
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.fillStyle = '#00ff66';
        ctx.fillText('RWR', rwrX - 10, rwrY - rwrRadius - 6);

        // Plot threat contacts
        for (const threat of sensors.activeThreats) {
            if (threat.state === 'SILENT') continue;

            // Azimuth angle on 2D dial
            const rad = threat.azimuthDeg * (Math.PI / 180);
            const distRatio = Math.min(1.0, threat.distance / 12000);
            const contactR = (0.3 + distRatio * 0.6) * rwrRadius;

            // Heading up (0 deg is top)
            const tx = rwrX + Math.sin(rad) * contactR;
            const ty = rwrY - Math.cos(rad) * contactR;

            if (threat.state === 'LAUNCH') {
                ctx.fillStyle = '#ff2222';
                ctx.shadowColor = '#ff2222';
                ctx.fillText('M', tx - 4, ty + 4);
                // Flashing ring
                ctx.beginPath();
                ctx.arc(tx, ty, 8, 0, Math.PI * 2);
                ctx.stroke();
            } else if (threat.state === 'TRACK') {
                ctx.fillStyle = '#ffaa00';
                ctx.shadowColor = '#ffaa00';
                ctx.fillText('T', tx - 4, ty + 4);
            } else {
                ctx.fillStyle = '#00ff66';
                ctx.shadowColor = '#00ff66';
                ctx.fillText('S', tx - 4, ty + 4);
            }
        }
    }

    private drawAnnunciatorPanel(
        ctx: CanvasRenderingContext2D,
        physics: AircraftPhysics,
        sensors: SensorTacticsManager,
        selectedWeapon: 'GUN' | 'AIM9' | 'BOMB'
    ) {
        const bottomY = this.height - 120;
        const cy = this.height / 2;

        ctx.textAlign = 'left';
        ctx.font = '13px monospace';

        // 1. Engine & G-load
        const throttlePct = Math.floor(physics.throttle * 100);
        ctx.fillText(`THR: ${throttlePct}% ${physics.throttle > 1.0 ? '[AB]' : ''}`, 40, bottomY);
        ctx.fillText(`FUEL: ${Math.floor(physics.fuel)} L`, 40, bottomY + 20);
        ctx.fillText(`G-LOAD: ${physics.gLoad.toFixed(1)} G`, 40, bottomY + 40);

        // 2. Bay Door status
        if (physics.bayOpen) {
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ffaa00';
            ctx.fillText('BAY: OPEN (RCS x4.0)', 40, bottomY + 60);
        } else {
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
            ctx.fillText('BAY: CLOSED', 40, bottomY + 60);
        }

        // 3. Selected Weapon
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        let wpnStr = '';
        if (selectedWeapon === 'GUN') {
            wpnStr = `WPN: 20MM VULCAN [${physics.loadout.vulcanAmmo} RDS]`;
        } else if (selectedWeapon === 'AIM9') {
            wpnStr = `WPN: AIM-9 SIDEWINDER [${physics.loadout.sidewinders}]`;
        } else {
            wpnStr = `WPN: MK.82 IRON BOMB [${physics.loadout.ironBombs}]`;
        }
        ctx.fillText(wpnStr, 40, bottomY + 80);

        // 3b. Battle damage state
        if (physics.damage > 0) {
            const dmgColor = physics.damage > 60 ? '#ff3333' : '#ffaa00';
            ctx.fillStyle = dmgColor;
            ctx.shadowColor = dmgColor;
            ctx.fillText(`DAMAGE: ${Math.round(physics.damage)}%`, 40, bottomY - 20);
            if (physics.fuelLeakRate > 0.5) {
                ctx.fillText(`FUEL LEAK: ${physics.fuelLeakRate.toFixed(1)} L/S`, 40, bottomY - 40);
            }
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
        }

        // 4. Critical Warning Banners
        ctx.textAlign = 'center';
        const cx = this.width / 2;

        if (sensors.masterRwrState === 'LAUNCH') {
            ctx.font = 'bold 20px monospace';
            ctx.fillStyle = '#ff1111';
            ctx.shadowColor = '#ff1111';
            if (Math.floor(Date.now() / 250) % 2 === 0) {
                ctx.fillText('WARNING: MISSILE LAUNCH', cx, 110);
            }
        } else if (sensors.masterRwrState === 'TRACK') {
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ffaa00';
            ctx.fillText('RADAR LOCK DETECTED', cx, 110);
        }

        // Terrain Masked Status
        const sam1 = sensors.activeThreats.find(t => t.id === 'SAM-1');
        if (sam1 && sam1.isTerrainMasked && physics.position.y < 350) {
            ctx.font = '13px monospace';
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
            ctx.fillText('STATUS: TERRAIN MASKED', cx, 135);
        }

        // Stall Warning
        if (physics.isStalled) {
            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = '#ff0000';
            ctx.shadowColor = '#ff0000';
            if (Math.floor(Date.now() / 200) % 2 === 0) {
                ctx.fillText('STALL - RECOVER', cx, cy - 80);
            }
        }
    }
}
