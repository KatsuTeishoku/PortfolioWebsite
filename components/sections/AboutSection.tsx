import { ProfilePhoto } from "@/components/ProfilePhoto";
import { SectionHeader, SubsectionHeading } from "@/components/sections/SectionHeader";
import { about, site } from "@/content/site";

export function AboutSection() {
  return (
    <section className="section-enter px-8 py-24 lg:px-16">
      <SectionHeader
        id="about"
        index="03"
        title="About Me"
        description="Education, research, and the tools I use for firmware and instrumentation."
      />

      <div className="mt-16 flex max-w-3xl flex-col gap-10 sm:flex-row sm:items-start">
        <ProfilePhoto variant="about" />
        <div className="max-w-xl">
          <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {site.name}
          </p>
          <p className="mt-2 text-base leading-relaxed text-muted">{site.title}</p>
          <p className="mt-6 text-lg leading-relaxed text-muted">{about.bio}</p>
        </div>
      </div>

      <div className="mt-16 max-w-3xl">
        <SubsectionHeading>Education</SubsectionHeading>
        <ul className="mt-8 grid gap-4">
          {about.education.map((item) => (
            <li
              key={item.degree}
              className="content-card border-l-2 border-accent py-6 pr-6 pl-6 sm:pl-8"
            >
              <p className="text-sm tracking-wide text-muted tabular-nums">
                {item.dates}
              </p>
              <p className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-[1.5rem]">
                {item.degree}
              </p>
              <p className="mt-2 text-sm text-muted">{item.school}</p>
              {"detail" in item && item.detail ? (
                <p className="mt-3 text-sm text-foreground">{item.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-16 grid max-w-3xl gap-16 lg:grid-cols-2 lg:gap-12">
        <div>
          <SubsectionHeading>Scholarships</SubsectionHeading>
          <ul className="mt-8 space-y-5">
            {about.scholarships.map((item) => (
              <li key={item.name}>
                <p className="text-sm tracking-wide text-muted tabular-nums">
                  {item.dates}
                </p>
                <p className="mt-1 leading-relaxed text-foreground">{item.name}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SubsectionHeading>Skills</SubsectionHeading>
          <dl className="mt-8 grid gap-8">
            {about.skills.map((group) => (
              <div key={group.group}>
                <dt className="font-display text-base font-semibold tracking-tight">
                  {group.group}
                </dt>
                <dd className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="border border-hairline px-2.5 py-1 text-[0.7rem] tracking-wide text-muted"
                    >
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-16 max-w-3xl border-t border-hairline pt-10">
        <SubsectionHeading>Contact</SubsectionHeading>
        <p className="mt-6 text-muted">{site.location}</p>
        <a
          href={`mailto:${site.email}`}
          className="mt-3 inline-block text-foreground transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {site.email}
        </a>
      </div>
    </section>
  );
}
