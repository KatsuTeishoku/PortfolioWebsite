"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NavLinks, Wordmark } from "@/components/NavLinks";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ThemeToggle } from "@/components/ThemeToggle";
import { site, type SectionId } from "@/content/site";

export function MobileNav({
  activeId,
  onSelect,
}: {
  activeId: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-hairline bg-background/90 px-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ProfilePhoto variant="header" />
          <Wordmark compact onSelect={onSelect} />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Open menu"
          >
            <span className="flex h-3.5 w-5 flex-col justify-between" aria-hidden>
              <span className="block h-px w-full bg-foreground" />
              <span className="block h-px w-full bg-foreground" />
              <span className="block h-px w-full bg-foreground" />
            </span>
          </button>
        </div>
      </header>

      {open ? (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex"
        >
          <div className="relative flex h-full w-[min(100%,20rem)] flex-col bg-rail px-8 py-6">
            <div className="flex items-center justify-between">
              <p
                id={titleId}
                className="font-display text-sm tracking-[0.2em] text-muted"
              >
                Menu
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Close menu"
              >
                <span className="relative block h-4 w-4" aria-hidden>
                  <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 rotate-45 bg-foreground" />
                  <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 -rotate-45 bg-foreground" />
                </span>
              </button>
            </div>
            <nav aria-label="Primary" className="mt-16">
              <NavLinks
                activeId={activeId}
                onSelect={onSelect}
                onNavigate={close}
                variant="overlay"
              />
            </nav>
            <a
              href={`mailto:${site.email}`}
              className="mt-auto pb-8 text-sm text-muted transition-colors hover:text-accent"
            >
              {site.email}
            </a>
          </div>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="h-full flex-1 bg-background/70"
            onClick={close}
          />
        </div>
      ) : null}
    </div>
  );
}
