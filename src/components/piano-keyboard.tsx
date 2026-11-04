"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { shouldReleaseOnPointerLeave } from "@/lib/gestures";
import { buildKeys, MIDI_TO_SHORTCUT, type PianoKey } from "@/lib/music";
import { cn } from "@/lib/utils";

function releaseAfterLeave(trackingMidi: number | undefined, keyMidi: number, event: ReactPointerEvent): boolean {
  const next = event.relatedTarget;
  const enteredAnotherKey = next instanceof Element && next.closest("[data-piano-key]") != null;
  return shouldReleaseOnPointerLeave(trackingMidi, keyMidi, event.buttons, enteredAnotherKey);
}

export function PianoKeyboard({
  lowMidi,
  highMidi,
  pressed,
  targetMidi,
  wrongMidi,
  showNames,
  onPress,
  onRelease,
}: {
  lowMidi: number;
  highMidi: number;
  pressed: ReadonlySet<number>;
  targetMidi: number | null;
  wrongMidi: number | null;
  showNames: boolean;
  onPress: (midi: number) => void;
  onRelease: (midi: number) => void;
}) {
  const keys = buildKeys(lowMidi, highMidi, MIDI_TO_SHORTCUT);
  const whites = keys.filter((key) => !key.black);
  const blacks = keys.filter((key) => key.black);
  const pointers = useRef(new Map<number, number>());
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const releasePointer = (event: PointerEvent) => {
      const midi = pointers.current.get(event.pointerId);
      if (midi == null) return;
      pointers.current.delete(event.pointerId);
      onRelease(midi);
    };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    return () => {
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
    };
  }, [onRelease]);

  useEffect(() => {
    if (targetMidi == null || !scrollerRef.current) return;
    const key = scrollerRef.current.querySelector<HTMLElement>(`#piano-key-${targetMidi}`);
    if (!key) return;
    const parent = scrollerRef.current;
    const keyBox = key.getBoundingClientRect();
    const box = parent.getBoundingClientRect();
    if (keyBox.left < box.left || keyBox.right > box.right) {
      key.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [targetMidi]);

  const pressPointer = (event: ReactPointerEvent, midi: number) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const previous = pointers.current.get(event.pointerId);
    if (previous === midi) return;
    if (previous != null) onRelease(previous);
    pointers.current.set(event.pointerId, midi);
    onPress(midi);
  };

  return (
    <div
      ref={scrollerRef}
      className="overflow-x-auto overscroll-x-contain px-2 pb-3"
      role="group"
      aria-label="Piano keyboard from C4 to C7"
    >
      <div className="relative h-36 w-full sm:h-44" style={{ minWidth: whites.length * 40 }}>
        <div className="absolute inset-0 flex">
          {whites.map((key) => (
            <Key
              key={key.midi}
              pianoKey={key}
              pressed={pressed.has(key.midi)}
              target={targetMidi === key.midi}
              wrong={wrongMidi === key.midi}
              showNames={showNames}
              className="h-full min-w-10 flex-1"
              onPointerDown={(event) => pressPointer(event, key.midi)}
              onPointerEnter={(event) => {
                if (event.buttons !== 1) return;
                pressPointer(event, key.midi);
              }}
              onPointerLeave={(event) => {
                if (!releaseAfterLeave(pointers.current.get(event.pointerId), key.midi, event)) return;
                pointers.current.delete(event.pointerId);
                onRelease(key.midi);
              }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0">
          {blacks.map((key) => {
            const whiteBefore = whites.filter((white) => white.midi < key.midi).length;
            const left = (whiteBefore / whites.length) * 100;
            return (
              <Key
                key={key.midi}
                pianoKey={key}
                pressed={pressed.has(key.midi)}
                target={targetMidi === key.midi}
                wrong={wrongMidi === key.midi}
                showNames={showNames}
                className="pointer-events-auto absolute top-0 h-[62%] -translate-x-1/2"
                style={{ left: `${left}%`, width: `${(0.58 / whites.length) * 100}%` }}
                onPointerDown={(event) => pressPointer(event, key.midi)}
                onPointerEnter={(event) => {
                  if (event.buttons !== 1) return;
                  pressPointer(event, key.midi);
                }}
                onPointerLeave={(event) => {
                  if (!releaseAfterLeave(pointers.current.get(event.pointerId), key.midi, event)) return;
                  pointers.current.delete(event.pointerId);
                  onRelease(key.midi);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Key({
  pianoKey,
  pressed,
  target,
  wrong,
  showNames,
  className,
  style,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  pianoKey: PianoKey;
  pressed: boolean;
  target: boolean;
  wrong: boolean;
  showNames: boolean;
  className?: string;
  style?: CSSProperties;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const label = [pianoKey.name, target ? "play this note" : null].filter(Boolean).join(", ");
  return (
    <button
      id={`piano-key-${pianoKey.midi}`}
      data-piano-key=""
      type="button"
      aria-label={pianoKey.shortcut ? `${label}. Keyboard ${pianoKey.shortcut}` : label}
      aria-pressed={pressed}
      data-pressed={pressed ? "" : undefined}
      data-target={target ? "" : undefined}
      data-wrong={wrong ? "" : undefined}
      style={style}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        "touch-none overflow-hidden select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d89a1a]",
        pianoKey.black
          ? "absolute z-20 rounded-b-md border border-black/70 bg-gradient-to-b from-[#3c3c3c] to-[#141414] shadow-[0_8px_10px_rgba(0,0,0,0.35)] data-pressed:from-[#5a4724] data-pressed:to-[#241c10] data-target:from-[#6b5422] data-target:to-[#2c220f] data-target:ring-2 data-target:ring-[#f0c14b] data-wrong:from-[#6d3030] data-wrong:to-[#3a1414] data-wrong:ring-2 data-wrong:ring-[#e7a09a]"
          : "relative rounded-b-[8px] border border-[#ddd4c6] bg-gradient-to-b from-[#fffefb] to-[#f2ebdf] shadow-[inset_0_-10px_14px_rgba(90,60,20,0.06)] data-pressed:from-[#fff3d4] data-pressed:to-[#efd7a4] data-target:from-[#fff6dc] data-target:to-[#f3ddaa] data-target:ring-2 data-target:ring-[#d89a1a] data-target:z-10 data-wrong:from-[#fde8e4] data-wrong:to-[#f4cdc7] data-wrong:ring-2 data-wrong:ring-[#9f2d2d]",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 flex flex-col items-center",
          pianoKey.black ? "bottom-1 gap-0.5" : "bottom-1.5 gap-1",
        )}
      >
        {showNames ? (
          <span
            className={cn(
              "font-medium leading-none",
              pianoKey.black ? "text-[8px] text-[#f4ecdf] sm:text-[9px]" : "text-[10px] text-[#514b42] sm:text-[11px]",
            )}
          >
            {pianoKey.name}
          </span>
        ) : null}
        {pianoKey.shortcut ? (
          <span
            className={cn(
              "hidden leading-none md:block",
              pianoKey.black ? "text-[9px] text-[#c8beb0]" : "text-[10px] text-[#8d8478]",
            )}
          >
            {pianoKey.shortcut}
          </span>
        ) : null}
      </span>
    </button>
  );
}
