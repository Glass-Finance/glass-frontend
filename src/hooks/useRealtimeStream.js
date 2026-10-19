import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mintRealtimeTicket } from "../api/realtime";
import { useAuth } from "../store/AuthContext";

// ── Connection status, observable from anywhere ──────────────────────────────
// Lets data hooks adapt their polling to the stream's health (e.g.
// useNotifications polls every 30s while disconnected, but only keeps a slow
// safety-net poll while the stream is live). Module-level because there is
// exactly one stream per tab (mounted once via RealtimeBridge).
let streamConnected = false;
const connectionListeners = new Set();

function setStreamConnected(next) {
  if (streamConnected === next) return;
  streamConnected = next;
  connectionListeners.forEach((listener) => listener());
}

function subscribeToConnection(listener) {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export function useRealtimeConnected() {
  return useSyncExternalStore(subscribeToConnection, () => streamConnected);
}

// GET /api/v1/realtime/stream — same base-URL convention as api/client.js.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const STREAM_URL = `${BASE_URL}/api/v1/realtime/stream`;

// The backend doesn't document most of its SSE event names/payloads yet, so
// events are routed to cache invalidations by keyword against the event name +
// raw data. Worst case an event refetches slightly more than needed — every
// query here is already cheap and cached, and the existing 30s notification
// polling remains as a safety net for anything the stream misses.
//
// RECORD_IMPORT_PROGRESS is the one documented exception: the record-book
// guide in glass-backend (docs/new/community-record-book-frontend-api.md)
// names the event and gives its payload as { title, description, communityId,
// jobId, status, sequence, failureCode }. It is subscribed by name below and
// gets an explicit rule, because it carries an underscore where the other
// guesses are hyphenated and would otherwise be missed.
const IGNORE = /heartbeat|ping|keep-?alive|timeout|connected/i;
const INVALIDATION_RULES = [
  {
    match: /transaction|payment/i,
    keys: [["transactions"], ["obligations"], ["community"], ["notifications"]],
  },
  { match: /obligation/i, keys: [["obligations"], ["community"]] },
  { match: /invite/i, keys: [["invites"], ["communities"], ["notifications"]] },
  // ["community", id] is the admin-side per-community cache (dashboard,
  // members, join-requests list); ["communities"] (plural, no id) is the
  // *member's own* membership list -- what Home/the join-approval watcher
  // read to notice their pending request went ACTIVE. Only invalidating
  // the singular key meant a live "member"/"join" event only ever refreshed
  // the admin's view, never the requesting member's own Home. The backend
  // doesn't yet emit a distinct event for "your request was approved" (see
  // useJoinApproval.js) -- this is a no-op until it does, but is correct
  // and ready for whenever it starts.
  {
    match: /member|join/i,
    keys: [["community"], ["communities"], ["join-requests"], ["notifications"]],
  },
  { match: /notification/i, keys: [["notifications"]] },
  // Record-book import progress. Deliberately placed AFTER the generic
  // notification rule so the literal event name is matched here rather than
  // falling through to FALLBACK_KEYS, which would refresh nothing useful.
  //
  // React Query prefix-matches, so ["community"] covers every community-scoped
  // key: ["community", id, "imports", ...], ["community", id, "records", ...]
  // and the admin dashboard's own ["community"] cache. The keys that do not
  // live under a "community" prefix — the admin AI-usage ones, keyed
  // ["admin", communityId, "ai", ...] — are not covered; a platform admin
  // watching a community's import will see it on their next manual refresh.
  {
    match: /record_import|record-import|import.progress/i,
    keys: [["community"], ["notifications"]],
  },
];
const FALLBACK_KEYS = [["notifications"]];

// EventSource has no wildcard listener — named events (`event: foo`) are
// only delivered to addEventListener("foo"). Since the names aren't
// documented, subscribe to the plausible ones (case-sensitive, so both
// casings) plus the unnamed default. Unrecognized names fall through to
// the polling safety net until the backend documents them.
const EVENT_NAMES = [
  "message",
  // Documented by the record-book guide, and not covered by the guess list
  // below: that list derives lower/upper casings of a handful of names, and
  // RECORD_IMPORT_PROGRESS is SCREAMING_SNAKE with an underscore. Without this
  // entry EventSource never delivers the event at all, so the rule above would
  // never fire.
  "RECORD_IMPORT_PROGRESS",
  ...[
    "notification",
    "transaction",
    "payment",
    "obligation",
    "member",
    "invite",
    "join-request",
    "update",
    "event",
  ].flatMap((n) => [n, n.toUpperCase()]),
];

// Opens the realtime SSE stream while the user is authenticated and nudges
// React Query caches when events arrive, so dashboards update without
// waiting for a poll cycle. Reconnects with exponential backoff — the
// native EventSource auto-retry is deliberately not used, since it would
// replay the same (single-use, already-spent) ticket.
export default function useRealtimeStream() {
  // Gate on verification, not mere token presence: an unverified token
  // (still restoring, or failed verification) must never mint an SSE
  // ticket — guards treat it as unauthenticated for the same reason.
  const { isAuthenticated, sessionVerified } = useAuth();
  const queryClient = useQueryClient();
  const canStream = isAuthenticated && sessionVerified;

  useEffect(() => {
    if (!canStream) return undefined;

    let disposed = false;
    let es = null;
    let reconnectTimer = null;
    let attempts = 0;
    let flushTimer = null;
    const pendingKeys = new Set();

    // Debounce invalidations — one payment can emit several events in a
    // burst, and each key only needs to be marked stale once per burst.
    function scheduleInvalidate(keys) {
      keys.forEach((k) => pendingKeys.add(JSON.stringify(k)));
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        for (const k of pendingKeys) {
          queryClient.invalidateQueries({ queryKey: JSON.parse(k) });
        }
        pendingKeys.clear();
      }, 400);
    }

    function handleEvent(e) {
      const haystack = `${e.type} ${typeof e.data === "string" ? e.data : ""}`;
      if (IGNORE.test(haystack)) return;
      const rule = INVALIDATION_RULES.find((r) => r.match.test(haystack));
      scheduleInvalidate(rule ? rule.keys : FALLBACK_KEYS);
    }

    function scheduleReconnect() {
      if (disposed || reconnectTimer) return;
      const delay = Math.min(30000, 1000 * 2 ** attempts) + Math.random() * 1000;
      attempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    async function connect() {
      try {
        const res = await mintRealtimeTicket();
        const ticket = res.data?.data?.ticket;
        if (!ticket) throw new Error("No ticket in realtime ticket response");
        if (disposed) return;

        es = new EventSource(`${STREAM_URL}?ticket=${encodeURIComponent(ticket)}`);
        es.onopen = () => {
          attempts = 0;
          setStreamConnected(true);
        };
        EVENT_NAMES.forEach((name) => es.addEventListener(name, handleEvent));
        es.onerror = () => {
          // Covers both failed connects and dropped streams. Close before
          // retrying so the browser's built-in retry can't reuse the spent
          // ticket.
          es?.close();
          es = null;
          setStreamConnected(false);
          scheduleReconnect();
        };
      } catch {
        // Ticket minting failed (offline, expired session mid-flight...) —
        // back off and retry. Realtime is an enhancement over polling, so
        // never surface this to the user.
        scheduleReconnect();
      }
    }

    function handleOnline() {
      // Skip the remaining backoff when connectivity returns.
      if (es || disposed) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      connect();
    }

    connect();
    window.addEventListener("online", handleOnline);

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(flushTimer);
      es?.close();
      setStreamConnected(false);
      window.removeEventListener("online", handleOnline);
    };
  }, [canStream, queryClient]);
}
