/** Pitch, spelling, equal temperament, and the harmonic series. */

export type Step = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Alter = -1 | 0 | 1;
export type Duration = "w" | "h" | "q" | "8";

export interface Pitch {
  step: Step;
  alter: Alter;
  octave: number;
}

export type ScoreEvent =
  | { type: "note"; pitch: Pitch; duration: Duration }
  | { type: "rest"; duration: Duration };

/** Inclusive piano range: C4 through C7. */
export const LOW_MIDI = 60;
export const HIGH_MIDI = 96;

/** How many partials to draw, and to mix into the tone. */
export const HARMONIC_COUNT = 12;

const STEPS: Record<Step, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

const SHARP_SPELLING: { step: Step; alter: Alter }[] = [
  { step: "C", alter: 0 },
  { step: "C", alter: 1 },
  { step: "D", alter: 0 },
  { step: "D", alter: 1 },
  { step: "E", alter: 0 },
  { step: "F", alter: 0 },
  { step: "F", alter: 1 },
  { step: "G", alter: 0 },
  { step: "G", alter: 1 },
  { step: "A", alter: 0 },
  { step: "A", alter: 1 },
  { step: "B", alter: 0 },
];

const FLAT_SPELLING: { step: Step; alter: Alter }[] = [
  { step: "C", alter: 0 },
  { step: "D", alter: -1 },
  { step: "D", alter: 0 },
  { step: "E", alter: -1 },
  { step: "E", alter: 0 },
  { step: "F", alter: 0 },
  { step: "G", alter: -1 },
  { step: "G", alter: 0 },
  { step: "A", alter: -1 },
  { step: "A", alter: 0 },
  { step: "B", alter: -1 },
  { step: "B", alter: 0 },
];

export function midiOf(pitch: Pitch): number {
  return (pitch.octave + 1) * 12 + semitoneOf(pitch);
}

function semitoneOf(pitch: Pitch): number {
  const base: Record<Step, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  return base[pitch.step] + pitch.alter;
}

export function pitchFromMidi(midi: number): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const spelling = SHARP_SPELLING[pc];
  return { step: spelling.step, alter: spelling.alter, octave };
}

export function isBlackMidi(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

/** Equal temperament, A4 = 440 Hz. */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function frequencyOf(pitch: Pitch): number {
  return midiToFrequency(midiOf(pitch));
}

export function formatHz(hz: number): string {
  return hz.toFixed(1);
}

/**
 * Relative amplitude of partial n for a simplified struck-string spectrum.
 * A pure sine is only n = 1. A sawtooth falls as 1/n. This is steeper than
 * a sawtooth and gentler than a sine: 1/n^1.5.
 */
export function partialAmplitude(n: number): number {
  return n ** -1.5;
}

export interface Harmonic {
  n: number;
  frequency: number;
  amplitude: number;
}

export function harmonicSeries(fundamental: number, count = HARMONIC_COUNT): Harmonic[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      n,
      frequency: fundamental * n,
      amplitude: partialAmplitude(n),
    };
  });
}

export function spell(pitch: Pitch): string {
  const accidental = pitch.alter === 1 ? "♯" : pitch.alter === -1 ? "♭" : "";
  return `${pitch.step}${accidental}${pitch.octave}`;
}

export function enharmonicName(pitch: Pitch): string | null {
  if (pitch.alter === 0) return null;
  const pc = ((midiOf(pitch) % 12) + 12) % 12;
  const other = pitch.alter === 1 ? FLAT_SPELLING[pc] : SHARP_SPELLING[pc];
  const name = spell({ step: other.step, alter: other.alter, octave: pitch.octave });
  return name === spell(pitch) ? null : name;
}

/** Diatonic steps above the treble staff's bottom line (E4). */
export function diatonic(pitch: Pitch): number {
  return (pitch.octave - 4) * 7 + (STEPS[pitch.step] - STEPS.E);
}

/** Ledger-line diatonic positions a note needs, not including the staff itself. */
export function ledgerSteps(diatonicPosition: number): number[] {
  const lines: number[] = [];
  if (diatonicPosition <= -2) {
    for (let step = -2; step >= diatonicPosition; step -= 2) lines.push(step);
  }
  if (diatonicPosition >= 10) {
    for (let step = 10; step <= diatonicPosition; step += 2) lines.push(step);
  }
  return lines;
}

function ordinal(n: number): string {
  const names = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
  return names[n - 1] ?? `${n}th`;
}

