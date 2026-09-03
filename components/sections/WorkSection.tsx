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
        description="Selected projects and roles. Open Details on a project for the full write-up."
      />

      <div className="mt-16 max-w-3xl">
        <SubsectionHeading>Projects</SubsectionHeading>
        <div className="mt-8 flex flex-col gap-5">
          {caseStudies.map((study) => (
            <CaseStudy key={study.id} study={study} />
          ))}
        </div>
      </div>

      <div className="mt-20 max-w-3xl">
        <SubsectionHeading>Work Experience</SubsectionHeading>
        <div className="mt-8">
          <ExperienceList />
        </div>
      </div>
    </section>
  );
}
