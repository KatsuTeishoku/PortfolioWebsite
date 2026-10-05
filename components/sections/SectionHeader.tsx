import type { ReactNode } from "react";

export function SectionHeader({
  id,
  index,
  title,
  description,
  className = "",
}: {
  id?: string;
  index: string;
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header
      id={id}
      className={`mx-auto max-w-3xl scroll-mt-14 text-center lg:scroll-mt-2 ${className}`.trim()}
    >
      <p className="font-display text-sm tracking-[0.22em] text-muted uppercase">
        {index}
      </p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function SubsectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={
        className ??
        "font-display text-[1.65rem] leading-tight font-semibold tracking-tight text-accent sm:text-[1.85rem]"
      }
    >
      {children}
    </h3>
  );
}
