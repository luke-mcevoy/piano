import { HARMONIC_COUNT, harmonicSeries, midiToFrequency } from "./music";

interface Voice {
  gain: GainNode;
  oscillators: OscillatorNode[];
  released: boolean;
}

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

  private ensure(): AudioContext {
    if (!this.ctx || !this.master) {
      const ctx = new AudioContext();
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
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  noteOn(midi: number) {
    this.held.add(midi);
    this.retrigger(midi);
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
  preview(midi: number) {
    const ctx = this.ensure();
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
  }

  silence() {
    this.held.clear();
    for (const midi of [...this.voices.keys()]) this.release(midi);
  }

  private retrigger(midi: number) {
    this.release(midi);
    const ctx = this.ensure();
    this.voices.set(midi, this.startVoice(ctx, midi));
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
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
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
