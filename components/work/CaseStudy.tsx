"use client";

import { useState } from "react";
import { DetailsDisclosure } from "@/components/work/DetailsDisclosure";
import type { CaseStudy as CaseStudyData } from "@/content/site";

export function CaseStudy({ study }: { study: CaseStudyData }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <article
      className="content-card border-l-2 border-accent py-7 pr-6 pl-6 transition-colors sm:pl-8"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setDetailsOpen(true);
      }}
      onPointerLeave={() => setDetailsOpen(false)}
    >
      <h3 className="font-display text-[1.65rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
        {study.title}
      </h3>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-foreground/90">
        {study.summary}
      </p>
      <ul className="mt-4 space-y-2">
        {study.roles.map((role) => (
          <li
            key={`${role.title}-${role.dates}`}
            className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <span className="text-sm text-muted">{role.title}</span>
            <span className="shrink-0 text-sm tracking-wide text-muted tabular-nums">
              {role.dates}
            </span>
          </li>
        ))}
      </ul>
      {study.demos && study.demos.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {study.demos.map((demo) => (
            <a
              key={demo.href}
              href={demo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border border-accent px-3 py-1.5 font-display text-sm tracking-wide text-accent transition-colors hover:bg-accent hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {demo.label}
            </a>
          ))}
        </div>
      ) : null}
      <ul className="mt-5 flex flex-wrap gap-2">
        {study.tech.map((tag) => (
          <li
            key={tag}
            className="border border-hairline px-2.5 py-1 text-[0.7rem] tracking-wide text-muted"
          >
            {tag}
          </li>
        ))}
      </ul>
      <DetailsDisclosure
        open={detailsOpen}
        onToggle={() => setDetailsOpen((current) => !current)}
      >
        <ul className="mt-4 space-y-3 text-[0.95rem] leading-relaxed text-foreground/90">
          {study.bullets.map((bullet) => (
            <li key={bullet} className="pl-4 -indent-4">
              <span className="mr-2 text-accent" aria-hidden>
                —
              </span>
              {bullet}
            </li>
          ))}
        </ul>
        {study.recognition ? (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {study.recognition}
          </p>
        ) : null}
      </DetailsDisclosure>
    </article>
  );
}
