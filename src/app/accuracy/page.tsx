import { AccuracyPageClient } from "@/components/accuracy/AccuracyPageClient";
import { loadSiteSnapshot } from "@/lib/data";

export default async function AccuracyPage() {
  const snapshot = await loadSiteSnapshot();
  return <AccuracyPageClient initialSnapshot={snapshot} />;
}
