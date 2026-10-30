// Pure validation for agent-posted events. Mirrors the rules in public.submit_event().

export const MAX_EVENTS = 50;
export const MAX_BODY_BYTES = 256 * 1024;

const KEYS = ["title", "starts_at", "ends_at", "venue", "address", "link", "image_url", "details", "source_handle", "image_sensitive"] as const;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export type AgentEvent = {
  title: string;
  starts_at: string; // normalized UTC ISO
  ends_at: string | null;
  venue: string | null;
  address: string | null;
  link: string | null;
  image_url: string | null;
  details: string | null;
  source_handle: string | null;
  image_sensitive: boolean; // the agent judged the image racy/explicit: the app blurs it behind "Tap to view"
};
export type Validated = { ok: true; value: AgentEvent } | { ok: false; reason: string };

/** Optional text field: absent/null/blank becomes null; a non-string is an error. */
function optText(v: unknown, name: string, max: number): { v: string | null } | { err: string } {
  if (v === undefined || v === null) return { v: null };
  if (typeof v !== "string") return { err: `${name}_invalid` };
  if (v.includes("\u0000")) return { err: `${name}_invalid` }; // Postgres rejects NUL
  const t = v.trim();
  if (t === "") return { v: null };
  if (t.length > max) return { err: `${name}_invalid` };
  return { v: t };
}

function optImageUrl(v: unknown): { v: string | null } | { err: string } {
  if (v === undefined || v === null) return { v: null };
  if (typeof v !== "string") return { err: "image_url_invalid" };
  if (/[\u0000-\u001f\u007f-\u009f]/.test(v)) return { err: "image_url_invalid" };
  if (v.trim() === "") return { v: null };
  if (v.length > 2048 || /\s|\\/.test(v) || !/^https:\/\//i.test(v)) return { err: "image_url_invalid" };
  try {
    const parsed = new URL(v);
    const authority = v.slice(8).split(/[/?#]/, 1)[0];
    const authorityParts = /^([^:]+)(?::([^:]+))?$/.exec(authority);
    const host = authorityParts?.[1] ?? "";
    const port = authorityParts?.[2];
    const validHost = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i.test(host);
    if (
      parsed.protocol !== "https:" || !authority || authority.includes("@") ||
      !authorityParts || !validHost || !/[a-z]/i.test(host) || parsed.hostname !== host.toLowerCase() ||
      (port !== undefined && (!/^(0|[1-9][0-9]{0,4})$/.test(port) || Number(port) > 65535)) ||
      parsed.username || parsed.password
    ) {
      return { err: "image_url_invalid" };
    }
  } catch {
    return { err: "image_url_invalid" };
  }
  return { v };
}

function parseTime(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!ISO_WITH_OFFSET.test(t)) return null;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

export function validateEvent(raw: unknown, now: Date): Validated {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not_an_object" };
  const o = raw as Record<string, unknown>;
  const unknown = Object.keys(o).filter((k) => !(KEYS as readonly string[]).includes(k));
  if (unknown.length > 0) return { ok: false, reason: `unknown_keys: ${unknown.slice(0, 5).join(", ").slice(0, 100)}` };

  if (typeof o.title === "string" && o.title.includes("\u0000")) return { ok: false, reason: "title_invalid" };
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (title.length < 1 || title.length > 120) return { ok: false, reason: "title_invalid" };

  const startMs = parseTime(o.starts_at);
  if (startMs === null || startMs <= now.getTime() - HOUR || startMs >= now.getTime() + 365 * DAY) {
    return { ok: false, reason: "starts_at_invalid" };
  }
  let endIso: string | null = null;
  if (o.ends_at !== undefined && o.ends_at !== null) {
    const endMs = parseTime(o.ends_at);
    if (endMs === null || endMs <= startMs) return { ok: false, reason: "ends_at_invalid" };
    endIso = new Date(endMs).toISOString();
  }

  const venue = optText(o.venue, "venue", 120);
  if ("err" in venue) return { ok: false, reason: venue.err };
  const address = optText(o.address, "address", 200);
  if ("err" in address) return { ok: false, reason: address.err };
  const details = optText(o.details, "details", 1000);
  if ("err" in details) return { ok: false, reason: details.err };
  const handle = optText(o.source_handle, "source_handle", 100);
  if ("err" in handle) return { ok: false, reason: handle.err };
  const link = optText(o.link, "link", 500);
  if ("err" in link) return { ok: false, reason: link.err };
  if (link.v !== null && !/^https:\/\/[^\s]+$/.test(link.v)) return { ok: false, reason: "link_invalid" };
  const imageUrl = optImageUrl(o.image_url);
  if ("err" in imageUrl) return { ok: false, reason: imageUrl.err };
  if (o.image_sensitive !== undefined && o.image_sensitive !== null && typeof o.image_sensitive !== "boolean") {
    return { ok: false, reason: "image_sensitive_invalid" };
  }

  return {
    ok: true,
    value: {
      title, starts_at: new Date(startMs).toISOString(), ends_at: endIso,
      venue: venue.v, address: address.v, link: link.v, image_url: imageUrl.v, details: details.v, source_handle: handle.v,
      image_sensitive: o.image_sensitive === true,
    },
  };
}

const norm = (s: string | null) => {
  const t = s ?? "";
  // Titles in other scripts normalize to "": fall back so they don't all share one fingerprint.
  return t.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || t.trim().toLowerCase();
};

/** sha256 hex of normalized title + start (rounded down to the minute) + normalized venue. */
export async function fingerprint(e: Pick<AgentEvent, "title" | "starts_at" | "venue">): Promise<string> {
  const minute = Math.floor(Date.parse(e.starts_at) / 60_000);
  const text = `${norm(e.title)}|${minute}|${norm(e.venue)}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
