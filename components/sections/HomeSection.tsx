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
      <h1 className="mt-12 font-display font-semibold tracking-tight text-foreground">
        {home.numbered.map((line) => (
          <span
            key={line.n}
            className="mb-2 flex items-start gap-4 last:mb-0 sm:gap-6"
          >
            <span className="mt-[0.55em] shrink-0 text-[0.7rem] font-medium tracking-[0.22em] text-muted sm:mt-[0.85em] sm:text-sm">
              {line.n}
            </span>
            <span className="text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.08]">
              {line.text}
            </span>
          </span>
        ))}
      </h1>
      <p className="mt-12 max-w-xl text-lg leading-relaxed text-muted">
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
