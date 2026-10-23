"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import sampleFile from "../../data/sample-run.json";
import { deleteRun, seedSampleRun } from "./db";
import { getVisitorId } from "./visitor";

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
  // Static import: the JSON is bundled at build time, so it also works
  // where the filesystem is read-only (Vercel) and data/ isn't deployed.
  const parsed = SampleSchema.parse(sampleFile);
  const id = await seedSampleRun(await getVisitorId(), {
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

export async function deleteRunAction(formData: FormData): Promise<void> {
  const id = String(formData.get("run_id") ?? "");
  if (!id) return;
  await deleteRun(await getVisitorId(), id);
  redirect("/history");
}
