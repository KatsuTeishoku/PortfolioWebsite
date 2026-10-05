import { ContactEmailLink, ContactMessageButton } from "@/components/ContactChat";
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

      <div className="mx-auto mt-16 flex max-w-3xl flex-col gap-10 sm:flex-row sm:items-start">
        <ProfilePhoto variant="about" />
        <div className="max-w-xl">
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {site.name}
          </p>
          <p className="mt-2 text-lg leading-relaxed text-muted">{site.title}</p>
          <p className="mt-6 text-xl leading-relaxed text-muted">{about.bio}</p>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <SubsectionHeading>Education</SubsectionHeading>
        <ul className="mt-8 grid gap-4">
          {about.education.map((item) => (
            <li
              key={item.degree}
              className="content-card border-l-2 border-accent py-6 pr-6 pl-6 sm:pl-8"
            >
              <p className="text-base tracking-wide text-muted tabular-nums">
                {item.dates}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                {item.degree}
              </p>
              <p className="mt-2 text-base text-muted">{item.school}</p>
              {"detail" in item && item.detail ? (
                <p className="mt-3 text-base leading-relaxed text-foreground">{item.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-16 grid max-w-3xl gap-16 lg:grid-cols-2 lg:gap-12">
        <div>
          <SubsectionHeading>Scholarships</SubsectionHeading>
          <ul className="mt-8 space-y-5">
            {about.scholarships.map((item) => (
              <li key={item.name}>
                <p className="text-base tracking-wide text-muted tabular-nums">
                  {item.dates}
                </p>
                <p className="mt-1 text-lg leading-relaxed text-foreground">{item.name}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SubsectionHeading>Skills</SubsectionHeading>
          <dl className="mt-8 grid gap-8">
            {about.skills.map((group) => (
              <div key={group.group}>
                <dt className="font-display text-lg font-semibold tracking-tight">
                  {group.group}
                </dt>
                <dd className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="border border-hairline px-3 py-1.5 text-sm tracking-wide text-muted"
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

      <div className="mt-20">
        <div className="-mx-8 lg:-mx-16">
          <div className="h-px bg-gradient-to-r from-transparent via-hairline to-transparent" />
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center pt-12 text-center">
          <SubsectionHeading>Contact</SubsectionHeading>
          <p className="mt-4 text-lg text-muted">{site.location}</p>
          <ContactEmailLink className="mt-2 text-lg text-foreground transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" />
          <ContactMessageButton className="mt-7 inline-flex items-center border border-accent px-4 py-2 font-display text-sm tracking-wide text-accent transition-colors hover:bg-accent hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" />
        </div>
      </div>
    </section>
  );
}
