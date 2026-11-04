/**
 * Screen engraving for a single treble-clef line.
 * Glyph metrics are from Bravura 1.482 (SMuFL): one em is four staff spaces,
 * noteheads are centered on the baseline, and stem anchors are stemUpSE / stemDownNW.
 */

import {
  diatonic,
  groupMeasures,
  ledgerSteps,
  spell,
  type Duration,
  type Measure,
  type ScoreEvent,
} from "./music";

const INK = "#1c1915";

const GLYPH = {
  clef: 0xe050,
  whole: 0xe0a2,
  half: 0xe0a3,
  black: 0xe0a4,
  sharp: 0xe262,
  flat: 0xe260,
  restWhole: 0xe4e3,
  restHalf: 0xe4e4,
  restQuarter: 0xe4e5,
  restEighth: 0xe4e6,
} as const;

export interface RenderLedger {
  y: number;
  halfWidth: number;
}

export interface RenderStem {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderEvent {
  eventIndex: number;
  kind: "note" | "rest";
  centerX: number;
  baselineY: number;
  originX: number;
  codepoint: number;
  colorRole: "ink" | "played" | "current";
  accidental?: { originX: number; codepoint: number };
  stem?: RenderStem;
  ledgers: RenderLedger[];
  label?: string;
  labelY?: number;
}

export interface RenderMeasure {
  events: RenderEvent[];
  barX: number | null;
  finalBar: boolean;
}

export interface RenderSystem {
  topLineY: number;
  bottomLineY: number;
  staffLeft: number;
  staffRight: number;
  clef?: { x: number; y: number; codepoint: number };
  time?: { x: number; numeratorY: number; denominatorY: number; beats: number; beatValue: number };
  measures: RenderMeasure[];
}

export interface RenderScore {
  width: number;
  height: number;
  space: number;
  fontSize: number;
  staffThickness: number;
  systems: RenderSystem[];
  ink: string;
}

export function layoutScore(options: {
  events: ScoreEvent[];
  beats: number;
  beatValue: number;
  width: number;
  labelNotes?: boolean;
  currentEventIndex?: number | null;
  dimPlayed?: boolean;
}): RenderScore {
  const space = options.width < 560 ? 12 : 14;
  const ss = (value: number) => value * space;
  const measures = groupMeasures(options.events, options.beats, options.beatValue);
  const available = Math.max(options.width, ss(12));

  const lines = wrapMeasures(measures, available, space);
  const systems: RenderSystem[] = [];
  let cursorY = 0;

  lines.forEach((line, lineIndex) => {
    const showTime = lineIndex === 0;
    const events = line.flatMap((measure) => measure.events.map((item) => item.event));
    const { minD, maxD } = extents(events);
    const above = Math.max(1.85, (maxD - 8) * 0.5 + 0.75 + (options.labelNotes ? 1.7 : 0));
    const below = Math.max(2.15, (0 - minD) * 0.5 + 0.75);
    const topLineY = cursorY + above * space;
    const bottomLineY = topLineY + 4 * space;
    const yOf = (step: number) => bottomLineY - step * (space / 2);

    let x = ss(0.4);
    const clef = { x, y: yOf(2), codepoint: GLYPH.clef };
    x += ss(3.05);
    let time: RenderSystem["time"];
    if (showTime) {
      const center = x + ss(2.35) / 2;
      time = {
        x: center - ss(0.94),
        numeratorY: yOf(6),
        denominatorY: yOf(2),
        beats: options.beats,
        beatValue: options.beatValue,
      };
      x += ss(2.35);
    }

    const naturalWidth =
      x +
      line.reduce((sum, measure) => sum + measureWidth(measure, space), 0);
    const extra = Math.max(0, Math.min(line.length * ss(4.5), available - naturalWidth - ss(0.4)));
    const share = line.length ? extra / line.length : 0;

    const rendered: RenderMeasure[] = [];
    line.forEach((measure, measureIndex) => {
      const width = measureWidth(measure, space) + share;
      let noteX = x + ss(0.8);
      const drawEvents: RenderEvent[] = [];
      for (const timed of measure.events) {
        const placed = placeEvent(timed.event, timed.eventIndex, noteX, yOf, space, {
          labelNotes: options.labelNotes ?? false,
          topLineY,
          currentEventIndex: options.currentEventIndex ?? null,
          dimPlayed: options.dimPlayed ?? false,
        });
        drawEvents.push(placed);
        noteX += spanWidth(timed.event, space);
      }
      const isLast = lineIndex === lines.length - 1 && measureIndex === line.length - 1;
      const barX = measure.complete ? x + width : null;
      rendered.push({
        events: drawEvents,
        barX,
        finalBar: Boolean(barX) && isLast && measure.complete,
      });
      x += width;
    });

    const staffRight = Math.max(x + ss(0.35), available);
    systems.push({
      topLineY,
      bottomLineY,
      staffLeft: ss(0.15),
      staffRight,
      clef,
      time,
      measures: rendered,
    });
    cursorY = bottomLineY + below * space + ss(1.15);
  });

  if (systems.length === 0) {
    const above = 1.85;
    const below = 2.15;
    const topLineY = above * space;
    const bottomLineY = topLineY + 4 * space;
    const yOf = (step: number) => bottomLineY - step * (space / 2);
    let x = ss(0.4);
    const clef = { x, y: yOf(2), codepoint: GLYPH.clef };
    x += ss(3.05);
    const center = x + ss(2.35) / 2;
    systems.push({
      topLineY,
      bottomLineY,
      staffLeft: ss(0.15),
      staffRight: available,
      clef,
      time: {
        x: center - ss(0.94),
        numeratorY: yOf(6),
        denominatorY: yOf(2),
        beats: options.beats,
        beatValue: options.beatValue,
      },
      measures: [],
    });
    cursorY = bottomLineY + below * space + ss(0.4);
  }

  const width = Math.max(available, ...systems.map((system) => system.staffRight));
  return {
    width,
    height: Math.max(cursorY, ss(8)),
    space,
    fontSize: space * 4,
    staffThickness: Math.max(1, space * 0.11),
    systems,
    ink: INK,
  };
}

function wrapMeasures(measures: Measure[], available: number, space: number): Measure[][] {
  if (measures.length === 0) return [];
  const lines: Measure[][] = [];
  let line: Measure[] = [];
  let used = prefixWidth(true, space);
  measures.forEach((measure) => {
    const width = measureWidth(measure, space);
    if (line.length > 0 && used + width > available) {
      lines.push(line);
      line = [];
      used = prefixWidth(false, space);
    }
    line.push(measure);
    used += width;
  });
  if (line.length) lines.push(line);
  return lines;
}

function prefixWidth(withTime: boolean, space: number): number {
  return (0.4 + 3.05 + (withTime ? 2.35 : 0)) * space;
}

function measureWidth(measure: Measure, space: number): number {
  const notes = measure.events.reduce((sum, timed) => sum + spanWidth(timed.event, space), 0);
  return notes + (0.8 + 0.7) * space;
}

function spanWidth(event: ScoreEvent, space: number): number {
  const alter = event.type === "note" && event.pitch.alter !== 0;
  const pre = alter ? 1.4 : 0;
  const head = event.type === "note" && event.duration === "w" ? 1.688 : event.type === "rest" ? 1.15 : 1.18;
  const post = { w: 2.2, h: 1.45, q: 1.05, "8": 0.6 }[event.duration];
  return (pre + head + post) * space;
}

function extents(events: ScoreEvent[]): { minD: number; maxD: number } {
  let minD = 0;
  let maxD = 8;
  for (const event of events) {
    if (event.type !== "note") continue;
    const place = diatonic(event.pitch);
    minD = Math.min(minD, place);
    maxD = Math.max(maxD, place);
  }
  return { minD, maxD };
}

function placeEvent(
  event: ScoreEvent,
  eventIndex: number,
  cursor: number,
  yOf: (step: number) => number,
  space: number,
  options: {
    labelNotes: boolean;
    topLineY: number;
    currentEventIndex: number | null;
    dimPlayed: boolean;
  },
): RenderEvent {
  const role = colorRole(eventIndex, options.currentEventIndex, options.dimPlayed);
  if (event.type === "rest") {
    const place = event.duration === "w" ? 6 : 4;
    const head = 1.15 * space;
    const centerX = cursor + head / 2;
    return {
      eventIndex,
      kind: "rest",
      centerX,
      baselineY: yOf(place),
      originX: centerX - 0.56 * space,
      codepoint: restGlyph(event.duration),
      colorRole: role,
      ledgers: [],
    };
  }

  const place = diatonic(event.pitch);
  const baselineY = yOf(place);
  let local = cursor;
  let accidental: RenderEvent["accidental"];
  if (event.pitch.alter !== 0) {
    accidental = {
      originX: local,
      codepoint: event.pitch.alter === 1 ? GLYPH.sharp : GLYPH.flat,
    };
    local += 1.4 * space;
  }
  const whole = event.duration === "w";
  const headSs = whole ? 1.688 : 1.18;
  const originX = local;
  const centerX = originX + (headSs / 2) * space;
  const ledgers = ledgerSteps(place).map((step) => ({
    y: yOf(step),
    halfWidth: (headSs / 2) * space + 0.4 * space,
  }));

  let stem: RenderStem | undefined;
  if (!whole) {
    const stemUp = place < 4;
    const thickness = Math.max(1.25, 0.12 * space);
    const length = Math.max(3.5, Math.abs(place - 4) * 0.5) * space;
    if (stemUp) {
      const anchorX = originX + 1.18 * space;
      const anchorY = baselineY - 0.168 * space;
      stem = { x: anchorX - thickness, y: anchorY - length, width: thickness, height: length };
    } else {
      const anchorY = baselineY + 0.168 * space;
      stem = { x: originX, y: anchorY, width: thickness, height: length };
    }
  }

  const label = options.labelNotes ? spell(event.pitch) : undefined;
  const labelY = label ? Math.min(baselineY - 1.55 * space, options.topLineY - 1.85 * space) : undefined;

  return {
    eventIndex,
    kind: "note",
    centerX,
    baselineY,
    originX,
    codepoint: whole ? GLYPH.whole : event.duration === "h" ? GLYPH.half : GLYPH.black,
    colorRole: role,
    accidental,
    stem,
    ledgers,
    label,
    labelY,
  };
}

function colorRole(
  eventIndex: number,
  current: number | null,
  dimPlayed: boolean,
): RenderEvent["colorRole"] {
  if (current == null) return "ink";
  if (eventIndex === current) return "current";
  if (dimPlayed && eventIndex < current) return "played";
  return "ink";
}

function restGlyph(duration: Duration): number {
  switch (duration) {
    case "w":
      return GLYPH.restWhole;
    case "h":
      return GLYPH.restHalf;
    case "q":
      return GLYPH.restQuarter;
    case "8":
      return GLYPH.restEighth;
  }
}

export function timeSignatureCodepoint(digit: number): number {
  return 0xe080 + digit;
}
