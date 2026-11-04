import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PianoSynth } from "./audio";
import { shouldReleaseOnPointerLeave } from "./gestures";
import { HARMONIC_COUNT } from "./music";

interface RecordedGain {
  value: number;
  sets: number[];
}

function fakeContext() {
  const oscillators: { started: boolean; stopped: boolean }[] = [];
  const gains: RecordedGain[] = [];
  let releaseGate: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const ctx = {
    state: "suspended" as AudioContextState,
    currentTime: 0,
    destination: {},
    async resume() {
      await gate;
      ctx.state = "running";
    },
    createGain() {
      const param: RecordedGain & {
        setValueAtTime: (value: number) => void;
        exponentialRampToValueAtTime: () => void;
        cancelScheduledValues: () => void;
      } = {
        value: 1,
        sets: [],
        setValueAtTime(value: number) {
          param.value = value;
          param.sets.push(value);
        },
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
      };
      gains.push(param);
      return { gain: param, connect() {} };
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect() {},
      };
    },
    createOscillator() {
      const osc = {
        type: "sine",
        started: false,
        stopped: false,
        frequency: { setValueAtTime() {} },
        connect() {
          return osc;
        },
        start() {
          osc.started = true;
          oscillators.push(osc);
        },
        stop() {
          osc.stopped = true;
        },
      };
      return osc;
    },
  };
  return { ctx: ctx as unknown as AudioContext, oscillators, gains, resume: () => releaseGate() };
}

describe("piano synth", () => {
  test("a press while the context is suspended starts only after resume", async () => {
    const fake = fakeContext();
    const synth = new PianoSynth(() => fake.ctx);
    const playing = synth.noteOn(60);
    await Promise.resolve();
    assert.equal(fake.oscillators.length, 0);
    fake.resume();
    await playing;
    assert.equal(fake.oscillators.length, HARMONIC_COUNT);
    assert.ok(fake.oscillators.every((osc) => osc.started && !osc.stopped));
  });

  test("releasing before the attack still starts an audible tone", async () => {
    const fake = fakeContext();
    const synth = new PianoSynth(() => fake.ctx);
    fake.resume();
    const playing = synth.noteOn(64);
    synth.noteOff(64);
    await playing;
    assert.equal(fake.oscillators.length, HARMONIC_COUNT);
    const voice = fake.gains.find((gain) => gain.sets.includes(0.0001));
    assert.ok(voice);
    assert.ok(Math.max(...voice.sets) >= 0.2);
  });
});

describe("pointer leave", () => {
  test("a held pointer that slips off the key without landing on another key is not a release", () => {
    assert.equal(shouldReleaseOnPointerLeave(60, 60, 1, false), false);
    assert.equal(shouldReleaseOnPointerLeave(60, 61, 1, true), false);
  });

  test("sliding onto another key, or lifting, releases", () => {
    assert.equal(shouldReleaseOnPointerLeave(60, 60, 1, true), true);
    assert.equal(shouldReleaseOnPointerLeave(60, 60, 0, false), true);
    assert.equal(shouldReleaseOnPointerLeave(undefined, 60, 1, false), false);
  });
});
