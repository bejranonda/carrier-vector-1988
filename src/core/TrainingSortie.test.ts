import { describe, it, expect } from 'vitest';
import { scenarioById, MissionDirector } from './Scenarios';
import type { MissionSnapshot } from './Scenarios';

function makeSnapshot(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
    return {
        missionSeconds: 0,
        isAirborne: false,
        hasLaunched: false,
        isRecovered: false,
        altitudeMsl: 18,
        altitudeAgl: 18,
        airSpeed: 0,
        fuel: 5000,
        damage: 0,
        distanceToCarrier: 0,
        distanceToStrikeTarget: null,
        strikeTargetDestroyed: false,
        strikeTargetHits: 0,
        samSitesAlive: 0,
        samSitesTotal: 0,
        contactsAlive: 0,
        liveInboundPackages: 0,
        soonestEtaSeconds: null,
        packagesLeaked: 0,
        carrierHealth: 100,
        airframesLost: 0,
        spareAirframes: 24,
        traps: 0,
        perfectTraps: 0,
        bombsRemaining: 0,
        rwrState: 'SILENT',
        flightAssistMode: 'ASSIST',
        ...overrides
    };
}

describe('TRAINING_SORTIE', () => {
    const scenario = scenarioById('TRAINING_SORTIE');

    it('defines a non-combat environment with zero hostile SAM sites', () => {
        expect(scenario.id).toBe('TRAINING_SORTIE');
        expect(scenario.difficulty).toBe(1);
        expect(scenario.setup.noSamSites).toBe(true);
        expect(scenario.setup.combatShielded).toBe(true);
        expect(scenario.setup.threat.endlessWaves).toBe(false);
    });

    // REGRESSION: the timeline was empty, so `contactsAlive` was always zero
    // while DRONE_SPLASH told the pilot a drone had spawned and completed
    // itself on a timer. The tutorial's only combat lesson never happened.
    it('spawns exactly one target drone for the pilot to shoot', () => {
        const timeline = scenario.setup.threat.openingTimeline ?? [];
        expect(timeline).toHaveLength(1);
        expect(timeline[0].count).toBe(1);
        expect(timeline[0].aircraftType).toBe('MiG-23');
    });

    it('has 5 sequential phases from launch to recovery', () => {
        expect(scenario.phases).toHaveLength(5);
        expect(scenario.phases[0].id).toBe('CAT_SHOT');
        expect(scenario.phases[1].id).toBe('CLIMB_OUT');
        expect(scenario.phases[2].id).toBe('AUTOPILOT_CHECK');
        expect(scenario.phases[3].id).toBe('DRONE_SPLASH');
        expect(scenario.phases[4].id).toBe('RECOVER');
    });

    it('advances through training phases as flight requirements are met', () => {
        const director = new MissionDirector(scenario);

        // Phase 1: On deck waiting for catapult launch
        let status = director.update(makeSnapshot({ hasLaunched: false }));
        expect(status.outcome).toBe('ACTIVE');
        expect(status.phaseIndex).toBe(0);

        // Catapult launch complete
        status = director.update(makeSnapshot({ hasLaunched: true, isAirborne: true, altitudeAgl: 200 }));
        expect(status.phaseIndex).toBe(1); // Advances to CLIMB_OUT

        // Climb to 2500 ft (760m)
        status = director.update(makeSnapshot({ hasLaunched: true, isAirborne: true, altitudeAgl: 750 }));
        expect(status.phaseIndex).toBe(2); // Advances to AUTOPILOT_CHECK

        // Flying fast for a while is NOT engaging the autopilot. This used
        // to advance the phase and announce AUTOPILOT VERIFIED.
        status = director.update(makeSnapshot({
            hasLaunched: true,
            isAirborne: true,
            altitudeAgl: 750,
            airSpeed: 160,
            missionSeconds: 25,
            flightAssistMode: 'ASSIST',
            contactsAlive: 1
        }));
        expect(status.phaseIndex).toBe(2); // Still AUTOPILOT_CHECK

        // Actually engaging it advances the phase.
        status = director.update(makeSnapshot({
            hasLaunched: true,
            isAirborne: true,
            altitudeAgl: 750,
            airSpeed: 160,
            missionSeconds: 25,
            flightAssistMode: 'AUTO',
            contactsAlive: 1
        }));
        expect(status.phaseIndex).toBe(3); // Advances to DRONE_SPLASH

        // A live drone holds the phase - no more completing on a timer.
        status = director.update(makeSnapshot({
            hasLaunched: true,
            isAirborne: true,
            flightAssistMode: 'AUTO',
            contactsAlive: 1,
            missionSeconds: 40
        }));
        expect(status.phaseIndex).toBe(3);

        // Target drone splashed
        status = director.update(makeSnapshot({
            hasLaunched: true,
            isAirborne: true,
            altitudeAgl: 750,
            airSpeed: 160,
            flightAssistMode: 'AUTO',
            contactsAlive: 0,
            missionSeconds: 40
        }));
        expect(status.phaseIndex).toBe(4); // Advances to RECOVER

        // Recovery trap aboard CV-68
        status = director.update(makeSnapshot({
            hasLaunched: true,
            isRecovered: true,
            traps: 1
        }));
        expect(status.outcome).toBe('SUCCESS');
    });

    it('fails if airframe is lost', () => {
        const director = new MissionDirector(scenario);
        const status = director.update(makeSnapshot({ airframesLost: 1 }));
        expect(status.outcome).toBe('FAILED');
    });
});
