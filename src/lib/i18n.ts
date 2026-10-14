export type Locale = "en" | "fr";

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "en";

const en = {
  brand: "Research → Brief",
  nav: { new: "New", history: "History" },
  language: { label: "Language", switchTo: "Switch language" },
  footer: {
    disclaimer:
      "Research briefs are drafts from public web sources. Verify facts before acting on them.",
  },
  ask: {
    title: "New research",
    description:
      "Ask a question. The agent plans searches, reads pages, and writes a cited brief — with the whole trace visible.",
    questionLabel: "Research question",
    questionPlaceholder: "What are the cheapest EU options for e-bike insurance?",
    submit: "Research",
    working: "Researching…",
    empty: "No runs yet. Ask a question or load the sample run.",
    sampleButton: "Load sample run",
    needsKey:
      "Set OPENAI_API_KEY to run live research. The sample run works without a key.",
  },
  guards: {
    title: "Guardrails",
    maxSteps: "Max steps",
    blocklist: "Blocked domains (one per line, optional)",
    blocklistPlaceholder: "example.com",
    readonly: "Read-only tools: web search + page fetch. The agent cannot change anything.",
  },
  trace: {
    title: "Trace",
    plan: "Plan",
    searching: "Searching",
    fetching: "Fetching",
    skipped: "Skipped (blocked)",
    warning: "Warning",
    answer: "Brief",
    cancel: "Cancel run",
    cancelled: "Run stopped. Partial results saved.",
  },
  history: {
    title: "History",
    empty: "No runs yet.",
    back: "← History",
    stepsCount: "{n} steps",
  },
  common: { none: "None." },
};

export type Dictionary = typeof en;

const fr: Dictionary = {
  brand: "Research → Brief",
  nav: { new: "Nouveau", history: "Historique" },
  language: { label: "Langue", switchTo: "Changer de langue" },
  footer: {
    disclaimer:
      "Les notes de recherche sont des brouillons issus du web public. Vérifiez les faits avant d'agir.",
  },
  ask: {
    title: "Nouvelle recherche",
    description:
      "Posez une question. L'agent planifie des recherches, lit des pages et rédige une note citée — avec toute la trace visible.",
    questionLabel: "Question de recherche",
    questionPlaceholder: "Quelles sont les options les moins chères pour assurer un vélo électrique ?",
    submit: "Rechercher",
    working: "Recherche…",
    empty: "Aucun run. Posez une question ou chargez l'exemple.",
    sampleButton: "Charger l'exemple",
    needsKey:
      "Définissez OPENAI_API_KEY pour lancer des recherches. L'exemple fonctionne sans clé.",
  },
  guards: {
    title: "Garde-fous",
    maxSteps: "Étapes max",
    blocklist: "Domaines bloqués (un par ligne, facultatif)",
    blocklistPlaceholder: "example.com",
    readonly: "Outils en lecture seule : recherche web + lecture de pages. L'agent ne peut rien modifier.",
  },
  trace: {
    title: "Trace",
    plan: "Plan",
    searching: "Recherche",
    fetching: "Lecture",
    skipped: "Ignoré (bloqué)",
    warning: "Avertissement",
    answer: "Note",
    cancel: "Arrêter",
    cancelled: "Run arrêté. Résultats partiels enregistrés.",
  },
  history: {
    title: "Historique",
    empty: "Aucun run.",
    back: "← Historique",
    stepsCount: "{n} étapes",
  },
  common: { none: "Aucun." },
};

export const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "fr" ? "fr" : "en";
}

export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

export function localeTag(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(typeof value === "string" ? new Date(value) : value);
}
