/**
 * CARRIER VECTOR: 1988 - Procedural Web Audio Engine
 * Pure synthesized retro SFX: Jet engine whine, RWR warning tones, Vulcan cannon bursts, explosions.
 */

export class SoundFX {
    private ctx: AudioContext | null = null;
    private engineOsc: OscillatorNode | null = null;
    private engineGain: GainNode | null = null;
    private engineFilter: BiquadFilterNode | null = null;
    private afterburnerNoiseGain: GainNode | null = null;

    private rwrOsc: OscillatorNode | null = null;
    private rwrGain: GainNode | null = null;
    private rwrInterval: number | null = null;
    private currentRwrState: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH' = 'SILENT';

    private isMuted: boolean = false;

    /**
     * Toggle audio. isMuted was previously read in nine places but never
     * assigned anywhere and had no public setter, so it was dead state.
     * Returns the new muted state.
     */
    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.ctx) {
            const now = this.ctx.currentTime;
            if (this.engineGain) this.engineGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.04, now, 0.05);
            if (this.afterburnerNoiseGain) this.afterburnerNoiseGain.gain.setTargetAtTime(0, now, 0.05);
            if (this.rwrGain) this.rwrGain.gain.setValueAtTime(0, now);
        }
        return this.isMuted;
    }

    public get muted(): boolean {
        return this.isMuted;
    }

    public init() {
        if (this.ctx) return;
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtxClass();

        // 1. Engine sound pipeline
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(80, this.ctx.currentTime);

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(300, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();

        // White noise node for afterburner roar
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
        noiseFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

        this.afterburnerNoiseGain = this.ctx.createGain();
        this.afterburnerNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(this.afterburnerNoiseGain);
        this.afterburnerNoiseGain.connect(this.ctx.destination);
        whiteNoise.start();

        // 2. RWR Audio pipeline
        this.rwrOsc = this.ctx.createOscillator();
        this.rwrOsc.type = 'square';
        this.rwrOsc.frequency.setValueAtTime(880, this.ctx.currentTime);

        this.rwrGain = this.ctx.createGain();
        this.rwrGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.rwrOsc.connect(this.rwrGain);
        this.rwrGain.connect(this.ctx.destination);
        this.rwrOsc.start();
    }

    public updateEngine(throttle: number, isAirborne: boolean) {
        if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain || !this.afterburnerNoiseGain) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (!isAirborne && throttle <= 0.01) {
            this.engineGain.gain.setTargetAtTime(0.01, this.ctx.currentTime, 0.1);
            this.afterburnerNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            return;
        }

        // Throttle ranges 0.0 -> 1.5 (afterburner > 1.0)
        const basePitch = 70 + Math.min(1.0, throttle) * 140; // 70Hz - 210Hz
        const cutoff = 250 + Math.min(1.0, throttle) * 600;
        this.engineOsc.frequency.setTargetAtTime(basePitch, this.ctx.currentTime, 0.08);
        this.engineFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.08);

        const targetGain = this.isMuted ? 0 : 0.04 + Math.min(1.0, throttle) * 0.05;
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);

        // Afterburner roar
        if (throttle > 1.0) {
            const abIntensity = (throttle - 1.0) / 0.5;
            this.afterburnerNoiseGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.09 * abIntensity, this.ctx.currentTime, 0.05);
        } else {
            this.afterburnerNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
        }
    }

    public setRWRState(state: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH') {
        if (this.currentRwrState === state) return;
        this.currentRwrState = state;

        if (this.rwrInterval) {
            window.clearInterval(this.rwrInterval);
            this.rwrInterval = null;
        }

        if (!this.ctx || !this.rwrGain || !this.rwrOsc || this.isMuted) return;

        if (state === 'SILENT') {
            this.rwrGain.gain.setValueAtTime(0, this.ctx.currentTime);
        } else if (state === 'SEARCH') {
            // Pulsing tone: 750Hz, 100ms pulse every 1000ms
            this.rwrOsc.frequency.setValueAtTime(750, this.ctx.currentTime);
            const beep = () => {
                if (!this.ctx || !this.rwrGain || this.isMuted) return;
                const now = this.ctx.currentTime;
                this.rwrGain.gain.cancelScheduledValues(now);
                this.rwrGain.gain.setValueAtTime(0.04, now);
                this.rwrGain.gain.setValueAtTime(0, now + 0.09);
            };
            beep();
            this.rwrInterval = window.setInterval(beep, 1200);
        } else if (state === 'TRACK') {
            // Rapid ping: 1200Hz, 60ms pulse every 220ms
            this.rwrOsc.frequency.setValueAtTime(1200, this.ctx.currentTime);
            const ping = () => {
                if (!this.ctx || !this.rwrGain || this.isMuted) return;
                const now = this.ctx.currentTime;
                this.rwrGain.gain.cancelScheduledValues(now);
                this.rwrGain.gain.setValueAtTime(0.06, now);
                this.rwrGain.gain.setValueAtTime(0, now + 0.06);
            };
            ping();
            this.rwrInterval = window.setInterval(ping, 220);
        } else if (state === 'LAUNCH') {
            // Continuous warbling klaxon: alternating 1800Hz / 1200Hz
            const warble = () => {
                if (!this.ctx || !this.rwrGain || !this.rwrOsc || this.isMuted) return;
                const now = this.ctx.currentTime;
                this.rwrOsc.frequency.setValueAtTime(1600, now);
                this.rwrOsc.frequency.setValueAtTime(1100, now + 0.08);
                this.rwrGain.gain.setValueAtTime(0.08, now);
            };
            warble();
            this.rwrInterval = window.setInterval(warble, 160);
        }
    }

    public playGunShot() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // 20mm Vulcan burst: short white noise + low punch
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.04);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    public playMissileLaunch() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Whoosh swoosh sound
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
    }

    public playExplosion() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Low frequency thud / flak burst
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.9);
    }

    public playCatapultLaunch() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Steam hiss and mechanical clunk
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.7);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.75);
    }
}

export const soundFX = new SoundFX();
