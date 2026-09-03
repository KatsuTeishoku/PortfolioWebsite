import type { ReactNode } from "react";

export function SectionHeader({
  id,
  index,
  title,
  description,
}: {
  id?: string;
  index: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <header
      id={id}
      className="max-w-3xl scroll-mt-14 lg:scroll-mt-2"
    >
      <p className="font-display text-sm tracking-[0.22em] text-muted uppercase">
        {index}
      </p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function SubsectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-sm tracking-[0.2em] text-accent uppercase">
      {children}
    </h3>
  );
}
