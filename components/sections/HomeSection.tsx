import { NumberedLines } from "@/components/sections/NumberedLines";
import { home, site } from "@/content/site";

export function HomeSection() {
  return (
    <section
      id="home"
      className="section-enter flex min-h-screen scroll-mt-20 flex-col justify-center px-8 pt-32 pb-24 lg:scroll-mt-8 lg:px-16 lg:py-24"
    >
      <p className="max-w-xl font-display text-sm tracking-[0.22em] text-muted uppercase">
        {site.name}
      </p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        {site.title}
      </p>
      <NumberedLines as="h1" lines={home.numbered} className="mt-12" />
      <p className="mt-12 text-lg leading-relaxed text-muted">
        {home.positioning}
      </p>
      <ul className="mt-10 flex flex-wrap gap-2">
        {home.highlights.map((item) => (
          <li
            key={item}
            className="border border-hairline px-3 py-1.5 text-xs tracking-wide text-muted"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
