"use client";

import {
  formatHz,
  frequencyOf,
  harmonicSeries,
  spell,
  enharmonicName,
  type Pitch,
} from "@/lib/music";

export function HarmonicsPanel({
  pitch,
  context,
  expected,
}: {
  pitch: Pitch | null;
  context: "sounding" | "next" | "last" | "empty";
  expected?: Pitch | null;
}) {
  if (!pitch || context === "empty") {
    return (
      <section className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10" aria-label="Harmonic series">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Harmonic series</p>
        <h2 className="mt-1 font-heading text-2xl text-foreground">Play a key</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each pitch has a fundamental frequency, f₀, and a stack of quieter overtones at 2f₀, 3f₀, 4f₀, and so on.
          The chart appears as soon as a note is sounding — or, in Practice, for the note the staff is asking for.
        </p>
      </section>
    );
  }

  const fundamental = frequencyOf(pitch);
  const series = harmonicSeries(fundamental);
  const name = spell(pitch);
  const alias = enharmonicName(pitch);
  const contextLine =
    context === "sounding"
      ? "This is the pitch you are hearing."
      : context === "next"
        ? "This is the highlighted note. Press the glowing key and the same frequencies will sound."
        : "The last note you played.";
  const mismatch = expected && spell(expected) !== name;

  return (
    <section
      className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-21.25rem)] lg:overflow-y-auto"
      aria-label={`Harmonic series of ${name}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Harmonic series</p>
          <h2 className="mt-1 font-heading text-3xl tracking-tight text-foreground">
            {name}
            {alias ? <span className="ml-2 text-lg font-medium text-muted-foreground">also {alias}</span> : null}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Fundamental f₀</p>
          <p className="font-heading text-3xl tabular-nums tracking-tight text-foreground">{formatHz(fundamental)} Hz</p>
          <p className="text-xs text-muted-foreground">fₙ = n · f₀</p>
        </div>
      </div>

      {mismatch && expected ? (
        <p className="mt-3 text-sm text-[#9f2d2d]">
          You are hearing {name}. The staff is asking for {spell(expected)}.
        </p>
      ) : null}

      <div className="mt-3">
        <div
          className="flex h-20 items-end gap-1 sm:gap-1.5"
          role="img"
          aria-label={`Spectrum of ${name}. Fundamental ${formatHz(fundamental)} hertz, then ${series.length - 1} overtones at whole-number multiples, each labeled with its frequency and a falling amplitude.`}
        >
          {series.map((partial) => (
            <div key={partial.n} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`n = ${partial.n}, ${formatHz(partial.frequency)} Hz`}>
              <div
                className={partial.n === 1 ? "w-full rounded-t-sm bg-[#d89a1a]" : "w-full rounded-t-sm bg-primary"}
                style={{ height: `${Math.max(4, partial.amplitude * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 sm:gap-1.5" aria-hidden>
          {series.map((partial) => (
            <span key={partial.n} className="flex-1 text-center text-[10px] tabular-nums text-muted-foreground sm:text-xs">
              {partial.n === 1 ? "f₀" : partial.n}
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Harmonic number n. Bar height is relative amplitude, 1/n<sup>1.5</sup>. Amber is the fundamental; green bars are overtones.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your ear hears one pitch, the fundamental. The tone color comes from these quieter overtones.
          The sound mixes the twelve partials drawn here, each a sine at n·f₀. A real piano string sits a little sharp of that ideal series.
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4">
        {series.map((partial) => (
          <li key={partial.n} className="flex items-baseline justify-between gap-2 border-b border-border py-0.5 text-xs whitespace-nowrap">
            <span className="font-medium text-foreground">{partial.n === 1 ? "n = 1" : `n = ${partial.n}`}</span>
            <span className="tabular-nums text-muted-foreground">{formatHz(partial.frequency)} Hz</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
