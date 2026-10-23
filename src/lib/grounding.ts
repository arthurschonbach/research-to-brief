// A cheap, judge-free check on the finished brief. It can't tell whether
// a sentence is true, but it catches the two failures that are easiest to
// miss when reading: a finding with no citation, and a number that
// appears in none of the pages it cites (a typo, a unit slip or an
// invented figure).

export interface GroundingIssue {
  kind: "uncited" | "number";
  claim: string;
  detail: string;
}

const MARKER = /\[(\d+)\]/g;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

function markers(text: string): number[] {
  return [...text.matchAll(MARKER)].map((m) => Number(m[1]));
}

/** Digits with thousands separators and odd spaces removed: "1,200" → "1200". */
function normaliseDigits(text: string): string {
  // Plain spaces are left alone: "in 2023 120 firms" is two numbers.
  return text.replace(/(\d)[,\u00a0\u202f](?=\d{3}\b)/g, "$1");
}

/** Numbers worth checking: 2+ digits or a decimal. "3 findings" is skipped. */
export function significantNumbers(sentence: string): string[] {
  const plain = normaliseDigits(sentence.replace(MARKER, " "));
  const found = plain.match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.filter((n) => n.length >= 2 || n.includes(".")))];
}

function containsNumber(source: string, n: string): boolean {
  const escaped = n.replace(".", "[.,]");
  return new RegExp(`(?<![\\d.,])${escaped}(?![\\d]|[.,]\\d)`).test(source);
}

/**
 * `question` numbers are context, not claims: a verdict that repeats
 * "in 2024" from the question needs no source for it.
 */
export function checkGrounding(
  brief: string,
  pages: Array<{ text: string }>,
  question = "",
): GroundingIssue[] {
  const sources = pages.map((p) => normaliseDigits(p.text));
  const given = new Set(significantNumbers(question));
  const issues: GroundingIssue[] = [];

  for (const line of brief.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const lineMarkers = markers(line).filter((n) => n >= 1 && n <= pages.length);

    // Findings are bullets; a substantial one needs at least one source.
    if (BULLET.test(line) && lineMarkers.length === 0 && line.split(/\s+/).length >= 8) {
      issues.push({ kind: "uncited", claim: line, detail: "finding without a citation" });
      continue;
    }

    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      const numbers = significantNumbers(sentence).filter((n) => !given.has(n));
      if (numbers.length === 0) continue;
      // A sentence without its own marker leans on the rest of its line.
      const own = markers(sentence).filter((n) => n >= 1 && n <= pages.length);
      const cited = own.length > 0 ? own : lineMarkers;
      if (cited.length === 0) {
        issues.push({ kind: "uncited", claim: sentence, detail: `figure ${numbers.join(", ")} has no citation` });
        continue;
      }
      const missing = numbers.filter((n) => !cited.some((c) => containsNumber(sources[c - 1], n)));
      if (missing.length > 0) {
        issues.push({
          kind: "number",
          claim: sentence,
          detail: `${missing.join(", ")} not found in ${cited.map((c) => `[${c}]`).join(" ")}`,
        });
      }
    }
  }
  return issues;
}
