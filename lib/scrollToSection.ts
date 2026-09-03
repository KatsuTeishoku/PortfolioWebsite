export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Desktop has no top bar; mobile header is h-14 (56px). */
export function sectionScrollOffset(): number {
  if (typeof window === "undefined") return 0;
  return window.matchMedia("(min-width: 1024px)").matches ? 8 : 56;
}

export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const top =
    el.getBoundingClientRect().top + window.scrollY - sectionScrollOffset();

  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });

  if (window.history.replaceState) {
    window.history.replaceState(null, "", `#${id}`);
  }
}
