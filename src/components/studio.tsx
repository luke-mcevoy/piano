"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HarmonicsPanel } from "@/components/harmonics-panel";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { StaffView } from "@/components/staff-view";
import { getSynth } from "@/lib/audio";
import {
  HIGH_MIDI,
  LOW_MIDI,
  SHORTCUTS,
  describePosition,
  enharmonicName,
  midiOf,
  pitchFromMidi,
  soundingNotes,
  spell,
  type Pitch,
  type ScoreEvent,
} from "@/lib/music";
import { pieces } from "@/lib/pieces";
import { cn } from "@/lib/utils";

type Mode = "play" | "practice";

export function Studio() {
  const [mode, setMode] = useState<Mode>("play");
  const [showNames, setShowNames] = useState(true);
  const [sustain, setSustain] = useState(false);
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set());
  const [written, setWritten] = useState<ScoreEvent[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastPitch, setLastPitch] = useState<Pitch | null>(null);
  const [pieceId, setPieceId] = useState(pieces[0].id);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [message, setMessage] = useState("Play the highlighted note. The glowing key is the one to press.");
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [soundingMidi, setSoundingMidi] = useState<number | null>(null);

  const holders = useRef(new Map<number, number>());
  const order = useRef<number[]>([]);
  const piece = pieces.find((item) => item.id === pieceId) ?? pieces[0];
  const notes = useMemo(() => soundingNotes(piece.events), [piece]);
  const done = index >= notes.length;
  const target = done ? null : notes[index];
  const targetMidi = target ? midiOf(target.pitch) : null;

  useEffect(() => {
    getSynth().setPedal(sustain);
  }, [sustain]);

  const syncPressed = useCallback(() => {
    setPressed(new Set(holders.current.keys()));
  }, []);

  const releaseMidi = useCallback(
    (midi: number) => {
      const count = holders.current.get(midi) ?? 0;
      if (count <= 1) holders.current.delete(midi);
      else holders.current.set(midi, count - 1);
      if (count === 1) {
        getSynth().noteOff(midi);
        syncPressed();
        setSoundingMidi((current) => (current === midi ? latestHeld(holders.current, order.current) : current));
      }
    },
    [syncPressed],
  );

  const pressMidi = useCallback(
    (midi: number) => {
      const count = holders.current.get(midi) ?? 0;
      holders.current.set(midi, count + 1);
      if (count > 0) return;
      order.current = order.current.filter((value) => value !== midi).concat(midi);
      getSynth().noteOn(midi);
      setSoundingMidi(midi);
      syncPressed();

      const pitch = pitchFromMidi(midi);
      if (mode === "play") {
        setLastPitch(pitch);
        setSessionCount((value) => value + 1);
        setWritten((previous) =>
          [...previous, { type: "note", pitch, duration: "q" } satisfies ScoreEvent].slice(-16),
        );
        return;
      }
      if (done || !target) return;
      if (midiOf(target.pitch) === midi) {
        setIndex((value) => value + 1);
        setMessage(`Yes — ${spell(target.pitch)}.`);
        setWrongMidi(null);
      } else {
        setMistakes((value) => value + 1);
        setWrongMidi(midi);
        window.setTimeout(() => {
          setWrongMidi((current) => (current === midi ? null : current));
        }, 480);
        setMessage(`That's ${spell(pitch)}. The highlighted note is ${spell(target.pitch)}.`);
      }
    },
    [done, mode, syncPressed, target],
  );

  const releaseAll = useCallback(() => {
    holders.current.clear();
    getSynth().silence();
    setSoundingMidi(null);
    syncPressed();
  }, [syncPressed]);

  const pressRef = useRef(pressMidi);
  const releaseRef = useRef(releaseMidi);
  const releaseAllRef = useRef(releaseAll);
  useEffect(() => {
    pressRef.current = pressMidi;
    releaseRef.current = releaseMidi;
    releaseAllRef.current = releaseAll;
  });

  useEffect(() => {
    const down = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const midi = SHORTCUTS[event.code];
      if (midi == null) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      if (down.has(event.code)) return;
      down.add(event.code);
      pressRef.current(midi);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!down.delete(event.code)) return;
      const midi = SHORTCUTS[event.code];
      if (midi == null) return;
      releaseRef.current(midi);
    };
    const onBlur = () => {
      down.clear();
      releaseAllRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      // Only on unmount. Rebinding used to run this after every correct
      // practice note and cut the tone off before the attack was audible.
      getSynth().silence();
    };
  }, []);

  const heldPitch = soundingMidi == null || !pressed.has(soundingMidi) ? null : pitchFromMidi(soundingMidi);
  const physicsPitch = heldPitch ?? (mode === "practice" && target ? target.pitch : lastPitch);
  const physicsContext = heldPitch ? "sounding" : mode === "practice" && target ? "next" : lastPitch ? "last" : "empty";

  function selectPiece(id: string) {
    setPieceId(id);
    setIndex(0);
    setMistakes(0);
    setWrongMidi(null);
    setMessage("Play the highlighted note. The glowing key is the one to press.");
  }

  function hear() {
    if (!target) return;
    getSynth().preview(midiOf(target.pitch));
  }

  function skip() {
    if (!target) return;
    getSynth().preview(midiOf(target.pitch));
    setMessage(`Skipped ${spell(target.pitch)}.`);
    setWrongMidi(null);
    setIndex((value) => value + 1);
  }

  const nextPiece = pieces[pieces.findIndex((item) => item.id === piece.id) + 1];
  const playAria =
    written.length === 0
      ? "Empty treble staff in four four. Play a key to write a quarter note."
      : `Treble staff with the last ${written.length} notes you played.`;
  const practiceAria = done
    ? `You finished ${piece.title}.`
    : `Treble staff for ${piece.title}. Current note ${target ? spell(target.pitch) : ""}, ${Math.min(index + 1, notes.length)} of ${notes.length}.`;

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border/80 bg-[#fffdf8]/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Staff reading</p>
            <h1 className="font-heading text-4xl tracking-tight text-foreground">Ledger</h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Play a real pitch and watch it land on the staff. Then read a melody and press the key it points to.
          </p>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.72fr)]">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "play" || value === "practice") {
                releaseAll();
                setMode(value);
              }
            }}
          >
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="play" className="px-4">
                Play
              </TabsTrigger>
              <TabsTrigger value="practice" className="px-4">
                Practice
              </TabsTrigger>
            </TabsList>

            <TabsContent value="play" className="mt-3 flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{lastPitch ? spell(lastPitch) : "The page is blank"}</CardTitle>
                  <CardDescription>
                    {lastPitch ? (
                      <>
                        {describePosition(lastPitch)}
                        {enharmonicName(lastPitch) ? ` Same pitch as ${enharmonicName(lastPitch)}.` : ""}
                      </>
                    ) : (
                      "Press any key — mouse, touch, or the letter row. Z is middle C. Each press is written as a quarter note in 4/4."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <StaffView events={written} beats={4} beatValue={4} labelNotes ariaLabel={playAria} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <p>
                      {sessionCount === 0
                        ? "Nothing written yet."
                        : `${sessionCount} ${sessionCount === 1 ? "note" : "notes"} this session. The page keeps the latest four measures.`}
                      {sessionCount > written.length ? " Earlier notes have rolled off." : ""}
                    </p>
                    <Button type="button" variant="outline" onClick={() => { setWritten([]); setLastPitch(null); }} disabled={written.length === 0}>
                      Clear the staff
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="practice" className="mt-3 flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {pieces.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === piece.id}
                    onClick={() => selectPiece(item.id)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-left ring-1 transition",
                      item.id === piece.id
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-card text-foreground ring-foreground/10 hover:bg-muted",
                    )}
                  >
                    <span className="block font-medium">{item.title}</span>
                    <span className={cn("mt-0.5 block text-xs", item.id === piece.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {item.credit} · {item.level} · {soundingNotes(item.events).length} notes
                    </span>
                  </button>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{piece.title}</CardTitle>
                  <CardDescription>{piece.blurb}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {done ? `All ${notes.length} notes` : `Note ${index + 1} of ${notes.length}`}
                    </Badge>
                    <Badge variant={mistakes > 0 ? "destructive" : "outline"}>
                      {mistakes} {mistakes === 1 ? "miss" : "misses"}
                    </Badge>
                  </div>
                  <Progress value={notes.length === 0 ? 0 : (Math.min(index, notes.length) / notes.length) * 100} aria-label="Practice progress" />
                  <p className="sr-only" aria-live="polite">
                    {done ? `You finished ${piece.title} with ${mistakes} misses.` : message}
                  </p>
                  {done ? (
                    <div className="rounded-xl bg-[#e7f2ea] px-4 py-3 text-[#14382c] ring-1 ring-[#1e4a3a]/20">
                      <p className="font-heading text-xl">You read every note of {piece.title}.</p>
                      <p className="mt-1 text-sm">
                        {mistakes === 0 ? "No misses — clean reading." : `${mistakes} ${mistakes === 1 ? "miss" : "misses"} along the way.`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" onClick={() => selectPiece(piece.id)}>
                          Play it again
                        </Button>
                        {nextPiece ? (
                          <Button type="button" variant="outline" onClick={() => selectPiece(nextPiece.id)}>
                            Next: {nextPiece.title}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">{message}</p>
                  )}
                  <StaffView
                    events={piece.events}
                    beats={piece.time.beats}
                    beatValue={piece.time.beatValue}
                    currentEventIndex={done ? null : target?.eventIndex ?? null}
                    dimPlayed={!done}
                    ariaLabel={practiceAria}
                  />
                  {!done ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={hear}>
                        Hear the note
                      </Button>
                      <Button type="button" variant="outline" onClick={skip}>
                        Skip
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => selectPiece(piece.id)}>
                        Start over
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <HarmonicsPanel
            pitch={physicsPitch}
            context={physicsContext}
            expected={mode === "practice" && heldPitch && target ? target.pitch : null}
          />
          </div>

          <details className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
            <summary className="cursor-pointer font-medium text-foreground">How the staff works</summary>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>Lines, bottom to top: E4, G4, B4, D5, F5. The sentence people memorize is “Every Good Bird Does Fly.”</p>
              <p>Spaces, bottom to top: F4, A4, C5, E5 — F, A, C, E.</p>
              <p>Middle C, C4, hangs on a short ledger line just under the staff. D4 is the space between that line and the bottom line. Notes above F5 grow ledger lines of their own.</p>
              <p>A sharp raises the note by one key, a flat lowers it. On this piano those are the black keys, and Play writes them with a sharp.</p>
              <p>Stems point up when the note is below the middle line, and down when it sits on the middle line or above.</p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground">{`C4  C♯ D4  D♯ E4 F4  F♯ G4  G♯ A4  A♯ B4
Z   S  X   D  C  V   G  B   H  N   J  M

C5  C♯ D5  D♯ E5 F5  F♯ G5  G♯ A5  A♯ B5 C6
Q   2  W   3  E  R   5  T   6  Y   7  U  I`}</pre>
              <p>Past C6: 9 is C♯6, O is D6, 0 is D♯6, P is E6, [ is F6, = is F♯6, ] is G6. The last few keys, up to C7, are for the mouse or a finger.</p>
            </div>
          </details>
          <p className="pb-2 text-xs text-muted-foreground">
            Notation is set in Bravura by Steinberg, under the SIL Open Font License. Pitches are equal temperament, A4 = 440 Hz.
          </p>
        </div>
      </main>

      <footer className="shrink-0 border-t border-black/40 bg-[#2a1c12] text-[#f6efe4]">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
            <p>Z is C4, middle C · Q is C5 · swipe the keys if one sits off screen</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <Switch checked={showNames} onCheckedChange={setShowNames} aria-label="Show note names" />
                Note names
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={sustain} onCheckedChange={setSustain} aria-label="Sustain pedal" />
                Sustain
              </label>
            </div>
          </div>
          <div className="mx-3 mb-1 h-1.5 rounded-sm bg-[#6e1d22] sm:mx-5" />
          <PianoKeyboard
            lowMidi={LOW_MIDI}
            highMidi={HIGH_MIDI}
            pressed={pressed}
            targetMidi={mode === "practice" ? targetMidi : null}
            wrongMidi={mode === "practice" ? wrongMidi : null}
            showNames={showNames}
            onPress={pressMidi}
            onRelease={releaseMidi}
          />
        </div>
      </footer>
    </div>
  );
}

function latestHeld(held: ReadonlyMap<number, number>, playedOrder: number[]): number | null {
  for (let index = playedOrder.length - 1; index >= 0; index -= 1) {
    const midi = playedOrder[index];
    if ((held.get(midi) ?? 0) > 0) return midi;
  }
  return null;
}
