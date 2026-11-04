import { parseMelody, type ScoreEvent } from "./music";

export interface Piece {
  id: string;
  title: string;
  credit: string;
  level: string;
  blurb: string;
  time: { beats: number; beatValue: number };
  events: ScoreEvent[];
}

export const pieces: Piece[] = [
  {
    id: "hot-cross-buns",
    title: "Hot Cross Buns",
    credit: "Traditional",
    level: "First notes",
    blurb:
      "Three notes, then the same three again. Open noteheads are half notes — they last twice as long on the page. This drill waits for the right pitch, not the right length.",
    time: { beats: 4, beatValue: 4 },
    events: parseMelody(`
      E4 D4 C4h | E4 D4 C4h | C4 C4 C4 C4 | D4 D4 D4 D4 | E4 D4 C4h
    `),
  },
  {
    id: "c-major-scale",
    title: "C Major Scale",
    credit: "Exercise",
    level: "White keys",
    blurb:
      "Eight notes up from middle C, then eight notes back down. The top C is played twice — once to arrive, once to leave. Watch the noteheads climb line, space, line, space.",
    time: { beats: 4, beatValue: 4 },
    events: parseMelody(`
      C4 D4 E4 F4 | G4 A4 B4 C5 | C5 B4 A4 G4 | F4 E4 D4 C4
    `),
  },
  {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    credit: "Traditional",
    level: "Tune",
    blurb:
      "The first tune most pianists learn. The last note of each phrase is a half note: an open notehead, no fill, and a stem.",
    time: { beats: 4, beatValue: 4 },
    events: parseMelody(`
      C4 C4 G4 G4 | A4 A4 G4h | F4 F4 E4 E4 | D4 D4 C4h
      G4 G4 F4 F4 | E4 E4 D4h | G4 G4 F4 F4 | E4 E4 D4h
      C4 C4 G4 G4 | A4 A4 G4h | F4 F4 E4 E4 | D4 D4 C4h
    `),
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    credit: "Ludwig van Beethoven",
    level: "Melody",
    blurb:
      "The opening of the Ninth Symphony, smoothed into quarter notes so the shape is easy to follow. Each phrase ends with a rest — silence on the staff, and the highlight moves on by itself.",
    time: { beats: 4, beatValue: 4 },
    events: parseMelody(`
      E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4 D4 D4 rq
      E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4 C4 C4 rq
    `),
  },
];
