"use client";

import { NavLinks, Wordmark } from "@/components/NavLinks";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { site, type SectionId } from "@/content/site";

export function Sidebar({
  activeId,
  onSelect,
}: {
  activeId: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-[260px] flex-col border-r border-hairline bg-rail lg:flex">
      <div className="flex h-full flex-col justify-between px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <ProfilePhoto variant="rail" />
          <div className="mt-5 w-full">
            <Wordmark align="center" onSelect={onSelect} />
          </div>
        </div>
        <nav aria-label="Primary">
          <NavLinks activeId={activeId} onSelect={onSelect} />
        </nav>
        <div className="flex flex-col items-center gap-3 text-center">
          <a
            href={`mailto:${site.email}`}
            className="text-xs tracking-wide text-muted break-all transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {site.email}
          </a>
          <p className="text-[0.7rem] tracking-wide text-muted">
            Last updated: {site.lastUpdated}
          </p>
        </div>
      </div>
    </aside>
  );
}
