import "server-only";

import { supabase } from "../lib/supabase";
import type { ExternalMarketSignalPacket } from "../shared/contracts/external-market-signal-packet";
import type { MarketObservationInput } from "../types/market";
import { saveMarketObservation } from "./market-observation.service";

type RejectedRow = Readonly<{ row: number; reason: string }>;

export async function persistExternalMarketImport(input: Readonly<{
  source: "tenbi" | "tiktok";
  sourceDigest: string;
  packets: readonly ExternalMarketSignalPacket[];
  observations?: readonly MarketObservationInput[];
  rejected: readonly RejectedRow[];
}>) {
  const existing = await supabase
    .from("external_market_import_history")
    .select("id")
    .eq("source_digest", input.sourceDigest)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { imported: 0, packets: 0, idempotent: true };

  const packetRows = input.packets.map((packet) => ({
    packet_version: packet.packetVersion,
    source: packet.source,
    upstream_source: packet.upstreamSource,
    observed_via: packet.observedVia,
    keyword_id: packet.keywordId,
    platform_product_id: packet.platformProductId,
    source_url: packet.sourceUrl,
    category_binding: packet.categoryBinding,
    collected_at: packet.collectedAt,
    valid_until: packet.validUntil,
    packet,
    provenance_digest: packet.provenanceDigest,
    output_digest: packet.outputDigest,
  }));
  if (packetRows.length) {
    const packetWrite = await supabase
      .from("external_market_signal_packets")
      .upsert(packetRows, { onConflict: "output_digest", ignoreDuplicates: true });
    if (packetWrite.error) throw packetWrite.error;
  }

  const saved = [];
  for (const observation of input.observations ?? []) saved.push(await saveMarketObservation(observation));

  const history = await supabase.from("external_market_import_history").insert({
    source: input.source,
    source_digest: input.sourceDigest,
    accepted_count: Math.max(input.packets.length, input.observations?.length ?? 0),
    rejected_count: input.rejected.length,
    rejected_rows: input.rejected,
  });
  if (history.error && history.error.code !== "23505") throw history.error;
  return { imported: saved.length || input.packets.length, packets: input.packets.length, idempotent: history.error?.code === "23505" };
}
