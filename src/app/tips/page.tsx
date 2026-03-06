import { TipsPageClient } from "@/components/tips/TipsPageClient";
import { loadSiteSnapshot } from "@/lib/data";

export default async function TipsPage() {
  const snapshot = await loadSiteSnapshot();
  return <TipsPageClient initialSnapshot={snapshot} />;
}
