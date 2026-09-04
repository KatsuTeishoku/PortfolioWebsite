"use client";

import { nav, site, type SectionId } from "@/content/site";
import { scrollToSection } from "@/lib/scrollToSection";

type NavLinksProps = {
  activeId: SectionId;
  onSelect: (id: SectionId) => void;
  onNavigate?: () => void;
  variant?: "rail" | "overlay";
};

export function Wordmark({
  onSelect,
  onNavigate,
  compact,
  align = "left",
}: {
  onSelect?: (id: SectionId) => void;
  onNavigate?: () => void;
  compact?: boolean;
  align?: "left" | "center";
}) {
  return (
    <a
      href="#home"
      onClick={(event) => {
        event.preventDefault();
        if (onSelect) onSelect("home");
        else scrollToSection("home");
        onNavigate?.();
      }}
      className={`group block text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
        align === "center" ? "text-center" : ""
      }`}
    >
      <span
        className={`block font-display font-semibold tracking-wide ${
          compact
            ? "max-w-[11rem] text-xs leading-tight"
            : "text-[0.95rem] leading-snug"
        }`}
      >
        {site.name}
      </span>
    </a>
  );
}

export function NavLinks({
  activeId,
  onSelect,
  onNavigate,
  variant = "rail",
}: NavLinksProps) {
  const isOverlay = variant === "overlay";

  return (
    <ul className={isOverlay ? "flex flex-col gap-2" : "flex flex-col gap-1"}>
      {nav.map((item) => {
        const isActive = activeId === item.id;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onSelect(item.id);
                onNavigate?.();
              }}
              className={
                isOverlay
                  ? `block py-3 font-display text-3xl font-semibold tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                      isActive
                        ? "border-l-2 border-accent pl-4 text-foreground"
                        : "border-l-2 border-transparent pl-4 text-muted hover:text-foreground"
                    }`
                  : `flex w-full items-center gap-2 px-4 py-2 text-left font-display text-[calc(0.875rem+12pt)] leading-snug tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                      isActive
                        ? "font-semibold text-foreground"
                        : "font-normal text-muted hover:text-foreground"
                    }`
              }
            >
              {!isOverlay ? (
                <span
                  aria-hidden
                  className={`h-6 w-0.5 shrink-0 rounded-full transition-all duration-200 ${
                    isActive ? "bg-accent" : "bg-transparent"
                  }`}
                />
              ) : null}
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
