"use client";

import { useId, type ReactNode } from "react";

export function DetailsDisclosure({
  children,
  open,
  onToggle,
}: {
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();

  return (
    <div className="mt-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="cursor-pointer font-display text-sm tracking-wide text-accent transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Details
        <span className="ml-2 inline-block w-3 text-center text-muted" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`transition-opacity duration-300 ease-out ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
