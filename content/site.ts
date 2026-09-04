export const sectionIds = ["home", "work", "about"] as const;
export type SectionId = (typeof sectionIds)[number];

export const nav = [
  { id: "home", label: "Home" },
  { id: "work", label: "Work" },
  { id: "about", label: "About Me" },
] as const satisfies ReadonlyArray<{ id: SectionId; label: string }>;

export const site = {
  name: "Jhaycee Anthony Acain",
  title:
    "Master of Science in Computer Engineering Candidate - Major in Digital Hardware Systems",
  email: "jcworkfiles@gmail.com",
  lastUpdated: "September 3, 2026",
  location: "Liloan, Cebu, Philippines",
  institution: "University of San Carlos",
  portrait: {
    src: "/jhaycee-acain.png",
    alt: "Graduation portrait of Jhaycee Anthony Acain in academic regalia",
  },
} as const;

export const home = {
  numbered: [
    { n: "01", text: "Hello, I'm Jhaycee." },
    { n: "02", text: "I design firmware and instruments" },
    { n: "03", text: "for digital hardware systems." },
  ],
  positioning:
    "I work on embedded firmware, hardware interfaces, and real-time visualization for research instruments. I am a Master of Science in Computer Engineering Candidate - Major in Digital Hardware Systems at the University of San Carlos.",
  highlights: [
    "Cum Laude",
    "University Scholar",
    "Software Automation Engineer",
    "Firmware Developer",
    "3D Modelling/Calibrating/Printing",
    "PCB Engineer"
  ],
} as const;

export type CaseStudyRole = {
  title: string;
  dates: string;
};

export type CaseStudyDemo = {
  label: string;
  href: string;
};

export type CaseStudy = {
  id: string;
  title: string;
  summary: string;
  roles: CaseStudyRole[];
  demos?: CaseStudyDemo[];
  bullets: string[];
  tech: string[];
  recognition?: string;
};

export const caseStudies: CaseStudy[] = [
  {
    id: "lab-in-a-box",
    title: "Lab in A Box (LAB) / LABSoft",
    summary:
      "Portable electronics trainer with high-speed ADC firmware and a browser oscilloscope.",
    roles: [
      {
        title: "Master's Thesis Researcher",
        dates: "Aug 2024 - present",
      },
      {
        title: "Assistant Research Adviser (LAB v3)",
        dates: "Jan 2025 - Dec 2025",
      },
    ],
    demos: [
      {
        label: "Oscilloscope Demo",
        href: "/demo/Oscilloscope.html",
      },
      {
        label: "Function Generator Demo",
        href: "/demo/Function%20Generator.html",
      },
    ],
    bullets: [
      "Wrote low-level C firmware with DMA-driven ADC acquisition for a portable electronics laboratory.",
      "Built a browser oscilloscope in Go, WebGL, and WebSockets for real-time visualization.",
      "Implemented an Analog Circuit Checker in C++/FLTK using cross-correlation and mean squared error.",
      "Coordinated an SPI multi-MCU stack (RP2040 Pico and Raspberry Pi Zero W); UI navigation around 69.67 ms, compared against Analog Discovery 2.",
    ],
    tech: [
      "C",
      "DMA",
      "ADC",
      "Go",
      "WebGL",
      "WebSockets",
      "C++",
      "FLTK",
      "SPI",
      "RP2040",
      "Raspberry Pi Zero W",
    ],
    recognition:
      "1st Runner-Up, 7th Lear Innovation Olympics 2023; NEECECON 2025; RACCETCON 2026; USC URC 2026; JSME RoboMech 2025.",
  },
  {
    id: "machine-status-perceptron",
    title: "Machine-status Perceptron",
    summary:
      "Python perceptron for machine-status decisions, trained on 625 samples.",
    roles: [
      {
        title: "Academic Research Assistant, Emerson Electric Co.",
        dates: "Oct 2024 - May 2025",
      },
    ],
    bullets: [
      "Built a Python perceptron for thresholded machine-status decisions.",
      "Trained and evaluated the model on 625 samples.",
    ],
    tech: ["Python", "Perceptron ANN"],
  },
  {
    id: "automated-laundry",
    title: "Automated laundry service",
    summary:
      "Weight-based laundry automation with cycle-complete notifications.",
    roles: [{ title: "Freelance Software Developer", dates: "2022 - present" }],
    bullets: [
      "C++ hardware with a Node.js backend, JavaScript frontend, and MySQL.",
      "Weight-based costing and cycle notifications.",
    ],
    tech: ["C++", "Node.js", "JavaScript", "MySQL"],
  },
  {
    id: "water-refilling-pos",
    title: "Water-refilling POS",
    summary:
      "Custom point of sale for sales tracking, inventory, and customer management.",
    roles: [{ title: "Freelance Software Developer", dates: "2022 - present" }],
    bullets: [
      "Point-of-sale system in Java with MongoDB.",
      "Sales, inventory, and customer management.",
    ],
    tech: ["Java", "MongoDB"],
  },
  {
    id: "invoice-sales-automation",
    title: "Invoice and sales automation",
    summary:
      "Automated invoice creation and real-time sales data updates.",
    roles: [
      {
        title: "Software Automation Engineer Intern, Techflow.ai",
        dates: "Jan 2024 - May 2024",
      },
    ],
    bullets: [
      "Automated invoice creation and live sales updates.",
      "Validated inputs with regular expressions.",
    ],
    tech: ["RegEx", "Automation"],
  },
];

