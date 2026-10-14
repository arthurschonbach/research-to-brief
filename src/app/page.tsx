import { Suspense } from "react";
import { connection } from "next/server";
import { RunForm } from "@/components/RunForm";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { hasChatKey } from "@/lib/agent";
import { loadSampleAction } from "@/lib/actions";
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
        <form action={loadSampleAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm text-muted transition-colors hover:border-muted hover:text-foreground cursor-pointer"
          >
            {d.ask.sampleButton}
          </button>
        </form>
      </div>
    </div>
  );
}

async function RunSection() {
  await connection();
  return <RunForm hasKey={hasChatKey()} />;
}
