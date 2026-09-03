"use client";

import type { ReactNode } from "react";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useActiveSection } from "@/lib/useActiveSection";

export function SiteChrome({ children }: { children: ReactNode }) {
  const { activeId, navigateTo } = useActiveSection();

  return (
    <>
      <Sidebar activeId={activeId} onSelect={navigateTo} />
      <MobileNav activeId={activeId} onSelect={navigateTo} />
      <ThemeToggle className="fixed top-5 right-5 z-50 hidden lg:inline-flex" />
      <main id="content" className="lg:ml-[260px]">
        {children}
      </main>
    </>
  );
}
