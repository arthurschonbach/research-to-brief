import { Suspense } from "react";
import { connection } from "next/server";
import { RunForm } from "@/components/RunForm";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { hasChatKey } from "@/lib/agent";
import { loadSampleAction } from "@/lib/actions";
import { countRuns } from "@/lib/db";
import { PageHeader, btnSecondary } from "@/components/ui";

export default async function Page() {
  const d = getDictionary(await getLocale());

  return (
    <div className="space-y-10">
      <PageHeader title={d.ask.title} description={d.ask.description} />

      <Suspense fallback={null}>
        <RunSection />
      </Suspense>

      <hr />

      <Suspense fallback={null}>
        <SampleSection />
      </Suspense>
    </div>
  );
}

async function RunSection() {
  await connection();
  return <RunForm hasKey={hasChatKey()} />;
}

async function SampleSection() {
  await connection();
  const d = getDictionary(await getLocale());
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {(await countRuns()) === 0 && <p className="text-sm text-muted">{d.ask.empty}</p>}
      <form action={loadSampleAction}>
        <button type="submit" className={btnSecondary}>
          {d.ask.sampleButton}
        </button>
      </form>
    </div>
  );
}
