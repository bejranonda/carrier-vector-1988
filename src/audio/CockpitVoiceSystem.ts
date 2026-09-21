/**
 * CARRIER VECTOR: 1988 - Synthesized Cockpit Voice Warning System ("Bitchin' Betty")
 *
 * Provides synthesized auditory alerts for critical flight envelope and threat conditions.
 * Audio alerts bypass visual attention bottlenecks, keeping the pilot's eyes glued
 * to the boresight reticle during supersonic maneuvers.
 *
 * Uses the native Web Speech API (window.speechSynthesis) with 1980s robotic voice tuning
 * and priority queuing. Completely decoupled from the DOM/Browser for 100% headless unit testing.
 */

export type VoiceWarningType = 'MISSILE' | 'PULL_UP' | 'STALL' | 'BINGO';

export interface VoiceTelemetry {
    rwrState: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH';
    altitudeAgl: number;   // metres
    verticalSpeed: number; // m/s, negative = descending
    isStalled: boolean;
    alphaDeg?: number;     // angle of attack degrees
    fuelFraction: number;  // 0.0 to 1.0 (fuel remaining / capacity)
    isAirborne: boolean;
}

export interface VoiceWarningConfig {
    phrase: string;
    priority: number; // Lower number = higher priority
    cooldown: number; // Minimum seconds between re-triggering this alert
}

export const VOICE_WARNINGS: Record<VoiceWarningType, VoiceWarningConfig> = {
    MISSILE: {
        phrase: 'WARNING: MISSILE LAUNCH',
        priority: 1,
        cooldown: 4.0
    },
    PULL_UP: {
        phrase: 'PULL UP, PULL UP',
        priority: 2,
        cooldown: 4.0
    },
    STALL: {
        phrase: 'STALL, STALL',
        priority: 3,
        cooldown: 4.0
    },
    BINGO: {
        phrase: 'BINGO FUEL',
        priority: 4,
        cooldown: 12.0 // Bingo fuel doesn't need to repeat as urgently
    }
};

export class CockpitVoiceSystem {
    private cooldownTimers: Record<VoiceWarningType, number> = {
        MISSILE: 0,
        PULL_UP: 0,
        STALL: 0,
        BINGO: 0
    };

    public isMuted: boolean = false;
    public lastSpokenAlert: VoiceWarningType | null = null;
    public activeQueue: VoiceWarningType[] = [];

    /** Speech synthesis synth instance or mock for testing */
    private synth: SpeechSynthesis | null = null;

    constructor(mockSynth?: SpeechSynthesis) {
        if (mockSynth) {
            this.synth = mockSynth;
        } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
        }
    }

    /**
     * Inspect flight telemetry each tick and evaluate alert conditions.
     */
    public update(dt: number, telemetry: VoiceTelemetry): void {
        // Decrement cooldown timers
        for (const key of Object.keys(this.cooldownTimers) as VoiceWarningType[]) {
            if (this.cooldownTimers[key] > 0) {
                this.cooldownTimers[key] = Math.max(0, this.cooldownTimers[key] - dt);
            }
        }

        if (!telemetry.isAirborne) {
            return;
        }

        // Priority 1: Missile Launch Alert
        if (telemetry.rwrState === 'LAUNCH') {
            this.requestAlert('MISSILE');
        }

        // Priority 2: Ground Proximity / CFIT Warning
        // Altitude < 200m and descending faster than 30 m/s
        if (telemetry.altitudeAgl < 200 && telemetry.verticalSpeed < -30) {
            this.requestAlert('PULL_UP');
        }

        // Priority 3: Aerodynamic Stall
        if (telemetry.isStalled || (telemetry.alphaDeg !== undefined && Math.abs(telemetry.alphaDeg) > 18)) {
            this.requestAlert('STALL');
        }

        // Priority 4: Low Fuel Reserve (< 15%)
        if (telemetry.fuelFraction < 0.15 && telemetry.fuelFraction > 0.001) {
            this.requestAlert('BINGO');
        }

        // Process queue if any alerts are pending
        this.processQueue();
    }

    /**
     * Enqueue a warning if its cooldown timer has elapsed.
     */
    public requestAlert(type: VoiceWarningType): boolean {
        if (this.isMuted) return false;
        if (this.cooldownTimers[type] > 0) return false;

        // Insert into queue respecting priority (lowest priority number first)
        const newPriority = VOICE_WARNINGS[type].priority;
        if (!this.activeQueue.includes(type)) {
            const insertIdx = this.activeQueue.findIndex(
                queued => VOICE_WARNINGS[queued].priority > newPriority
            );
            if (insertIdx === -1) {
                this.activeQueue.push(type);
            } else {
                this.activeQueue.splice(insertIdx, 0, type);
            }
            return true;
        }
        return false;
    }

    /**
     * Dispatch the highest-priority warning.
     */
    private processQueue(): void {
        if (this.activeQueue.length === 0 || this.isMuted) return;

        const nextAlert = this.activeQueue.shift()!;
        this.cooldownTimers[nextAlert] = VOICE_WARNINGS[nextAlert].cooldown;
        this.lastSpokenAlert = nextAlert;
        this.speak(VOICE_WARNINGS[nextAlert].phrase);
    }

    /**
     * Speech synthesis trigger with authentic 1980s computer voice characteristics.
     */
    private speak(text: string): void {
        if (!this.synth || this.isMuted) return;

        try {
            // Cancel current speech if urgent new alert arrives
            this.synth.cancel();

            if (typeof SpeechSynthesisUtterance !== 'undefined') {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.15; // Fast, urgent military cadence
                utterance.pitch = 0.85; // Lower, robotic tone
                utterance.volume = 1.0;

                // Pick an English voice if available
                const voices = this.synth.getVoices();
                const enVoice = voices.find(v => v.lang.startsWith('en'));
                if (enVoice) utterance.voice = enVoice;

                this.synth.speak(utterance);
            }
        } catch {
            // Ignore speech synthesis errors gracefully
        }
    }

    /**
     * Speak a radio callout or wingman celebration.
     */
    public speakRadioCallout(phrase: string): void {
        if (!this.synth || this.isMuted) return;

        try {
            this.synth.cancel();
            let utterance: SpeechSynthesisUtterance;
            if (typeof SpeechSynthesisUtterance !== 'undefined') {
                utterance = new SpeechSynthesisUtterance(phrase);
                utterance.rate = 1.1;
                utterance.pitch = 1.05;
                utterance.volume = 0.95;
                const voices = this.synth.getVoices();
                const enVoice = voices.find(v => v.lang.startsWith('en'));
                if (enVoice) utterance.voice = enVoice;
            } else {
                // Test / headless environment: use a plain duck-typed object
                utterance = { text: phrase, rate: 1.1, pitch: 1.05, volume: 0.95 } as unknown as SpeechSynthesisUtterance;
            }
            this.synth.speak(utterance);
        } catch {
            // Ignore speech synthesis errors gracefully
        }
    }

    public setMuted(muted: boolean): void {
        this.isMuted = muted;
        if (muted && this.synth) {
            this.synth.cancel();
            this.activeQueue = [];
        }
    }

    public clear(): void {
        this.activeQueue = [];
        this.lastSpokenAlert = null;
        if (this.synth) this.synth.cancel();
        for (const key of Object.keys(this.cooldownTimers) as VoiceWarningType[]) {
            this.cooldownTimers[key] = 0;
        }
    }
}
