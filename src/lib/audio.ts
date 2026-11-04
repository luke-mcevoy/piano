import { HARMONIC_COUNT, harmonicSeries, midiToFrequency } from "./music";

interface Voice {
  gain: GainNode;
  oscillators: OscillatorNode[];
  released: boolean;
}

/** Loud enough to hear if the key is released before the attack ramp runs. */
const RELEASE_FLOOR = 0.2;

/**
 * Additive tone. Each partial is a sine at n·f₀ with amplitude 1/n^1.5,
 * the same envelope drawn in the harmonic-series panel.
 */
export class PianoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private held = new Set<number>();
  private pedal = false;
  private voices = new Map<number, Voice>();
  private generation = new Map<number, number>();

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

  private ensure(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed" || !this.master) {
      const ctx = this.createContext();
      const master = ctx.createGain();
      master.gain.value = 0.42;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    }
    return this.ctx;
  }

  /**
   * Oscillators scheduled while the context is suspended are dropped by some
   * browsers. Wait until it is actually running, then start.
   */
  private async running(): Promise<AudioContext> {
    const ctx = this.ensure();
    if (ctx.state !== "running") await ctx.resume();
    if (ctx.state !== "running") throw new Error("AudioContext did not resume");
    return ctx;
  }

  noteOn(midi: number): Promise<void> {
    this.held.add(midi);
    const generation = (this.generation.get(midi) ?? 0) + 1;
    this.generation.set(midi, generation);
    return this.play(midi, generation);
  }

  noteOff(midi: number) {
    this.held.delete(midi);
    if (!this.pedal) this.release(midi);
  }

  setPedal(on: boolean) {
    this.pedal = on;
    if (!on) {
      for (const midi of [...this.voices.keys()]) {
        if (!this.held.has(midi)) this.release(midi);
      }
    }
  }

  /** A short tone that does not take over the key's held voice. */
  preview(midi: number): Promise<void> {
    return this.running()
      .then((ctx) => {
        const voice = this.startVoice(ctx, midi);
        const stopAt = ctx.currentTime + 0.62;
        this.fade(voice, stopAt - 0.28);
        window.setTimeout(() => {
          voice.oscillators.forEach((oscillator) => {
            try {
              oscillator.stop();
            } catch {
              /* already stopped */
            }
          });
        }, 700);
      })
      .catch(() => {
        /* resume failed; the next gesture tries again */
      });
  }

  silence() {
    this.held.clear();
    this.generation.clear();
    for (const midi of [...this.voices.keys()]) this.release(midi);
  }

  private async play(midi: number, generation: number): Promise<void> {
    try {
      const ctx = await this.running();
      if (this.generation.get(midi) !== generation) return;
      this.release(midi);
      if (this.generation.get(midi) !== generation) return;
      const voice = this.startVoice(ctx, midi);
      if (this.generation.get(midi) !== generation) {
        this.fade(voice, ctx.currentTime + 0.05);
        return;
      }
      this.voices.set(midi, voice);
      if (!this.held.has(midi) && !this.pedal) this.release(midi);
    } catch {
      /* resume failed; the next press tries again */
    }
  }

  private startVoice(ctx: AudioContext, midi: number): Voice {
    const fundamental = midiToFrequency(midi);
    const partials = harmonicSeries(fundamental, HARMONIC_COUNT);
    const amplitudeSum = partials.reduce((sum, partial) => sum + partial.amplitude, 0);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.85, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.32);
    gain.connect(this.master!);

    const oscillators = partials.map((partial) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(partial.frequency, now);
      const partialGain = ctx.createGain();
      partialGain.gain.value = partial.amplitude / amplitudeSum;
      oscillator.connect(partialGain);
      partialGain.connect(gain);
      oscillator.start(now);
      return oscillator;
    });

    return { gain, oscillators, released: false };
  }

  private release(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    this.voices.delete(midi);
    const ctx = this.ctx;
    if (!ctx) return;
    this.fade(voice, ctx.currentTime + 0.42);
  }

  private fade(voice: Voice, endTime: number) {
    if (voice.released || !this.ctx) return;
    voice.released = true;
    const now = this.ctx.currentTime;
    const gain = voice.gain.gain;
    gain.cancelScheduledValues(now);
    // setValueAtTime(0.0001) updates .value immediately in Chrome, before the
    // attack ramp. Releasing from that floor cancels the swell and the key is silent.
    const level = Math.max(gain.value, RELEASE_FLOOR);
    gain.setValueAtTime(level, now);
    const stopAt = Math.max(endTime, now + 0.05);
    gain.exponentialRampToValueAtTime(0.0001, stopAt);
    for (const oscillator of voice.oscillators) {
      try {
        oscillator.stop(stopAt + 0.02);
      } catch {
        /* already stopped */
      }
    }
  }
}

let singleton: PianoSynth | null = null;

export function getSynth(): PianoSynth {
  singleton ??= new PianoSynth();
  return singleton;
}
