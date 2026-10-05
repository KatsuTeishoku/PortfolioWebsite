import { experience } from "@/content/site";

export function ExperienceList() {
  return (
    <ol className="relative border-l border-hairline">
      {experience.map((item) => (
        <li
          key={`${item.dates}-${item.title}`}
          className="relative grid gap-1 py-5 pl-8 sm:grid-cols-[15rem_1fr] sm:gap-8"
        >
          <span
            aria-hidden
            className="absolute top-7 left-[-3.5px] h-2 w-2 rounded-full bg-accent"
          />
          <p className="text-lg tracking-wide text-muted tabular-nums">
            {item.dates}
          </p>
          <div>
            <p className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {item.title}
            </p>
            {item.org ? (
              <p className="mt-1 text-lg text-muted">{item.org}</p>
            ) : null}
            {item.detail ? (
              <p className="mt-1 text-lg leading-relaxed text-muted">
                {item.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
