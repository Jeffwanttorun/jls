export const trustLabels = {
  "personal-experience": {
    label: "Based on Jeff’s personal experience",
    description: "Jeff has written this from his own experience of living in Wuyishan.",
  },
  "checked-on-location": {
    label: "Checked in person by Jeff",
    description: "Jeff checked this information during a visit to the place on this page.",
  },
  "official-information": {
    label: "Based on official information",
    description: "This detail comes from an official operator or public source.",
  },
  "research-in-progress": {
    label: "Ongoing research",
    description: "This website is an ongoing project sharing Wuyishan through research, stories, and personal exploration.",
  },
  "reconfirm-before-travel": {
    label: "Recheck before you go",
    description: "Access, schedules, rules, or conditions may change. Check the latest details before your visit.",
  },
} as const;

export type TrustStatus = keyof typeof trustLabels;
export const undocumentedLabel = "To be confirmed by Jeff.";