export type ExperienceItem = {
  dates: string;
  title: string;
  org?: string;
  detail?: string;
};

export const experience: ExperienceItem[] = [
  {
    dates: "Aug 2024 - present",
    title: "Master's Thesis Researcher",
    org: "University of San Carlos",
    detail:
      "Firmware, ADC acquisition, and a browser-based oscilloscope for Lab in a Box / LABSoft.",
  },
  {
    dates: "2025 - present",
    title: "Member",
    org: "Japan Society of Mechanical Engineers (JSME)",
  },
  {
    dates: "Jan 2025 - Dec 2025",
    title: "Assistant Research Adviser",
    org: "University of San Carlos",
    detail:
      "Co-advised undergraduate hardware/software co-design on Lab in a Box (LAB v3).",
  },
  {
    dates: "Oct 2024 - May 2025",
    title: "Academic Research Assistant",
    org: "Emerson Electric Co.",
  },
  {
    dates: "Jan 2024 - May 2024",
    title: "Software Automation Engineer Intern",
    org: "Techflow.ai",
  },
  {
    dates: "2022 - present",
    title: "CpE Lab Staff",
    org: "University of San Carlos",
    detail: "PCB design/assembly and CRA; KiCad, SolidWorks, Bambu.",
  },
  {
    dates: "2022 - present",
    title: "Freelance Software Developer",
    org: "Independent",
    detail:
      "Laundry automation (C++, Node.js, JavaScript, MySQL) and a water-refilling POS (Java, MongoDB).",
  },
  {
    dates: "Aug 2023",
    title: "Academic Research Booth Exhibitor",
    org: "Technology Advocacy (Techvocacy) Expo 2023 - Ramon Aboitiz Foundation Inc.",
    detail:
      "Managed the University of San Carlos research booth and engaged with over 200 attendees.",
  },
];

export const about = {
  bio: "I earned my Bachelor of Science in Computer Engineering at the University of San Carlos (2020-2024) with a GPA of 1.46, graduating Cum Laude. I am continuing at USC as a Master of Science in Computer Engineering Candidate - Major in Digital Hardware Systems (2024-present). Lab staff work and freelance builds led into research on portable electronics instrumentation.",
  education: [
    {
      degree:
        "Master of Science in Computer Engineering Candidate - Major in Digital Hardware Systems",
      school: "University of San Carlos, Talamban, Cebu, Philippines",
      dates: "2024 - present",
    },
    {
      degree: "Bachelor of Science in Computer Engineering",
      school: "University of San Carlos, Talamban, Cebu, Philippines",
      dates: "2020 - 2024",
      detail: "GPA 1.46 · Cum Laude",
    },
  ],
  scholarships: [
    {
      name: "Department of Science and Technology (DOST) - Engineering Research and Development for Technology (ERDT) Scholarship Program",
      dates: "2024 - present",
    },
    {
      name: "Yap Yok, Jr. and Betty Yap School of Engineering Charity Foundation",
      dates: "2022 - 2024",
    },
    {
      name: "Liloan Scholarship Program",
      dates: "2018 - 2024",
    },
  ],
  skills: [
    {
      group: "Languages",
      items: ["C", "C++", "Go", "Java", "JavaScript", "Python"],
    },
    {
      group: "Tools",
      items: [
        "KiCad",
        "SolidWorks",
        "Bambu Studio",
        "FLTK",
        "Node.js",
        "WebGL",
        "WebSockets",
        "MySQL",
        "MongoDB",
        "Raspberry Pi Pico (RP2040)",
        "Raspberry Pi Zero W",
        "RegEx",
      ],
    },
    {
      group: "Domains",
      items: [
        "Embedded firmware",
        "DMA",
        "ADC",
        "SPI",
        "PCB design / assembly",
        "3D printing",
        "Real-time visualization",
        "Perceptron ANN",
      ],
    },
  ],
} as const;
