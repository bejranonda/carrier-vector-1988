import { describe, it, expect, vi } from 'vitest';
import { CockpitVoiceSystem } from './CockpitVoiceSystem';
import type { VoiceTelemetry } from './CockpitVoiceSystem';

function createMockSynth(): SpeechSynthesis {
    return {
        paused: false,
        pending: false,
        speaking: false,
        onvoiceschanged: null,
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
        pause: vi.fn(),
        resume: vi.fn(),
        speak: vi.fn()
    } as unknown as SpeechSynthesis;
}

const nominalTelemetry: VoiceTelemetry = {
    rwrState: 'SILENT',
    altitudeAgl: 1500,
    verticalSpeed: 0,
    isStalled: false,
    alphaDeg: 4,
    fuelFraction: 0.8,
    isAirborne: true
};

describe('CockpitVoiceSystem', () => {
    it('dispatches MISSILE warning when RWR indicates LAUNCH', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.update(0.016, {
            ...nominalTelemetry,
            rwrState: 'LAUNCH'
        });

        expect(voice.lastSpokenAlert).toBe('MISSILE');
    });

    it('dispatches PULL_UP warning when low altitude and steep descent', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.update(0.016, {
            ...nominalTelemetry,
            altitudeAgl: 120,
            verticalSpeed: -35
        });

        expect(voice.lastSpokenAlert).toBe('PULL_UP');
    });

    it('dispatches STALL warning when stalled or high AoA', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.update(0.016, {
            ...nominalTelemetry,
            isStalled: true
        });

        expect(voice.lastSpokenAlert).toBe('STALL');
    });

    it('dispatches BINGO warning when fuel drops below 15%', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.update(0.016, {
            ...nominalTelemetry,
            fuelFraction: 0.12
        });

        expect(voice.lastSpokenAlert).toBe('BINGO');
    });

    it('respects priority order when multiple alerts trigger simultaneously', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        // Queue BINGO first, then trigger MISSILE
        voice.requestAlert('BINGO');
        voice.requestAlert('MISSILE');

        // Highest priority (MISSILE) should be sorted first in queue
        expect(voice.activeQueue[0]).toBe('MISSILE');
    });

    it('suppresses repeated alerts during the 4-second cooldown window', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.update(0.016, { ...nominalTelemetry, rwrState: 'LAUNCH' });
        expect(voice.lastSpokenAlert).toBe('MISSILE');

        // Reset lastSpokenAlert tracker to see if another alert is spoken
        voice.lastSpokenAlert = null;

        // Advance 1 second (cooldown is 4s)
        voice.update(1.0, { ...nominalTelemetry, rwrState: 'LAUNCH' });
        expect(voice.lastSpokenAlert).toBeNull();

        // Advance past cooldown (4.5s total)
        voice.update(3.5, { ...nominalTelemetry, rwrState: 'LAUNCH' });
        expect(voice.lastSpokenAlert).toBe('MISSILE');
    });

    it('does not dispatch alerts when on deck / not airborne', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.update(0.016, {
            ...nominalTelemetry,
            isAirborne: false,
            altitudeAgl: 10,
            verticalSpeed: -50,
            rwrState: 'LAUNCH'
        });

        expect(voice.lastSpokenAlert).toBeNull();
    });

    it('suppresses speech and clears queue when muted', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);
        voice.setMuted(true);

        const accepted = voice.requestAlert('MISSILE');
        expect(accepted).toBe(false);
        expect(voice.activeQueue.length).toBe(0);
    });

    it('speaks radio callouts when unmuted and suppresses when muted', () => {
        const mockSynth = createMockSynth();
        const voice = new CockpitVoiceSystem(mockSynth);

        voice.speakRadioCallout('Splash one bandit!');
        expect(mockSynth.speak).toHaveBeenCalledTimes(1);

        voice.setMuted(true);
        voice.speakRadioCallout('Direct hit!');
        expect(mockSynth.speak).toHaveBeenCalledTimes(1);
    });
});

