import { SectionHeader, SubsectionHeading } from "@/components/sections/SectionHeader";
import { CaseStudy } from "@/components/work/CaseStudy";
import { ExperienceList } from "@/components/work/ExperienceList";
import { caseStudies } from "@/content/site";

export function WorkSection() {
  return (
    <section className="section-enter px-8 py-24 lg:px-16">
      <SectionHeader
        id="work"
        index="02"
        title="Work"
        description="Selected projects and roles. Hover a card to read the write-up."
      />

      <div className="mt-16">
        <div className="text-center">
          <SubsectionHeading>Projects</SubsectionHeading>
        </div>
        <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-5">
          {caseStudies.map((study) => (
            <CaseStudy key={study.id} study={study} />
          ))}
        </div>
      </div>

      <div className="mt-20">
        <div className="text-center">
          <SubsectionHeading>Work Experience</SubsectionHeading>
        </div>
        <div className="mx-auto mt-8 max-w-3xl">
          <ExperienceList />
        </div>
      </div>
    </section>
  );
}
