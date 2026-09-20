/**
 * CARRIER VECTOR: 1988 - Procedural Web Audio Engine
 *
 * Every sound is synthesized at runtime from oscillators and noise buffers.
 * There are no audio assets, which is the zero-dependency rule applied to the
 * ears as well as the eyes.
 *
 * SIGNAL PATH
 * Every voice now runs through a bus rather than connecting to the output
 * directly:
 *
 *     voice -> [panner] -> category gain -> master gain -> compressor -> out
 *
 * That structure is the difference between "some sounds play" and a mix. It
 * buys three things the game visibly lacked:
 *
 *  - **Headroom.** Six overlapping voices used to sum past unity and clip
 *    exactly when the game was at its most exciting. The compressor on the
 *    master bus holds the peaks instead.
 *  - **Priority.** A launch warning is an instruction; the engine is context.
 *    They sit on different buses at different levels, and the alert ducks the
 *    beds rather than fighting them.
 *  - **A direction to look.** World events are panned and attenuated by where
 *    they actually happened, so a SAM firing off the left wing is information
 *    and not just noise. The geometry lives in `AudioMix.ts`, which is pure
 *    and tested; this file only makes sound.
 */

import { MIX, airflow, buffet, spatial, threatBed } from './AudioMix';
import type { Vec3Like } from './AudioMix';

