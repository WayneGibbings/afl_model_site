import { LadderPageClient } from "@/components/ladder/LadderPageClient";
import { loadSiteSnapshot } from "@/lib/data";

export default async function LadderPage() {
  const snapshot = await loadSiteSnapshot();
  return <LadderPageClient initialSnapshot={snapshot} />;
}
