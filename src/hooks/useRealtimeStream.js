import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshRecordImportEvent } from "../utils/recordBookQueryKeys";
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

// The backend's RealtimeEventType, verbatim.
//
// The wire format IS the enum name: RealtimeEventConsumer sends
// `.name(event.type().name())`, and the names have never been renamed — the
// enum has carried NOTIFICATION_CREATED, EXPORT_COMPLETED and EXPORT_FAILED
// since the stream landed in June. So this list is exact, not a guess.
//
// It used to be a set of lower-case guesses ("notification", "payment",
// "transaction", ...) that the backend has never sent. A named SSE event is
// delivered only to listeners registered for that exact name, so
// NOTIFICATION_CREATED was received by the browser and DISCARDED. The
// notification push has therefore not worked since the stream was added, and
// the symptom was invisible: useNotifications falls back to a slow poll, but
// only when the connection is DOWN, and this bug leaves it UP — so a new
// notification took up to five minutes to appear.
//
// "message" is the SSE default type for an UNNAMED event. The backend always
// names its events, so this never fires today; it stays as a cheap safety net
// for a server that sends one without a name.
const EVENT_NAMES = [
  "message",
  ...[
    "CONNECTED",
    "RECORD_IMPORT_PROGRESS",
    "NOTIFICATION_CREATED",
    "EXPORT_COMPLETED",
    "EXPORT_FAILED",
  ],
];

// Matched against the EVENT TYPE only, never the payload.
//
// This used to be tested against the event name AND the raw data, which
// silently swallowed real events: "shipping" contains "ping", so a
// notification titled "Shipping update" was dropped on the floor and never
// invalidated the notification list. Heartbeats do not need the payload to be
// considered — the backend sends them as SSE comments
// (RealtimeHeartbeatScheduler sends `.comment("ping")`), and comments are not
// dispatched as events at all, so they never reach this handler. CONNECTED is
// the only real event type matched here, and there is nothing to invalidate
// for it.
const IGNORE = /heartbeat|ping|keep-?alive|timeout|connected/i;
// Rules are matched against the event name AND the raw payload, so they do
// double duty now that the event names are exact: NOTIFICATION_CREATED
// matches the /notification/ rule by name, and a notification whose body
// mentions a payment or an invite routes the related lists too. Worst case an
// event refetches slightly more than needed — every query here is already
// cheap and cached, and the notification polling remains as a safety net for
// anything the stream misses.
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
];
const FALLBACK_KEYS = [["notifications"]];

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
    const recordSequences = new Map();

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
      if (e.type === "RECORD_IMPORT_PROGRESS") {
        try {
          refreshRecordImportEvent(queryClient, JSON.parse(e.data), recordSequences);
        } catch {
          /* Malformed progress must not interrupt the shared stream. */
        }
        return;
      }
      if (e.type === "EXPORT_COMPLETED" || e.type === "EXPORT_FAILED") {
        // Export jobs are not held in a React Query cache — useExportJob polls
        // GET /exports/{id} directly — so there is no key to invalidate here.
        // The event is subscribed so the browser does not discard it, and so
        // the completion is observable if the export flow is ever moved onto a
        // query. Falling through to FALLBACK_KEYS would refetch the
        // notification list every time an export finished, for no reason.
        return;
      }
      // IGNORE is tested against the event TYPE alone — see the note on it.
      if (IGNORE.test(e.type)) return;
      const haystack = `${e.type} ${typeof e.data === "string" ? e.data : ""}`;
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
          void queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey[0] === "community" &&
              ["record-imports", "records", "ai-usage"].includes(query.queryKey[2]),
          });
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
