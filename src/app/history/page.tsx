import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function Page() {
  const d = getDictionary(await getLocale());

  return (
    <div className="space-y-8">
      <PageHeader title={d.history.title} />
      <EmptyState>{d.history.empty}</EmptyState>
    </div>
  );
}
