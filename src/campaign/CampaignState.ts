/**
 * CARRIER VECTOR: 1988 - Persistent Rogue-lite Fleet Campaign
 *
 * Implements the strategic meta-loop:
 * - Persistent carrier strike group logistics (finite F-14 & A-6 airframes, fuel, ordnance)
 * - 7 interconnected operational sectors in the Norwegian Sea theater
 * - Strategic cause-and-effect: destroying Early Warning Radar nodes reduces SAM threat
 *   in adjacent sectors by 40%
 * - Permanent consequences: lost aircraft and spent munitions persist across sorties.
 *
 * 100% pure TypeScript state machine, zero dependencies, 100% headless testable.
 */

export interface AirframeInventory {
    f14Tomcat: number;
    a6Intruder: number;
}

export interface OrdnanceInventory {
    aim9Sidewinder: number;
    aim7Sparrow: number;
    gbu12LGB: number;
    mk82IronBomb: number;
}

export interface FleetState {
    airframes: AirframeInventory;
    ordnance: OrdnanceInventory;
    fuelReserveLitres: number;
    carrierHealth: number; // 0 - 100
    currentSectorId: string;
}

export interface SectorNode {
    id: string;
    name: string;
    connections: string[];
    hasEarlyWarningRadar: boolean;
    baseSamThreat: number;      // 0.0 - 1.0
    effectiveSamThreat: number; // dynamically computed based on radar network
    isSecured: boolean;
}

export interface SortieResult {
    sectorId: string;
    victory: boolean;
    airframesLost?: Partial<AirframeInventory>;
    ordnanceExpended?: Partial<OrdnanceInventory>;
    fuelConsumedLitres?: number;
    bombersLeaked?: number;
    radarDestroyed?: boolean;
}

export const INITIAL_FLEET: FleetState = {
    airframes: {
        f14Tomcat: 24,
        a6Intruder: 12
    },
    ordnance: {
        aim9Sidewinder: 96,
        aim7Sparrow: 48,
        gbu12LGB: 36,
        mk82IronBomb: 72
    },
    fuelReserveLitres: 120_000,
    carrierHealth: 100,
    currentSectorId: 'GIUK_GAP'
};

export const CAMPAIGN_SECTORS: SectorNode[] = [
    {
        id: 'GIUK_GAP',
        name: 'GIUK Gap Staging Ground',
        connections: ['VESTFJORDEN', 'JAN_MAYEN'],
        hasEarlyWarningRadar: false,
        baseSamThreat: 0.1,
        effectiveSamThreat: 0.1,
        isSecured: true
    },
    {
        id: 'VESTFJORDEN',
        name: 'Vestfjorden Coastal Ingress',
        connections: ['GIUK_GAP', 'LOFOTEN_BASIN'],
        hasEarlyWarningRadar: true,
        baseSamThreat: 0.6,
        effectiveSamThreat: 0.6,
        isSecured: false
    },
    {
        id: 'JAN_MAYEN',
        name: 'Jan Mayen Surveillance Belt',
        connections: ['GIUK_GAP', 'LOFOTEN_BASIN', 'BEAR_ISLAND'],
        hasEarlyWarningRadar: true,
        baseSamThreat: 0.4,
        effectiveSamThreat: 0.4,
        isSecured: false
    },
    {
        id: 'LOFOTEN_BASIN',
        name: 'Lofoten Deep Fjord Network',
        connections: ['VESTFJORDEN', 'JAN_MAYEN', 'NORTH_CAPE'],
        hasEarlyWarningRadar: true,
        baseSamThreat: 0.8,
        effectiveSamThreat: 0.8,
        isSecured: false
    },
    {
        id: 'BEAR_ISLAND',
        name: 'Bear Island Outpost',
        connections: ['JAN_MAYEN', 'BARENTS_APPROACH'],
        hasEarlyWarningRadar: true,
        baseSamThreat: 0.5,
        effectiveSamThreat: 0.5,
        isSecured: false
    },
    {
        id: 'NORTH_CAPE',
        name: 'North Cape Fortress',
        connections: ['LOFOTEN_BASIN', 'BARENTS_APPROACH'],
        hasEarlyWarningRadar: true,
        baseSamThreat: 0.9,
        effectiveSamThreat: 0.9,
        isSecured: false
    },
    {
        id: 'BARENTS_APPROACH',
        name: 'Barents Sea Bastion',
        connections: ['BEAR_ISLAND', 'NORTH_CAPE'],
        hasEarlyWarningRadar: true,
        baseSamThreat: 1.0,
        effectiveSamThreat: 1.0,
        isSecured: false
    }
];

export class CampaignManager {
    public fleet: FleetState;
    public sectors: Map<string, SectorNode> = new Map();

