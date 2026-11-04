"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { layoutScore, timeSignatureCodepoint, type RenderEvent } from "@/lib/engrave";
import type { ScoreEvent } from "@/lib/music";

const COLORS = {
  ink: "#1c1915",
  played: "#8a8176",
  current: "#8a5608",
  halo: "#f0c14b",
};

export function StaffView({
  events,
  beats,
  beatValue,
  currentEventIndex = null,
  dimPlayed = false,
  labelNotes = false,
  ariaLabel,
}: {
  events: ScoreEvent[];
  beats: number;
  beatValue: number;
  currentEventIndex?: number | null;
  dimPlayed?: boolean;
  labelNotes?: boolean;
  ariaLabel: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<SVGGElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const score = useMemo(() => {
    if (width <= 0) return null;
    return layoutScore({
      events,
      beats,
      beatValue,
      width,
      labelNotes,
      currentEventIndex,
      dimPlayed,
    });
  }, [events, beats, beatValue, width, labelNotes, currentEventIndex, dimPlayed]);

  useEffect(() => {
    const note = currentRef.current;
    const scroller = scrollerRef.current;
    if (!note || !scroller) return;
    const noteBox = note.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    const outside = noteBox.left < box.left + 8 || noteBox.right > box.right - 8 || noteBox.top < box.top || noteBox.bottom > box.bottom;
    if (outside) {
      note.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [currentEventIndex, score]);

  return (
    <div ref={scrollerRef} className="w-full min-w-0 overflow-x-auto">
      {score == null ? (
        <div className="animate-pulse px-2 py-6" aria-hidden>
          <div className="space-y-[14px] py-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-px bg-foreground/25" />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Ruling the staff…</p>
        </div>
      ) : (
        <svg
          width={score.width}
          height={score.height}
          role="img"
          aria-label={ariaLabel}
          className="max-w-none"
        >
          {score.systems.map((system, index) => (
            <g key={index}>
              {[0, 1, 2, 3, 4].map((line) => (
                <line
                  key={line}
                  x1={system.staffLeft}
                  x2={system.staffRight}
                  y1={system.topLineY + line * score.space}
                  y2={system.topLineY + line * score.space}
                  stroke={score.ink}
                  strokeWidth={score.staffThickness}
                />
              ))}
              {system.clef ? (
                <Glyph
                  x={system.clef.x}
                  y={system.clef.y}
                  codepoint={system.clef.codepoint}
                  size={score.fontSize}
                  color={score.ink}
                />
              ) : null}
              {system.time ? (
                <>
                  <Glyph
                    x={system.time.x}
                    y={system.time.numeratorY}
                    codepoint={timeSignatureCodepoint(system.time.beats)}
                    size={score.fontSize}
                    color={score.ink}
                  />
                  <Glyph
                    x={system.time.x}
                    y={system.time.denominatorY}
                    codepoint={timeSignatureCodepoint(system.time.beatValue)}
                    size={score.fontSize}
                    color={score.ink}
                  />
                </>
              ) : null}
              {system.measures.map((measure, measureIndex) => (
                <g key={measureIndex}>
                  {measure.events.map((event) => (
                    <NoteGlyph
                      key={event.eventIndex}
                      event={event}
                      fontSize={score.fontSize}
                      currentRef={event.colorRole === "current" ? currentRef : undefined}
                    />
                  ))}
                  {measure.barX != null && measure.finalBar ? (
                    <>
                      <line
                        x1={measure.barX - score.space * 0.42}
                        x2={measure.barX - score.space * 0.42}
                        y1={system.topLineY}
                        y2={system.bottomLineY}
                        stroke={score.ink}
                        strokeWidth={Math.max(1, score.space * 0.12)}
                      />
                      <line
                        x1={measure.barX}
                        x2={measure.barX}
                        y1={system.topLineY}
                        y2={system.bottomLineY}
                        stroke={score.ink}
                        strokeWidth={Math.max(2.5, score.space * 0.4)}
                      />
                    </>
                  ) : null}
                  {measure.barX != null && !measure.finalBar ? (
                    <line
                      x1={measure.barX}
                      x2={measure.barX}
                      y1={system.topLineY}
                      y2={system.bottomLineY}
                      stroke={score.ink}
                      strokeWidth={Math.max(1, score.space * 0.14)}
                    />
                  ) : null}
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function NoteGlyph({
  event,
  fontSize,
  currentRef,
}: {
  event: RenderEvent;
  fontSize: number;
  currentRef?: Ref<SVGGElement>;
}) {
  const color = COLORS[event.colorRole];
  return (
    <g ref={currentRef}>
      {event.colorRole === "current" ? (
        <ellipse
          className="note-halo"
          cx={event.centerX}
          cy={event.baselineY}
          rx={fontSize * 0.28}
          ry={fontSize * 0.26}
          fill={COLORS.halo}
        />
      ) : null}
      {event.ledgers.map((ledger) => (
        <line
          key={ledger.y}
          x1={event.centerX - ledger.halfWidth}
          x2={event.centerX + ledger.halfWidth}
          y1={ledger.y}
          y2={ledger.y}
          stroke={color}
          strokeWidth={Math.max(1, fontSize * 0.035)}
        />
      ))}
      {event.stem ? (
        <rect
          x={event.stem.x}
          y={event.stem.y}
          width={event.stem.width}
          height={event.stem.height}
          fill={color}
        />
      ) : null}
      {event.accidental ? (
        <Glyph
          x={event.accidental.originX}
          y={event.baselineY}
          codepoint={event.accidental.codepoint}
          size={fontSize}
          color={color}
        />
      ) : null}
      <Glyph x={event.originX} y={event.baselineY} codepoint={event.codepoint} size={fontSize} color={color} />
      {event.label && event.labelY != null ? (
        <text
          x={event.centerX}
          y={event.labelY}
          textAnchor="middle"
          fill="#5e574c"
          fontSize={12}
          style={{ fontFamily: "var(--font-outfit), sans-serif" }}
        >
          {event.label}
        </text>
      ) : null}
    </g>
  );
}

function Glyph({
  x,
  y,
  codepoint,
  size,
  color,
}: {
  x: number;
  y: number;
  codepoint: number;
  size: number;
  color: string;
}) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={size}
      aria-hidden
      style={{ fontFamily: "var(--font-music)" }}
    >
      {String.fromCodePoint(codepoint)}
    </text>
  );
}
