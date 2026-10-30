// Which already-known submissions a re-send may add an image to. Pure, so it can be tested.

/** `image_sensitive` is set only for a re-send: the re-sent flag travels with the new image. */
export type ImageRow = { id: string; agent_fingerprint: string; image_url: string; event_id?: string; image_sensitive?: boolean };

export type ExistingSubmission = {
  id: string;
  agent_fingerprint: string | null;
  image_url: string | null;
  status: string;
  event_id: string | null;
};

/**
 * A re-sent event can fill in a missing image (e.g. the agent couldn't get one first time): on a pending row,
 * or on an approved row whose published event still has no picture (`bareEventIds`). Rows that already hold
 * an image from our bucket are left alone.
 */
export function resendImageRows(
  existing: ExistingSubmission[],
  sent: Map<string, { image_url?: unknown; image_sensitive?: unknown }>,
  bareEventIds: Set<string>,
  ownBucket: string,
): ImageRow[] {
  const out: ImageRow[] = [];
  for (const r of existing) {
    if (!r.agent_fingerprint || r.image_url?.includes(ownBucket)) continue;
    const s = sent.get(r.agent_fingerprint);
    if (!s || typeof s.image_url !== "string") continue;
    const base = { id: r.id, agent_fingerprint: r.agent_fingerprint, image_url: s.image_url, image_sensitive: s.image_sensitive === true };
    if (r.status === "pending") out.push(base);
    else if (r.status === "approved" && r.event_id && bareEventIds.has(r.event_id)) out.push({ ...base, event_id: r.event_id });
  }
  return out;
}
