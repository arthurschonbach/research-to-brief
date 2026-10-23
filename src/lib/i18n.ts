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
      "Ask a question. The agent plans searches, reads pages, and writes a cited brief, with the whole trace visible.",
    questionLabel: "Research question",
    questionPlaceholder: "What are the cheapest EU options for e-bike insurance?",
    submit: "Research",
    working: "Researching…",
    empty: "No runs yet. Ask a question or load the sample run.",
    sampleButton: "Load sample run",
    emptyQuestion: "Type a question first.",
    runFailed: "Research failed. Try again.",
    retry: "Try again",
    noEvidence: "Nothing fetchable was found. Try a different question.",
    rateLimited: "Research limit reached for now (each run uses paid search credits). Try again later.",
    stopped: "Run stopped. Partial results were saved, see history.",
    citedLabel: "Sources cited",
    viewRun: "View full run →",
    needsKey:
      "Set OPENAI_API_KEY to run live research. The sample run works without a key.",
  },
  guards: {
    title: "Guardrails",
    blocklist: "Never visit these sites (one per line, optional)",
    blocklistPlaceholder: "example.com",
    readonly: "Read-only tools: web search + page fetch. The agent cannot change anything.",
    searchCap: "Max 3 paid searches per run, reading pages is unlimited.",
  },
  trace: {
    title: "Trace",
    plan: "Plan",
    searching: "Searching…",
    searched: "Searched",
    fetching: "Reading…",
    read: "Read",
    skipped: "Skipped (blocked)",
    repeated: "Skipped (repeat)",
    warning: "Warning",
    answer: "Brief",
    cancel: "Cancel run",
    cancelled: "Run stopped. Partial results saved.",
  },
  history: {
    title: "History",
    empty: "No runs yet.",
    back: "← History",
    stepsCount: "{n} actions",
    statusDone: "done",
    statusStopped: "stopped",
    statusFailed: "failed",
    statusRunning: "running",
    stepsCountOne: "1 action",
    delete: "Delete",
    notFound: "Run not found",
    notFoundHint: "Demo history is ephemeral — instances don't share it. Load the sample run to see a full trace.",
  },
  detail: {
    planLabel: "Plan",
    guardsLabel: "Guards",
    guardsMax: "up to {n} pages",
    guardsBlocked: "blocked: {domains}",
    guardsNoneBlocked: "no blocked domains",
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
      "Posez une question. L'agent planifie des recherches, lit des pages et rédige une note citée, avec toute la trace visible.",
    questionLabel: "Question de recherche",
    questionPlaceholder: "Quelles sont les options les moins chères pour assurer un vélo électrique ?",
    submit: "Rechercher",
    working: "Recherche…",
    empty: "Aucun run. Posez une question ou chargez l'exemple.",
    sampleButton: "Charger l'exemple",
    emptyQuestion: "Tapez d'abord une question.",
    runFailed: "Échec de la recherche. Réessayez.",
    retry: "Réessayer",
    noEvidence: "Rien de lisible trouvé. Essayez une autre question.",
    rateLimited: "Limite de recherches atteinte pour l'instant (chaque run consomme des crédits de recherche payants). Réessayez plus tard.",
    stopped: "Run arrêté. Résultats partiels enregistrés, voir l'historique.",
    citedLabel: "Sources citées",
    viewRun: "Voir le run complet →",
    needsKey:
      "Définissez OPENAI_API_KEY pour lancer des recherches. L'exemple fonctionne sans clé.",
  },
  guards: {
    title: "Garde-fous",
    blocklist: "Ne jamais visiter ces sites (un par ligne, facultatif)",
    blocklistPlaceholder: "example.com",
    readonly: "Outils en lecture seule : recherche web + lecture de pages. L'agent ne peut rien modifier.",
    searchCap: "Max 3 recherches payantes par run, lire les pages est illimité.",
  },
  trace: {
    title: "Trace",
    plan: "Plan",
    searching: "Recherche…",
    searched: "Recherché",
    fetching: "Lecture…",
    read: "Lu",
    skipped: "Ignoré (bloqué)",
    repeated: "Ignoré (répétition)",
    warning: "Avertissement",
    answer: "Note",
    cancel: "Arrêter",
    cancelled: "Run arrêté. Résultats partiels enregistrés.",
  },
  history: {
    title: "Historique",
    empty: "Aucun run.",
    back: "← Historique",
    stepsCount: "{n} actions",
    statusDone: "terminé",
    statusStopped: "arrêté",
    statusFailed: "échoué",
    statusRunning: "en cours",
    stepsCountOne: "1 action",
    delete: "Supprimer",
    notFound: "Run introuvable",
    notFoundHint: "L'historique de démo est éphémère — les instances ne le partagent pas. Chargez l'exemple pour voir une trace complète.",
  },
  detail: {
    planLabel: "Plan",
    guardsLabel: "Garde-fous",
    guardsMax: "jusqu'à {n} pages",
    guardsBlocked: "bloqués : {domains}",
    guardsNoneBlocked: "aucun domaine bloqué",
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
