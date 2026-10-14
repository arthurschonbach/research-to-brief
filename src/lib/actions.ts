"use server";

import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { z } from "zod";
import { seedSampleRun } from "./db";

const SampleSchema = z.object({
  version: z.number(),
  sample: z.object({
    question: z.string(),
    max_steps: z.number(),
    blocklist: z.string(),
    plan: z.string(),
    steps: z.string(),
    brief: z.string(),
    cited: z.string(),
    model: z.string().nullable(),
  }),
});

export async function loadSampleAction(): Promise<void> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "data", "sample-run.json"),
    "utf8",
  );
  const parsed = SampleSchema.parse(JSON.parse(raw));
  const id = seedSampleRun({
    question: parsed.sample.question,
    maxSteps: parsed.sample.max_steps,
    blocklist: parsed.sample.blocklist,
    plan: parsed.sample.plan,
    steps: parsed.sample.steps,
    brief: parsed.sample.brief,
    cited: parsed.sample.cited,
    model: parsed.sample.model,
  });
  redirect(`/history/${id}`);
}
