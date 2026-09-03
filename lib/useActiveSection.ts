"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sectionIds, type SectionId } from "@/content/site";
import { scrollToSection } from "@/lib/scrollToSection";

function isSectionId(
  value: string,
  ids: readonly SectionId[],
): value is SectionId {
  return ids.includes(value as SectionId);
}

function pickActiveSection(ids: readonly SectionId[]): SectionId {
  const last = ids[ids.length - 1] ?? "home";
  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 8;
  if (nearBottom) return last;

  const line = Math.min(160, window.innerHeight * 0.28);
  let current: SectionId = ids[0] ?? "home";

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= line) current = id;
  }

  return current;
}

export function useActiveSection(ids: readonly SectionId[] = sectionIds) {
  const [activeId, setActiveId] = useState<SectionId>(ids[0] ?? "home");
  const lockedId = useRef<SectionId | null>(null);
  const unlockTimer = useRef<number>(0);
  const key = ids.join();

  const syncFromScroll = useCallback(() => {
    if (lockedId.current) return;
    setActiveId(pickActiveSection(ids));
  }, [ids]);

  const navigateTo = useCallback(
    (id: SectionId) => {
      lockedId.current = id;
      setActiveId(id);
      scrollToSection(id);
      window.clearTimeout(unlockTimer.current);
      unlockTimer.current = window.setTimeout(() => {
        lockedId.current = null;
      }, 1200);
    },
    [],
  );

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (isSectionId(hash, ids)) setActiveId(hash);
    else syncFromScroll();

    const unlock = () => {
      lockedId.current = null;
      window.clearTimeout(unlockTimer.current);
      setActiveId(pickActiveSection(ids));
    };

    window.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("scrollend", unlock);
    window.addEventListener("resize", syncFromScroll);

    return () => {
      window.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("scrollend", unlock);
      window.removeEventListener("resize", syncFromScroll);
      window.clearTimeout(unlockTimer.current);
    };
  }, [ids, key, syncFromScroll]);

  return { activeId, navigateTo };
}
