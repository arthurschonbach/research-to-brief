import OpenAI from "openai";
import { z } from "zod";

const BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1";
const MODEL =
  process.env.OPENAI_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";

export function hasChatKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function chatModel(): string {
  return MODEL;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env to run research.");
  }
  client ??= new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    timeout: 120_000,
    maxRetries: 0,
  });
  return client;
}

interface OpenRouterChatParams
  extends OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  reasoning?: { enabled?: boolean };
}

interface OpenRouterStreamParams
  extends OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
  reasoning?: { enabled?: boolean };
}

async function chat(
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; model: string }> {
  const base = {
    model: MODEL,
    temperature: 0.2,
    max_tokens: maxTokens,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
  };
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await getClient().chat.completions.create({
      ...base,
      reasoning: { enabled: false },
    } as OpenRouterChatParams);
  } catch {
    completion = await getClient().chat.completions.create(base);
  }
  return {
    text: completion.choices[0]?.message.content ?? "",
    model: completion.model ?? MODEL,
  };
}

export async function* streamChat(
  system: string,
  user: string,
  maxTokens: number,
): AsyncGenerator<{ token: string }, { text: string; model: string }> {
  const base = {
    model: MODEL,
    temperature: 0.2,
    max_tokens: maxTokens,
    stream: true as const,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
  };
  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await getClient().chat.completions.create({
      ...base,
      reasoning: { enabled: false },
    } as OpenRouterStreamParams);
  } catch {
    stream = await getClient().chat.completions.create(base);
  }
  let full = "";
  let model = MODEL;
  for await (const chunk of stream) {
    model = chunk.model ?? model;
    const delta = chunk.choices[0]?.delta?.content;
    if (!delta) continue;
    full += delta;
    yield { token: delta };
  }
  return { text: full, model };
}

/*,—— Agent contract,—— */

export const PlanSchema = z.object({
  searches: z
    .array(z.object({ query: z.string().min(1), why: z.string() }))
    .min(1)
    .max(6),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Tolerate fences / surrounding prose, then validate. */
export function parseJsonAction<T>(
  text: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; reason: string } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = cleaned.search(/[{[]/);
  if (start === -1) return { ok: false, reason: "no JSON found" };
  const slice = cleaned.slice(start);
  // Try the longest balanced parse: progressively trim trailing junk.
  for (let end = slice.length; end > 0; end--) {
    try {
      const parsed: unknown = JSON.parse(slice.slice(0, end));
      const result = schema.safeParse(parsed);
      if (result.success) return { ok: true, value: result.data };
      return {
        ok: false,
        reason: result.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
          .join("; "),
      };
    } catch {
      // Not valid JSON yet, keep trimming.
    }
  }
  return { ok: false, reason: "unparseable JSON" };
}

const PLAN_SYSTEM = `You plan web research. Output ONLY JSON, no other text:
{"searches": [{"query": string, "why": string}]}
2 to 5 distinct queries that together would answer the question. Prefer specific queries over generic ones.`;

export async function planResearch(question: string): Promise<Plan> {
  const { text } = await chat(PLAN_SYSTEM, `Research question: ${question}`, 400);
  const parsed = parseJsonAction(text, PlanSchema);
  if (!parsed.ok) {
    // One repair retry, then fall back to the raw question.
    const retry = await chat(
      PLAN_SYSTEM,
      `Research question: ${question}\n\nYour previous output was invalid (${parsed.reason}). Output corrected JSON only.`,
      400,
    );
    const second = parseJsonAction(retry.text, PlanSchema);
    if (second.ok) return second.value;
    return { searches: [{ query: question, why: "fallback" }] };
  }
  return parsed.value;
}

const PICK_SYSTEM = `You pick which web pages to read for a research brief. Output ONLY JSON, no other text:
{"urls": [string]}
Pick up to 4 URLs most likely to answer the question directly. Prefer distinct sources (different sites) and pages that look like articles, docs, or data — not homepages or listings.`;

export async function pickUrls(
  question: string,
  planQueries: string[],
  results: Array<{ title: string; url: string; snippet: string }>,
): Promise<string[]> {
  const listing = results
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.snippet} [${r.url}]`)
    .join("\n");
  const user = `Research question: ${question}\nPlanned searches: ${planQueries.join(" | ")}\n\nResults:\n${listing}\n\nPick (JSON only):`;
  const clean = (urls: unknown): string[] =>
    (Array.isArray(urls) ? urls : [])
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => {
        try {
          const parsed = new URL(u);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      })
      .slice(0, 4);
  const first = await chat(PICK_SYSTEM, user, 300);
  const parsed = parseJsonAction(
    first.text,
    z.object({ urls: z.array(z.string()) }),
  );
  if (parsed.ok && clean(parsed.value.urls).length > 0) {
    return clean(parsed.value.urls);
  }
  // One repair retry, then fall back to the first valid results.
  const retry = await chat(
    PICK_SYSTEM,
    `${user}\n\nYour previous output was invalid. Output corrected JSON only.`,
    300,
  );
  const second = parseJsonAction(
    retry.text,
    z.object({ urls: z.array(z.string()) }),
  );
  if (second.ok && clean(second.value.urls).length > 0) {
    return clean(second.value.urls);
  }
  return clean(results.map((r) => r.url));
}

export interface CitedPage {
  n: number;
  url: string;
  title: string;
  excerpt: string;
}

const BRIEF_SYSTEM = `You write research briefs from collected web observations.

Rules:
- Answer ONLY from the observations. Every factual claim needs an inline [n] citation using the page numbers.
- Keep it short: verdict first, then key findings as bullets, then what's unclear.
- If evidence is thin, say what is and isn't established. Never invent facts. Plain text, no markdown headings.
- Citation format example: "Refunds are available for 30 days [1]. A second sentence about shipping [2]."`;

export function buildBriefPrompt(
  question: string,
  pages: Array<{ n: number; url: string; title: string; text: string }>,
): string {
  const block = pages
    .map((p) => `[${p.n}] ${p.title} (${p.url})\n${p.text}`)
    .join("\n\n");
  return `Research question: ${question}\n\nSources:\n\n${block}`;
}

export function briefSystemPrompt(): string {
  return BRIEF_SYSTEM;
}

/** One repair pass when the brief drops its [n] markers. */
export async function rewriteBriefWithCitations(
  question: string,
  pages: Array<{ n: number; url: string; title: string; text: string }>,
  badBrief: string,
): Promise<string> {
  const { text } = await chat(
    BRIEF_SYSTEM,
    `Research question: ${question}\n\nSources:\n\n${pages
      .map((p) => `[${p.n}] ${p.title} (${p.url})\n${p.text}`)
      .join("\n\n")}\n\nYour previous brief is below. It is missing inline [n] citations. Rewrite it so every factual claim ends with its [n] marker. Output only the corrected brief.\n\nPrevious brief:\n${badBrief}`,
    1200,
  );
  return text;
}
