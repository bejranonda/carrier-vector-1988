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

import { AircraftPhysics } from '../flight/AircraftPhysics';
import type { Vector3 } from '../flight/AircraftPhysics';
import { SensorTacticsManager } from '../tactics/RadarLOS';
import { VectorRenderer } from './VectorRenderer';

export interface AirborneTarget {
    id: string;
    name: string;
    position: Vector3;
    velocity: Vector3;
    isAlive: boolean;
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
        renderer: VectorRenderer
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
        this.drawFlightPathMarker(ctx, physics, cx, cy);

        // 3. Pitch Ladder (rotates with roll, translates with pitch)
        this.drawPitchLadder(ctx, physics, cx, cy);

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

        ctx.restore();
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

    private drawFlightPathMarker(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, cx: number, cy: number) {
        const speed = physics.airSpeed;
        if (speed < 5) return;

        // Angle between velocity vector and nose vector
        const right = physics.rightVector;
        const up = physics.upVector;

        const vNorm = {
            x: physics.velocity.x / speed,
            y: physics.velocity.y / speed,
            z: physics.velocity.z / speed
        };

        const pitchOffsetRad = vNorm.x * up.x + vNorm.y * up.y + vNorm.z * up.z;
        const yawOffsetRad = vNorm.x * right.x + vNorm.y * right.y + vNorm.z * right.z;

        const pxPerRad = 520;
        const fpmX = cx + yawOffsetRad * pxPerRad;
        const fpmY = cy - pitchOffsetRad * pxPerRad;

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

    private drawPitchLadder(ctx: CanvasRenderingContext2D, physics: AircraftPhysics, cx: number, cy: number) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-physics.roll);

        const pxPerDegree = 8.5;
        const pitchDeg = physics.pitch * (180 / Math.PI);

        // Ladder spans +/- 40 degrees around current pitch
        const startDeg = Math.floor((pitchDeg - 35) / 5) * 5;
        const endDeg = Math.floor((pitchDeg + 35) / 5) * 5;

        for (let deg = startDeg; deg <= endDeg; deg += 5) {
            if (deg < -85 || deg > 85) continue;
            const yOffset = (pitchDeg - deg) * pxPerDegree;

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