/** Where a world sound happened, relative to the pilot. */
export interface SoundPlacement {
    listener: Vec3Like;
    listenerYaw: number;
    source: Vec3Like;
}

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

    // --- Buses ---
    private master: GainNode | null = null;
    private busEngine: GainNode | null = null;
    private busAirflow: GainNode | null = null;
    private busThreat: GainNode | null = null;
    private busWeapons: GainNode | null = null;
    private busImpacts: GainNode | null = null;
    private busAlerts: GainNode | null = null;
    private busWorld: GainNode | null = null;
    private busUi: GainNode | null = null;

    // --- Continuous beds ---
    private airflowGain: GainNode | null = null;
    private airflowFilter: BiquadFilterNode | null = null;
    private buffetGain: GainNode | null = null;
    private threatOsc: OscillatorNode | null = null;
    private threatGain: GainNode | null = null;

    /** Shared noise buffer: one allocation instead of one per voice. */
    private noiseBuffer: AudioBuffer | null = null;

    /**
     * Toggle audio. isMuted was previously read in nine places but never
     * assigned anywhere and had no public setter, so it was dead state.
     * Returns the new muted state.
     */
    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.ctx) {
            const now = this.ctx.currentTime;
            // One line per bed. Muting used to leave the continuous voices
            // running at whatever level they happened to be at, which is the
            // classic way a mute button ends up not muting things.
            if (this.master) this.master.gain.setTargetAtTime(this.isMuted ? 0 : MIX.master, now, 0.05);
            if (this.engineGain) this.engineGain.gain.setTargetAtTime(this.isMuted ? 0 : MIX.engine, now, 0.05);
            if (this.afterburnerNoiseGain) this.afterburnerNoiseGain.gain.setTargetAtTime(0, now, 0.05);
            if (this.rwrGain) this.rwrGain.gain.setValueAtTime(0, now);
            if (this.airflowGain) this.airflowGain.gain.setTargetAtTime(0, now, 0.05);
            if (this.buffetGain) this.buffetGain.gain.setTargetAtTime(0, now, 0.05);
            if (this.threatGain) this.threatGain.gain.setTargetAtTime(0, now, 0.05);
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

        // 0. The bus tree. Everything below connects to one of these, and
        //    nothing connects to `destination` directly any more.
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
        compressor.release.setValueAtTime(0.18, this.ctx.currentTime);
        compressor.connect(this.ctx.destination);

        this.master = this.ctx.createGain();
        this.master.gain.setValueAtTime(MIX.master, this.ctx.currentTime);
        this.master.connect(compressor);

        const bus = (level: number) => {
            const g = this.ctx!.createGain();
            g.gain.setValueAtTime(level, this.ctx!.currentTime);
            g.connect(this.master!);
            return g;
        };
        // The engine and airflow voices carry their own levels from MIX, so
        // their buses are near-unity trims rather than attenuators.
        this.busEngine = bus(0.9);
        this.busAirflow = bus(0.9);
        this.busThreat = bus(1);
        this.busWeapons = bus(MIX.weapons);
        this.busImpacts = bus(MIX.impacts);
        this.busAlerts = bus(MIX.alerts);
        this.busWorld = bus(MIX.world);
        this.busUi = bus(MIX.ui);

        // Shared noise, allocated once.
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const noiseData = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

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
        this.engineGain.connect(this.busEngine);
        this.engineOsc.start();

        // White noise node for afterburner roar
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = this.noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
        noiseFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

        this.afterburnerNoiseGain = this.ctx.createGain();
        this.afterburnerNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(this.afterburnerNoiseGain);
        this.afterburnerNoiseGain.connect(this.busEngine);
        whiteNoise.start();

        // 2. RWR Audio pipeline
        this.rwrOsc = this.ctx.createOscillator();
        this.rwrOsc.type = 'square';
        this.rwrOsc.frequency.setValueAtTime(880, this.ctx.currentTime);

        this.rwrGain = this.ctx.createGain();
        this.rwrGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.rwrOsc.connect(this.rwrGain);
        this.rwrGain.connect(this.busAlerts);
        this.rwrOsc.start();

        // 3. Airflow over the canopy: the cheapest possible cue for speed.
        //    Without it, 250 kt and 500 kt sound identical.
        const airNoise = this.ctx.createBufferSource();
        airNoise.buffer = this.noiseBuffer;
        airNoise.loop = true;

        this.airflowFilter = this.ctx.createBiquadFilter();
        this.airflowFilter.type = 'lowpass';
        this.airflowFilter.frequency.setValueAtTime(300, this.ctx.currentTime);

        this.airflowGain = this.ctx.createGain();
        this.airflowGain.gain.setValueAtTime(0, this.ctx.currentTime);

        airNoise.connect(this.airflowFilter);
        this.airflowFilter.connect(this.airflowGain);
        this.airflowGain.connect(this.busAirflow);
        airNoise.start();

        // 4. Stall buffet: a low rumble that starts BEFORE the wing lets go,
        //    which is what makes it a warning rather than a death notice.
        const buffetNoise = this.ctx.createBufferSource();
        buffetNoise.buffer = this.noiseBuffer;
        buffetNoise.loop = true;

        const buffetFilter = this.ctx.createBiquadFilter();
        buffetFilter.type = 'bandpass';
        buffetFilter.frequency.setValueAtTime(90, this.ctx.currentTime);
        buffetFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

        this.buffetGain = this.ctx.createGain();
        this.buffetGain.gain.setValueAtTime(0, this.ctx.currentTime);

        buffetNoise.connect(buffetFilter);
        buffetFilter.connect(this.buffetGain);
        this.buffetGain.connect(this.busAirflow);
        buffetNoise.start();

        // 5. Threat bed: the closest thing this game has to a score, and it is
        //    generated from the tactical situation rather than composed - so
        //    the tension is always telling the truth.
        this.threatOsc = this.ctx.createOscillator();
        this.threatOsc.type = 'sawtooth';
        this.threatOsc.frequency.setValueAtTime(48, this.ctx.currentTime);

        const threatFilter = this.ctx.createBiquadFilter();
        threatFilter.type = 'lowpass';
        threatFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

        this.threatGain = this.ctx.createGain();
        this.threatGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.threatOsc.connect(threatFilter);
        threatFilter.connect(this.threatGain);
        this.threatGain.connect(this.busThreat);
        this.threatOsc.start();
    }

    /**
     * Route a one-shot voice to a bus, optionally placed in the world.
     * Returns the node a voice should connect to, or null when the placement
     * puts it out of earshot entirely.
     */
    private route(bus: GainNode | null, place?: SoundPlacement): AudioNode | null {
        if (!this.ctx || !bus || this.isMuted) return null;
        if (!place) return bus;

        const { gain, pan } = spatial(place.listener, place.listenerYaw, place.source);
        if (gain <= 0.001) return null;

        const level = this.ctx.createGain();
        level.gain.setValueAtTime(gain, this.ctx.currentTime);

        // StereoPannerNode is not universal (older Safari); a missing panner
        // must cost the stereo image, never the sound.
        if (typeof this.ctx.createStereoPanner === 'function') {
            const panner = this.ctx.createStereoPanner();
            panner.pan.setValueAtTime(pan, this.ctx.currentTime);
            level.connect(panner);
            panner.connect(bus);
        } else {
            level.connect(bus);
        }
        return level;
    }

    public updateEngine(throttle: number, isAirborne: boolean) {
        if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain || !this.afterburnerNoiseGain) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (!isAirborne && throttle <= 0.01) {
            this.engineGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.01, this.ctx.currentTime, 0.1);
            this.afterburnerNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            return;
        }

        // Throttle ranges 0.0 -> 1.5 (afterburner > 1.0)
        const basePitch = 70 + Math.min(1.0, throttle) * 140; // 70Hz - 210Hz
        const cutoff = 250 + Math.min(1.0, throttle) * 600;
        this.engineOsc.frequency.setTargetAtTime(basePitch, this.ctx.currentTime, 0.08);
        this.engineFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.08);

        const targetGain = this.isMuted ? 0 : MIX.engine + Math.min(1.0, throttle) * 0.05;
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);

        // Afterburner roar
        if (throttle > 1.0) {
            const abIntensity = (throttle - 1.0) / 0.5;
            this.afterburnerNoiseGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.09 * abIntensity, this.ctx.currentTime, 0.05);
        } else {
            this.afterburnerNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
        }
    }

    /**
     * The continuous beds: airflow, buffet and the threat drone. Driven every
     * frame from the simulation's own state, so none of them can drift out of
     * agreement with what is actually happening.
     */
    public updateAmbience(state: {
        airSpeed: number;
        alpha: number;
        isStalled: boolean;
        isAirborne: boolean;
        rwrState: 'SILENT' | 'SEARCH' | 'TRACK' | 'LAUNCH';
    }) {
        if (!this.ctx || !this.airflowGain || !this.airflowFilter || !this.buffetGain || !this.threatGain || !this.threatOsc) return;
        const now = this.ctx.currentTime;
        const silent = this.isMuted || !state.isAirborne;

        const air = airflow(state.airSpeed);
        this.airflowGain.gain.setTargetAtTime(silent ? 0 : air.gain, now, 0.12);
        this.airflowFilter.frequency.setTargetAtTime(air.cutoff, now, 0.15);

        const shake = buffet(state.alpha, state.isStalled);
        this.buffetGain.gain.setTargetAtTime(silent ? 0 : shake * 0.09, now, 0.06);

        const bed = threatBed(state.rwrState);
        this.threatGain.gain.setTargetAtTime(silent ? 0 : bed.gain, now, 0.35);
        this.threatOsc.frequency.setTargetAtTime(bed.frequency, now, 0.5);
    }

    /**
     * Rounds going past the canopy. Deliberately NOT the player's own cannon
     * sound, which is what this used to play: being shot at and shooting
     * sounded identical, so the most important thing the audio could tell you
     * was the one thing it did not.
     */
    public playIncomingFire(place?: SoundPlacement) {
        const out = this.route(this.busAlerts, place);
        if (!this.ctx || !out || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        const crack = this.ctx.createBufferSource();
        crack.buffer = this.noiseBuffer;
        crack.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2600, now);
        filter.frequency.exponentialRampToValueAtTime(700, now + 0.22);
        filter.Q.setValueAtTime(3.5, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        crack.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        crack.start(now);
        crack.stop(now + 0.27);
    }

    /**
     * Master caution. One deliberate double-beep: the sound that means look at
     * the panel, as distinct from the RWR, which means look outside.
     */
    public playMasterCaution() {
        const out = this.route(this.busAlerts);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        for (const i of [0, 1]) {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(520, now + i * 0.18);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now + i * 0.18);
            gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.18 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.13);

            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.18);
            osc.stop(now + i * 0.18 + 0.15);
        }
    }

    /**
     * Someone else's missile leaving the rail, out in the world. Panned and
     * attenuated, so "a SAM just launched, and it is behind my left shoulder"
     * is something the player hears rather than reads.
     */
    public playDistantLaunch(place?: SoundPlacement) {
        const out = this.route(this.busWorld, place);
        if (!this.ctx || !out || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        const roar = this.ctx.createBufferSource();
        roar.buffer = this.noiseBuffer;
        roar.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.8);
        filter.Q.setValueAtTime(0.9, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

        roar.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        roar.start(now);
        roar.stop(now + 0.95);
    }

    /** Menu movement: short, dry, and quiet enough to press twenty times. */
    public playUiMove() {
        const out = this.route(this.busUi);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.035, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.06);
    }

    /** Committing to something: a confident rising pair. */
    public playUiSelect() {
        const out = this.route(this.busUi);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        for (const [i, freq] of [520, 780].entries()) {
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.06, now + i * 0.06 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.14);

            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.16);
        }
    }

    /**
     * End of a run. Two different figures, because a debrief that sounds the
     * same whether you held the boat or lost it is not telling you anything.
     */
    public playDebriefSting(won: boolean) {
        const out = this.route(this.busUi);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;
        const notes = won ? [392, 523, 659] : [330, 262, 196];

        for (const [i, freq] of notes.entries()) {
            const osc = this.ctx.createOscillator();
            osc.type = won ? 'triangle' : 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.16);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now + i * 0.16);
            gain.gain.exponentialRampToValueAtTime(won ? 0.09 : 0.07, now + i * 0.16 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.55);

            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.16);
            osc.stop(now + i * 0.16 + 0.6);
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
                this.rwrGain.gain.setValueAtTime(0.10, now);
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
                this.rwrGain.gain.setValueAtTime(0.16, now);
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
                this.rwrGain.gain.setValueAtTime(0.24, now);
            };
            warble();
            this.rwrInterval = window.setInterval(warble, 160);
        }
    }

    public playGunShot(place?: SoundPlacement) {
        const out = this.route(this.busWeapons, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        // 20mm Vulcan burst: short white noise + low punch
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.04);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    /**
     * A round connecting. Deliberately tiny and dry - it fires up to twenty
     * times a second, so anything with a tail turns a burst into mush.
     */
    public playHitTick(place?: SoundPlacement) {
        const out = this.route(this.busImpacts, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1850, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.035);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.04);
    }

    /** Mechanical relay click: crisp, tactile transient for desktop UI button clicks. */
    public playRelayClick() {
        const out = this.route(this.busUi);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.035);
    }

    /** Kill confirmation: a triumphant three-note arcade arpeggio, the dopamine reward sound. */
    public playKillConfirm(place?: SoundPlacement) {
        const out = this.route(this.busImpacts, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        // D5 (587Hz) -> A5 (880Hz) -> D6 (1174Hz) triumphant major triad
        for (const [i, freq] of [587, 880, 1174].entries()) {
            const osc = this.ctx!.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.065);

            const gain = this.ctx!.createGain();
            gain.gain.setValueAtTime(0.0001, now + i * 0.065);
            gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.065 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.18);

            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.065);
            osc.stop(now + i * 0.065 + 0.20);
        }
    }

    /**
     * Catching a wire: a heavy metallic clunk under a rising strain. This is
     * the payoff sound for the hardest thing in the game, so it is the
     * longest and the loudest thing in here.
     */
    public playWireCatch(place?: SoundPlacement) {
        const out = this.route(this.busImpacts, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        // The clunk.
        const thud = this.ctx.createOscillator();
        thud.type = 'sawtooth';
        thud.frequency.setValueAtTime(180, now);
        thud.frequency.exponentialRampToValueAtTime(42, now + 0.25);
        const thudGain = this.ctx.createGain();
        thudGain.gain.setValueAtTime(0.34, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        thud.connect(thudGain);
        thudGain.connect(out);
        thud.start(now);
        thud.stop(now + 0.42);

        // The cable singing as it pays out.
        const strain = this.ctx.createOscillator();
        strain.type = 'triangle';
        strain.frequency.setValueAtTime(420, now + 0.02);
        strain.frequency.exponentialRampToValueAtTime(140, now + 0.6);
        const strainGain = this.ctx.createGain();
        strainGain.gain.setValueAtTime(0.0001, now + 0.02);
        strainGain.gain.exponentialRampToValueAtTime(0.11, now + 0.08);
        strainGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
        strain.connect(strainGain);
        strainGain.connect(out);
        strain.start(now + 0.02);
        strain.stop(now + 0.64);
    }

    /** Designation lock: one short, clean tone. */
    public playLockTone(place?: SoundPlacement) {
        const out = this.route(this.busUi, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1320, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.14);
    }

    public playMissileLaunch(place?: SoundPlacement) {
        const out = this.route(this.busWeapons, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        // Whoosh swoosh sound
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.30, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.65);
    }

    public playExplosion(place?: SoundPlacement) {
        const out = this.route(this.busImpacts, place);
        if (!this.ctx || !out) return;
        const now = this.ctx.currentTime;

        // Low frequency thud / flak burst
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.42, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.9);
    }

    public playCatapultLaunch(place?: SoundPlacement) {
        const out = this.route(this.busEngine, place);
        if (!this.ctx || !out) return;
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
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.75);
    }
}

export const soundFX = new SoundFX();
