# Ledger

A virtual piano for learning to read music. Play a key and the pitch is written on a treble staff. Or open a beginner piece, follow the highlighted note, and press the key that lights up.

There is also a small physics panel: the fundamental frequency of the note you are hearing (or the note the staff is asking for), and the first twelve harmonics of a simplified piano spectrum.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To use another port:

```bash
npm run dev -- --hostname 127.0.0.1 --port 47231
```

```bash
npm test
npm run lint
```

No account and no database. Sound is generated in the browser with Web Audio.

## Two ways to practice

**Play.** The keyboard is C4 to C7. Mouse, touch, and a computer keyboard all work (Z is middle C, Q is C5). Every press becomes a quarter note in 4/4, with the right staff position, notehead, stem, ledger lines, and accidentals. The page keeps your latest four measures. Note names can be turned on or off, and a sustain switch lets notes ring.

**Practice.** Four built-in pieces, easiest first:

- Hot Cross Buns
- C Major Scale
- Twinkle, Twinkle, Little Star
- Ode to Joy (the opening, in quarter notes)

The current note is highlighted on the staff and the matching piano key glows. The right key advances you. A wrong key is counted and named, and you can hear the note or skip it. Rhythm is written so you can see quarter notes, half notes, and rests; the drill waits for pitch, not timing.

## Harmonics

While a key is held, the panel charts that pitch. In Practice, before you play, it charts the note the staff is asking for. Frequencies are equal temperament with A4 = 440 Hz. Partial *n* is drawn at *n* times the fundamental, with relative amplitude 1/*n*<sup>1.5</sup>. The tone is the same twelve sine partials, so what you hear matches the bars.

## Notation font

Staff glyphs use [Bravura](https://github.com/steinbergmedia/bravura) by Steinberg Media Technologies, licensed under the SIL Open Font License. The license is in `src/fonts/OFL.txt`. The Reserved Font Name is Bravura.
