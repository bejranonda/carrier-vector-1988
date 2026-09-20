import { describe, it, expect } from 'vitest';
import { CampaignManager } from './CampaignState';

describe('CampaignManager', () => {
    it('initializes with standard carrier air wing logistics', () => {
        const campaign = new CampaignManager();
        expect(campaign.fleet.airframes.f14Tomcat).toBe(24);
        expect(campaign.fleet.airframes.a6Intruder).toBe(12);
        expect(campaign.fleet.ordnance.aim9Sidewinder).toBe(96);
        expect(campaign.fleet.carrierHealth).toBe(100);
        expect(campaign.fleet.currentSectorId).toBe('GIUK_GAP');
        expect(campaign.sectors.size).toBe(7);
    });

    it('enforces sector map connectivity and bunker fuel during fleet movement', () => {
        const campaign = new CampaignManager();

        // GIUK_GAP connects to VESTFJORDEN and JAN_MAYEN, but NOT directly to NORTH_CAPE
        expect(campaign.travelToSector('NORTH_CAPE')).toBe(false);
        expect(campaign.fleet.currentSectorId).toBe('GIUK_GAP');

        // Valid move to connected sector
        const initialFuel = campaign.fleet.fuelReserveLitres;
        expect(campaign.travelToSector('VESTFJORDEN')).toBe(true);
        expect(campaign.fleet.currentSectorId).toBe('VESTFJORDEN');
        expect(campaign.fleet.fuelReserveLitres).toBe(initialFuel - 5000);
    });

    it('permanently deducts airframes and ordnance expended in sorties', () => {
        const campaign = new CampaignManager();

        campaign.recordSortieOutcome({
            sectorId: 'VESTFJORDEN',
            victory: true,
            airframesLost: { f14Tomcat: 2 },
            ordnanceExpended: { aim9Sidewinder: 4, mk82IronBomb: 2 },
            fuelConsumedLitres: 3200,
            bombersLeaked: 1
        });

        expect(campaign.fleet.airframes.f14Tomcat).toBe(22);
        expect(campaign.fleet.airframes.a6Intruder).toBe(12);
        expect(campaign.fleet.ordnance.aim9Sidewinder).toBe(92);
        expect(campaign.fleet.ordnance.mk82IronBomb).toBe(70);
        expect(campaign.fleet.carrierHealth).toBe(90); // 1 leaked bomber = -10%
    });

    it('reduces adjacent SAM threat by 40% when local radar and assistance are knocked out', () => {
        const campaign = new CampaignManager();
        const vestfjorden = campaign.sectors.get('VESTFJORDEN')!;
        expect(vestfjorden.effectiveSamThreat).toBe(vestfjorden.baseSamThreat);

        // Knock out radar in VESTFJORDEN
        campaign.recordSortieOutcome({
            sectorId: 'VESTFJORDEN',
            victory: false,
            radarDestroyed: true
        });

        // LOFOTEN_BASIN still has radar, so assistance is partially active
        expect(vestfjorden.effectiveSamThreat).toBeLessThan(vestfjorden.baseSamThreat);

        // Now knock out radar in LOFOTEN_BASIN as well (all neighbors without radar)
        campaign.recordSortieOutcome({
            sectorId: 'LOFOTEN_BASIN',
            victory: false,
            radarDestroyed: true
        });

        // GIUK_GAP has no radar, LOFOTEN has no radar -> full 40% reduction (base * 0.6)
        expect(vestfjorden.effectiveSamThreat).toBeCloseTo(vestfjorden.baseSamThreat * 0.6, 2);
    });

    it('detects fleet defeat when carrier is lost or all airframes destroyed', () => {
        const campaign = new CampaignManager();
        expect(campaign.isDefeated()).toBe(false);

        // Sinking carrier
        campaign.fleet.carrierHealth = 0;
        expect(campaign.isDefeated()).toBe(true);

        // Restoring carrier but losing all airframes
        campaign.fleet.carrierHealth = 100;
        campaign.fleet.airframes.f14Tomcat = 0;
        campaign.fleet.airframes.a6Intruder = 0;
        expect(campaign.isDefeated()).toBe(true);
    });

    it('detects campaign victory when Barents Sea Bastion is secured', () => {
        const campaign = new CampaignManager();
        expect(campaign.isCampaignWon()).toBe(false);

        campaign.recordSortieOutcome({
            sectorId: 'BARENTS_APPROACH',
            victory: true
        });

        expect(campaign.isCampaignWon()).toBe(true);
    });
});