export function describePosition(pitch: Pitch): string {
  const name = spell(pitch);
  const place = diatonic(pitch);
  if (place === -2 && pitch.step === "C" && pitch.alter === 0) {
    return `${name} is middle C. It sits on the ledger line below the staff.`;
  }
  if (place >= 0 && place <= 8 && place % 2 === 0) {
    const lines = [
      "the bottom line",
      "the second line",
      "the middle line",
      "the fourth line",
      "the top line",
    ];
    return `${name} sits on ${lines[place / 2]} of the treble staff.`;
  }
  if (place >= 1 && place <= 7 && place % 2 === 1) {
    const spaces = [
      "the first space",
      "the second space",
      "the third space",
      "the fourth space",
    ];
    return `${name} sits in ${spaces[(place - 1) / 2]} of the treble staff.`;
  }
  if (place === -1) {
    return `${name} is in the space just below the staff, between middle C and the bottom line.`;
  }
  if (place === 9) {
    return `${name} is in the space just above the staff.`;
  }
  if (place <= -2) {
    const which = Math.floor(-place / 2);
    if (place % 2 === 0) {
      return `${name} sits on the ${ordinal(which)} ledger line below the staff.`;
    }
    return `${name} is below the staff, just under the ${ordinal(which)} ledger line.`;
  }
  const which = Math.floor((place - 8) / 2);
  if (place % 2 === 0) {
    return `${name} sits on the ${ordinal(which)} ledger line above the staff.`;
  }
  return `${name} is above the staff, just over the ${ordinal(which)} ledger line.`;
}

export function quarterLength(duration: Duration): number {
  switch (duration) {
    case "w":
      return 4;
    case "h":
      return 2;
    case "q":
      return 1;
    case "8":
      return 0.5;
  }
}

export interface TimedEvent {
  event: ScoreEvent;
  eventIndex: number;
}

export interface Measure {
  events: TimedEvent[];
  complete: boolean;
}

export function groupMeasures(
  events: ScoreEvent[],
  beats: number,
  beatValue: number,
): Measure[] {
  const capacity = beats * (4 / beatValue);
  const measures: Measure[] = [];
  let current: TimedEvent[] = [];
  let filled = 0;

  const close = (complete: boolean) => {
    measures.push({ events: current, complete });
    current = [];
    filled = 0;
  };

  events.forEach((event, eventIndex) => {
    const length = quarterLength(event.duration);
    if (filled > 0 && filled + length > capacity + 1e-6) close(false);
    current.push({ event, eventIndex });
    filled += length;
    if (Math.abs(filled - capacity) < 1e-6) close(true);
  });

  if (current.length) close(Math.abs(filled - capacity) < 1e-6);
  return measures;
}

export function soundingNotes(events: ScoreEvent[]): { pitch: Pitch; eventIndex: number }[] {
  const notes: { pitch: Pitch; eventIndex: number }[] = [];
  events.forEach((event, eventIndex) => {
    if (event.type === "note") notes.push({ pitch: event.pitch, eventIndex });
  });
  return notes;
}

export function parseMelody(source: string): ScoreEvent[] {
  return source
    .split(/\s+/)
    .filter((token) => token.length > 0 && token !== "|")
    .map(parseToken);
}

function parseToken(token: string): ScoreEvent {
  const rest = /^r([whq8])$/.exec(token);
  if (rest) return { type: "rest", duration: rest[1] as Duration };
  const match = /^([A-G])([#b])?(\d)([whq8])?$/.exec(token);
  if (!match) throw new Error(`Bad melody token: ${token}`);
  const alter: Alter = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return {
    type: "note",
    pitch: {
      step: match[1] as Step,
      alter,
      octave: Number(match[3]),
    },
    duration: (match[4] as Duration | undefined) ?? "q",
  };
}

export interface PianoKey {
  midi: number;
  pitch: Pitch;
  name: string;
  black: boolean;
  shortcut?: string;
}

export function buildKeys(low: number, high: number, shortcuts: Record<number, string> = {}): PianoKey[] {
  const keys: PianoKey[] = [];
  for (let midi = low; midi <= high; midi += 1) {
    const pitch = pitchFromMidi(midi);
    keys.push({
      midi,
      pitch,
      name: spell(pitch),
      black: isBlackMidi(midi),
      shortcut: shortcuts[midi],
    });
  }
  return keys;
}

/** US-layout computer keys, C4 on Z and C5 on Q. */
export const SHORTCUTS: Record<string, number> = {
  KeyZ: 60,
  KeyS: 61,
  KeyX: 62,
  KeyD: 63,
  KeyC: 64,
  KeyV: 65,
  KeyG: 66,
  KeyB: 67,
  KeyH: 68,
  KeyN: 69,
  KeyJ: 70,
  KeyM: 71,
  KeyQ: 72,
  Digit2: 73,
  KeyW: 74,
  Digit3: 75,
  KeyE: 76,
  KeyR: 77,
  Digit5: 78,
  KeyT: 79,
  Digit6: 80,
  KeyY: 81,
  Digit7: 82,
  KeyU: 83,
  KeyI: 84,
  Digit9: 85,
  KeyO: 86,
  Digit0: 87,
  KeyP: 88,
  BracketLeft: 89,
  Equal: 90,
  BracketRight: 91,
};

export function shortcutLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  if (code === "Equal") return "=";
  return code;
}

export const MIDI_TO_SHORTCUT: Record<number, string> = Object.fromEntries(
  Object.entries(SHORTCUTS).map(([code, midi]) => [midi, shortcutLabel(code)]),
);
