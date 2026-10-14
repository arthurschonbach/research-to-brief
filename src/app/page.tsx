import { Suspense } from "react";
import { connection } from "next/server";
import { RunForm } from "@/components/RunForm";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { hasChatKey } from "@/lib/agent";
import { PageHeader } from "@/components/ui";

export default async function Page() {
  const d = getDictionary(await getLocale());

  return (
    <div className="space-y-10">
      <PageHeader title={d.ask.title} description={d.ask.description} />

      <Suspense fallback={null}>
        <RunSection />
      </Suspense>

      <hr />

      <div>
        <p className="mb-3 text-sm text-muted">{d.ask.empty}</p>
        <button
          type="button"
          disabled
          className="inline-flex h-9 cursor-not-allowed items-center rounded-md border border-border bg-background px-3 text-sm text-muted opacity-50"
        >
          {d.ask.sampleButton} (milestone 6)
        </button>
      </div>
    </div>
  );
}

async function RunSection() {
  await connection();
  return <RunForm hasKey={hasChatKey()} />;
}
