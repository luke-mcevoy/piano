import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { layoutScore } from "./engrave";
import {
  LOW_MIDI,
  HIGH_MIDI,
  SHORTCUTS,
  buildKeys,
  describePosition,
  diatonic,
  enharmonicName,
  frequencyOf,
  groupMeasures,
  harmonicSeries,
  ledgerSteps,
  midiOf,
  midiToFrequency,
  parseMelody,
  partialAmplitude,
  pitchFromMidi,
  soundingNotes,
  spell,
} from "./music";
import { pieces } from "./pieces";

describe("pitch", () => {
  test("middle C and A4", () => {
    assert.equal(midiOf({ step: "C", alter: 0, octave: 4 }), 60);
    assert.equal(midiOf({ step: "A", alter: 0, octave: 4 }), 69);
    assert.equal(midiToFrequency(69), 440);
    assert.ok(Math.abs(midiToFrequency(60) - 261.6255653005986) < 1e-9);
    assert.equal(spell(pitchFromMidi(66)), "F♯4");
    assert.equal(enharmonicName(pitchFromMidi(66)), "G♭4");
    assert.equal(enharmonicName({ step: "C", alter: 0, octave: 4 }), null);
  });

  test("keyboard range is three octaves from C4 to C7", () => {
    const keys = buildKeys(LOW_MIDI, HIGH_MIDI);
    assert.equal(keys.length, 37);
    assert.equal(keys.filter((key) => !key.black).length, 22);
    assert.equal(keys.filter((key) => key.black).length, 15);
    assert.equal(keys[0].name, "C4");
    assert.equal(keys[keys.length - 1]?.name, "C7");
  });

  test("computer keys are unique and on the piano", () => {
    const midis = Object.values(SHORTCUTS);
    assert.equal(new Set(midis).size, midis.length);
    assert.equal(SHORTCUTS.KeyZ, 60);
    assert.equal(SHORTCUTS.KeyQ, 72);
    assert.equal(SHORTCUTS.KeyI, 84);
    for (const midi of midis) {
      assert.ok(midi >= LOW_MIDI && midi <= HIGH_MIDI);
    }
  });
});

describe("staff position", () => {
  test("treble landmarks", () => {
    assert.equal(diatonic({ step: "E", alter: 0, octave: 4 }), 0);
    assert.equal(diatonic({ step: "B", alter: 0, octave: 4 }), 4);
    assert.equal(diatonic({ step: "F", alter: 0, octave: 5 }), 8);
    assert.equal(diatonic({ step: "C", alter: 0, octave: 4 }), -2);
    assert.deepEqual(ledgerSteps(-2), [-2]);
    assert.deepEqual(ledgerSteps(-1), []);
    assert.deepEqual(ledgerSteps(0), []);
    assert.deepEqual(ledgerSteps(-4), [-2, -4]);
    assert.deepEqual(ledgerSteps(10), [10]);
    assert.deepEqual(ledgerSteps(12), [10, 12]);
  });

  test("plain-language positions", () => {
    const at = (token: string) => {
      const event = parseMelody(token)[0];
      if (event.type !== "note") throw new Error(token);
      return describePosition(event.pitch);
    };
    assert.match(at("C4"), /middle C/);
    assert.match(at("E4"), /bottom line/);
    assert.match(at("F4"), /first space/);
    assert.match(at("B4"), /middle line/);
    assert.match(at("F5"), /top line/);
    assert.match(at("D4"), /just below/);
    assert.match(at("A5"), /first ledger line above/);
    assert.match(at("C#4"), /first ledger line below/);
  });
});

describe("harmonic series", () => {
  test("partials are n times the fundamental and get quieter", () => {
    const series = harmonicSeries(frequencyOf({ step: "C", alter: 0, octave: 4 }));
    assert.ok(series.length >= 8);
    assert.equal(series.length, 12);
    series.forEach((partial, index) => {
      assert.equal(partial.n, index + 1);
      assert.ok(Math.abs(partial.frequency - partial.n * series[0].frequency) < 1e-9);
      assert.equal(partial.amplitude, partialAmplitude(partial.n));
      if (index > 0) assert.ok(partial.amplitude < series[index - 1].amplitude);
    });
    assert.equal(series[0].amplitude, 1);
    assert.equal(series[0].frequency.toFixed(1), "261.6");
  });
});

describe("pieces", () => {
  test("every built-in piece fills 4/4 measures with playable notes", () => {
    const counts: Record<string, number> = {
      "hot-cross-buns": 17,
      "c-major-scale": 16,
      twinkle: 42,
      "ode-to-joy": 30,
    };
    assert.deepEqual(
      pieces.map((piece) => piece.id),
      ["hot-cross-buns", "c-major-scale", "twinkle", "ode-to-joy"],
    );
    for (const piece of pieces) {
      const measures = groupMeasures(piece.events, piece.time.beats, piece.time.beatValue);
      assert.ok(measures.length >= 2, piece.title);
      for (const measure of measures) {
        assert.equal(measure.complete, true, piece.title);
        const beats = measure.events.reduce((sum, timed) => {
          const length = timed.event.duration === "w" ? 4 : timed.event.duration === "h" ? 2 : timed.event.duration === "8" ? 0.5 : 1;
          return sum + length;
        }, 0);
        assert.equal(beats, 4, piece.title);
      }
      const notes = soundingNotes(piece.events);
      assert.equal(notes.length, counts[piece.id], piece.title);
      for (const note of notes) {
        const midi = midiOf(note.pitch);
        assert.ok(midi >= LOW_MIDI && midi <= HIGH_MIDI, spell(note.pitch));
      }
    }
  });

  test("a short free-play fragment may leave the measure open", () => {
    const measures = groupMeasures(parseMelody("C4 D4"), 4, 4);
    assert.equal(measures.length, 1);
    assert.equal(measures[0].complete, false);
  });
});

describe("engraving", () => {
  test("middle C gets a ledger line and a sharp is printed", () => {
    const score = layoutScore({
      events: parseMelody("C4 D4 E4 F4 | F#4"),
      beats: 4,
      beatValue: 4,
      width: 820,
      labelNotes: true,
    });
    const notes = score.systems.flatMap((system) => system.measures.flatMap((measure) => measure.events));
    assert.equal(notes.length, 5);
    assert.equal(notes[0].ledgers.length, 1);
    assert.equal(notes[2].ledgers.length, 0);
    assert.equal(notes[0].label, "C4");
    assert.ok(notes[4].accidental);
    assert.ok(score.systems[0].clef);
    assert.equal(score.systems[0].time?.beats, 4);
  });
});