    constructor(initialFleet?: FleetState, initialSectors?: SectorNode[]) {
        this.fleet = initialFleet ? JSON.parse(JSON.stringify(initialFleet)) : JSON.parse(JSON.stringify(INITIAL_FLEET));
        const sectorList = initialSectors ?? CAMPAIGN_SECTORS;
        for (const s of sectorList) {
            this.sectors.set(s.id, { ...s });
        }
        this.calculateEffectiveThreats();
    }

    /**
     * Recompute effective SAM threat across sectors.
     * Rule: If an adjacent sector has an operational Early Warning Radar,
     * it coordinates air defense. If all adjacent radars are knocked out,
     * SAM threat is reduced by 40%.
     */
    public calculateEffectiveThreats(): void {
        for (const sector of this.sectors.values()) {
            if (sector.isSecured) {
                sector.effectiveSamThreat = 0;
                continue;
            }

            // Check if any adjacent sector has an active Early Warning Radar
            const hasAdjacentActiveRadar = sector.connections.some(connId => {
                const conn = this.sectors.get(connId);
                return conn && conn.hasEarlyWarningRadar;
            });

            // If sector has no local radar and no adjacent radar assistance, reduce by 40%
            if (!sector.hasEarlyWarningRadar && !hasAdjacentActiveRadar) {
                sector.effectiveSamThreat = sector.baseSamThreat * 0.6;
            } else if (!sector.hasEarlyWarningRadar && hasAdjacentActiveRadar) {
                sector.effectiveSamThreat = sector.baseSamThreat * 0.85;
            } else {
                sector.effectiveSamThreat = sector.baseSamThreat;
            }
        }
    }

    /** Move fleet carrier strike group to connected sector */
    public travelToSector(targetSectorId: string): boolean {
        const current = this.sectors.get(this.fleet.currentSectorId);
        if (!current || !current.connections.includes(targetSectorId)) {
            return false;
        }

        // Steaming consumption (5,000 litres JP-5 bunker fuel)
        if (this.fleet.fuelReserveLitres < 5000) {
            return false;
        }
        this.fleet.fuelReserveLitres -= 5000;
        this.fleet.currentSectorId = targetSectorId;
        return true;
    }

    /**
     * Deterministically record sortie results into persistent campaign state.
     */
    public recordSortieOutcome(result: SortieResult): void {
        const sector = this.sectors.get(result.sectorId);
        if (!sector) return;

        // 1. Airframe attrition
        if (result.airframesLost) {
            if (result.airframesLost.f14Tomcat) {
                this.fleet.airframes.f14Tomcat = Math.max(
                    0,
                    this.fleet.airframes.f14Tomcat - result.airframesLost.f14Tomcat
                );
            }
            if (result.airframesLost.a6Intruder) {
                this.fleet.airframes.a6Intruder = Math.max(
                    0,
                    this.fleet.airframes.a6Intruder - result.airframesLost.a6Intruder
                );
            }
        }

        // 2. Munitions expenditure
        if (result.ordnanceExpended) {
            for (const [key, qty] of Object.entries(result.ordnanceExpended)) {
                const k = key as keyof OrdnanceInventory;
                if (typeof qty === 'number') {
                    this.fleet.ordnance[k] = Math.max(0, this.fleet.ordnance[k] - qty);
                }
            }
        }

        // 3. Aviation fuel
        if (result.fuelConsumedLitres) {
            this.fleet.fuelReserveLitres = Math.max(
                0,
                this.fleet.fuelReserveLitres - result.fuelConsumedLitres
            );
        }

        // 4. Carrier damage from leaking bombers (10% per unintercepted bomber)
        if (result.bombersLeaked && result.bombersLeaked > 0) {
            const damage = result.bombersLeaked * 10;
            this.fleet.carrierHealth = Math.max(0, this.fleet.carrierHealth - damage);
        }

        // 5. Radar destruction in sector
        if (result.radarDestroyed) {
            sector.hasEarlyWarningRadar = false;
        }

        // 6. Sector victory / capture
        if (result.victory) {
            sector.isSecured = true;
        }

        // Recalculate dynamic threat network
        this.calculateEffectiveThreats();
    }

    public isDefeated(): boolean {
        return (
            this.fleet.carrierHealth <= 0 ||
            (this.fleet.airframes.f14Tomcat <= 0 && this.fleet.airframes.a6Intruder <= 0) ||
            this.fleet.fuelReserveLitres <= 0
        );
    }

    public isCampaignWon(): boolean {
        const bastion = this.sectors.get('BARENTS_APPROACH');
        return bastion !== undefined && bastion.isSecured;
    }
}
