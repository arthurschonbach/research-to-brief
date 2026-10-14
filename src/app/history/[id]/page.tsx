import { notFound } from "next/navigation";
import { getRun } from "@/lib/db";

export default async function Page({ params }: PageProps<"/history/[id]">) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) notFound();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{run.question}</h1>
      <p className="text-sm text-muted">Run detail arrives in milestone 5.</p>
    </div>
  );
}
