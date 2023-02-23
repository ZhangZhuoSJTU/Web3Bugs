module.exports = [
  "intro",
  "basics",
  {
    type: "category",
    label: "Core Concepts ⚙️",
    items: [
      "concepts/actors",
      "concepts/prect",
      "concepts/markets",
      "concepts/rewards",
      "concepts/risk-minimisation",
    ],
  },
  "tokenomics",
  {
    type: "category",
    label: "Governance 🧑‍⚖️",
    link: { type: 'doc', id: 'governance' },
    items: [
      "governance/glossary",
      "governance/process",
    ]
  },
  "roadmap",
  "simulator",
  "demo",
  "get-involved",
  "faq",
];
