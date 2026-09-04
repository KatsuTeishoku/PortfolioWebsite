import type { ReactNode } from "react";

type NumberedLine = { n: string; text: string };

export function NumberedLines({
  lines,
  as: Tag = "div",
  size = "hero",
  className = "",
}: {
  lines: readonly NumberedLine[];
  as?: "div" | "h1" | "h2";
  size?: "hero" | "body";
  className?: string;
}) {
  const textClass =
    size === "hero"
      ? "text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.08] text-foreground"
      : "text-[clamp(1.15rem,2.8vw,1.75rem)] leading-snug text-muted";

  return (
    <Tag className={`font-display font-semibold tracking-tight ${className}`}>
      {lines.map((line) => (
        <span
          key={line.n}
          className="mb-2 flex items-start gap-4 last:mb-0 sm:gap-6"
        >
          <span className="mt-[0.55em] shrink-0 text-[0.7rem] font-medium tracking-[0.22em] text-muted sm:mt-[0.85em] sm:text-sm">
            {line.n}
          </span>
          <span className={textClass}>{line.text}</span>
        </span>
      ))}
    </Tag>
  );
}
