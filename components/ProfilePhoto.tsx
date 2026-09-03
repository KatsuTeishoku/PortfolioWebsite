"use client";

import Image from "next/image";
import { site } from "@/content/site";

const variants = {
  rail: {
    box: "h-28 w-28 rounded-full",
    sizes: "112px",
    object: "object-cover object-[center_18%]",
    priority: true,
  },
  header: {
    box: "h-9 w-9 rounded-full",
    sizes: "36px",
    object: "object-cover object-[center_18%]",
    priority: true,
  },
  about: {
    box: "h-[22rem] w-56 rounded-sm sm:h-[26rem] sm:w-64",
    sizes: "(max-width: 640px) 1024px, 1536px",
    object: "object-cover object-[center_12%]",
    priority: false,
  },
} as const;

export function ProfilePhoto({
  variant,
}: {
  variant: keyof typeof variants;
}) {
  const config = variants[variant];

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-hairline ${config.box}`}
    >
      <Image
        src={site.portrait.src}
        alt={site.portrait.alt}
        fill
        sizes={config.sizes}
        priority={config.priority}
        className={config.object}
      />
    </div>
  );
}
