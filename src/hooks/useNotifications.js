import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import { useActiveCommunityId } from "./useActiveCommunityId";
import { useCommunities } from "./useCommunities";
import { useRealtimeConnected } from "./useRealtimeStream";
import { resolveCommunity, buildCommunityMap } from "../utils/notificationContent";

// While the SSE stream is live it invalidates these queries the moment a
// notification event lands, so fast polling is redundant — keep only a slow
// safety-net poll, so a missed event type still surfaces within a few
// minutes. When the stream is down, fall back to the original 30s cadence.
const POLL_STREAM_UP = 1000 * 60 * 5;
const POLL_STREAM_DOWN = 1000 * 30;

// Stable reference for the "no communities yet" fallback below -- `?? []`
// inline would create a brand-new array every render, which defeats the
// communityMap useMemo's dependency check (it'd see a "changed" input and
// recompute every render even though there's nothing to recompute).
const EMPTY_COMMUNITIES = [];

// GET /api/v1/notifications — paginated envelope: { content, pageNumber, ... }
async function fetchNotifications(communityId) {
  const params = { pageSize: 50 };
  if (communityId) params.communityId = communityId;
  const res = await client.get("/notifications", { params });
  return res.data.data;
}

// ── The unscoped notification list ───────────────────────────────────────────
// ["notifications", "all", "list"] caches exactly ONE payload, produced by
// exactly ONE query function: the raw /notifications envelope above. Every
// observer of this key must pair fetchAllNotifications with
// selectNotificationItems so each consumer derives its own view *without*
// writing a differently-shaped value back into the shared entry.
//
// Before this existed, useJoinApprovalWatcher pointed the same key at its own
// queryFn that returned the unwrapped array. Whichever observer fetched first
// won the entry, so the Topbar/CommunitiesHome/Notifications envelope readers
// could receive a bare array (select sees no .content → renders nothing) while
// the watcher could receive the envelope — and `notifications.some(...)` there
// then threw a TypeError, breaking join-approval detection outright.
export function fetchAllNotifications() {
  return fetchNotifications(null);
}

// Module-level (stable) so React Query memoizes the derived array instead of
// producing a new one on every render. Tolerates a bare-array payload too, so
// a backend that stops paging can't silently turn into an empty list.
export function selectNotificationItems(data) {
  return Array.isArray(data) ? data : (data?.content ?? []);
}

// PATCH /api/v1/notifications/{notificationId}/read
async function markOneRead(notificationId) {
  const res = await client.patch(`/notifications/${notificationId}/read`);
  return res.data;
}

// PATCH /api/v1/notifications/read-all
async function markAllRead() {
  const res = await client.patch("/notifications/read-all");
  return res.data;
}

// DELETE /api/v1/notifications — clear all of the current user's notifications
async function clearAll() {
  const res = await client.delete("/notifications");
  return res.data;
}

export function useNotifications() {
  const activeSlugOrId = useActiveCommunityId();
  const { data: communitiesData } = useCommunities();
  const communities = communitiesData?.communities ?? EMPTY_COMMUNITIES;
  // Every "active community" source in the app (Sidebar's ?community= links,
  // the glass_community localStorage snapshot) stores the community's slug,
  // not its id -- but a notification's own communityId field is a uuid (the
  // confirmed NotificationDto schema), and the backend's ?communityId=
  // filter almost certainly matches against that same uuid. Sending it the
  // slug instead meant the filter silently matched nothing and the backend
  // fell back to returning every community's notifications, which is why
  // scoping this page kept failing even once the URL correctly carried
  // ?community= end to end. Falls back to the raw value if it can't be
  // resolved yet (communities list still loading) rather than blocking the
  // query entirely -- the queryKey below picks up the corrected id and
  // refetches automatically once resolution catches up.
  const communityId = activeSlugOrId
    ? (communities.find((c) => c.slug === activeSlugOrId || c.id === activeSlugOrId)?.id ??
      activeSlugOrId)
    : null;
  // For the client-side filter below -- a plain n.communityId equality
  // check turned out too strict against real data (not every notification
  // reliably carries a populated communityId, even though the schema types
  // it as present), which flipped the earlier "shows every community" bug
  // into an equally wrong "shows nothing" once enforced strictly. Reuses
  // the same id-then-name resolution already proven correct for display
  // (the community badge/logo shown per row) as the filter criterion too,
  // instead of inventing a second, stricter notion of "belongs to".
  const communityMap = useMemo(() => buildCommunityMap(communities), [communities]);
  const queryClient = useQueryClient();
  const realtimeConnected = useRealtimeConnected();

  const listKey = ["notifications", communityId, "list"];

  // ── Main list ──────────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey: listKey,
    queryFn: () => fetchNotifications(communityId),
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 5,
    refetchInterval: realtimeConnected ? POLL_STREAM_UP : POLL_STREAM_DOWN,
    refetchIntervalInBackground: false,
    // Overrides the app-wide false: coming back to the tab (or the app on
    // mobile) should surface new notifications immediately, not up to 30s
    // later when the poll interval next fires.
    refetchOnWindowFocus: true,
    select: (data) => {
      const notifications = data?.content ?? [];
      return [...notifications]
        .filter((n) => {
          // Confirmed against real data: the backend's ?communityId=
          // request param (see fetchNotifications above) does not actually
          // filter server-side -- every community's notifications still
          // came back regardless of the value sent. Enforce it client-side
          // instead of trusting the backend to have already done it.
          //
          // Fails OPEN, not closed: only drop a notification when
          // resolveCommunity can positively identify it as belonging to a
          // DIFFERENT community. A first pass that excluded anything it
          // couldn't positively match TO this community turned out too
          // strict against real payment notifications (not every one
          // reliably carries a populated communityId, on this field or
          // inside content) and reproduced the exact opposite bug --
          // scoping to a community that genuinely has notifications showed
          // none at all. Hiding a real notification is a worse failure
          // than occasionally keeping an unresolvable one visible.
          if (communityId) {
            const resolved = resolveCommunity(n, communityMap);
            if (resolved && resolved.id !== communityId) return false;
          }
          return true;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
  });

  // Derive unread count from the already-filtered list so the badge always
  // reflects only the current community (the backend /unread-count endpoint
  // returns a global total and cannot be scoped per community).
  const unreadCount = useMemo(
    () => (query.data ?? []).filter((n) => !n.readFlag).length,
    [query.data],
  );

  // ── Mark one read ──────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: markOneRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) =>
        old
          ? {
              ...old,
              content: old.content.map((n) =>
                n.id === notificationId ? { ...n, readFlag: true } : n,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    // Both PATCH endpoints are global, not scoped to this community -- a
    // notification read here is read everywhere, so every other cached list
    // (the topbar dropdown, any other community) needs to refetch too.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) =>
        old ? { ...old, content: old.content.map((n) => ({ ...n, readFlag: true })) } : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // ── Clear all (DELETE /notifications) ──────────────────────────────────────
  // Distinct from marking read: this removes every notification for the
  // user, not just their unread state. Same global-invalidation rule as
  // above — a notification cleared here is gone from every cached list.
  const clearAllMutation = useMutation({
    mutationFn: clearAll,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) => (old ? { ...old, content: [] } : old));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    unreadCount,
    markRead: (id) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
    isMarkingAllRead: markAllReadMutation.isPending,
    clearAll: () => clearAllMutation.mutate(),
    isClearingAll: clearAllMutation.isPending,
  };
}

// ── Universal (all-community) hook — used by the Topbar dropdown panel ────────
// Does NOT scope by communityId so the panel shows every notification the
// user has, regardless of which community is currently active.
export function useAllNotifications() {
  const queryClient = useQueryClient();
  const realtimeConnected = useRealtimeConnected();
  const listKey = ["notifications", "all", "list"];

  const query = useQuery({
    queryKey: listKey,
    queryFn: fetchAllNotifications,
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 5,
    refetchInterval: realtimeConnected ? POLL_STREAM_UP : POLL_STREAM_DOWN,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    select: (data) =>
      [...selectNotificationItems(data)].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
  });

  const markReadMutation = useMutation({
    mutationFn: markOneRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) =>
        old
          ? {
              ...old,
              content: old.content.map((n) =>
                n.id === notificationId ? { ...n, readFlag: true } : n,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    // Prefix match, not just this listKey -- both PATCH endpoints are
    // global, so a community-scoped page's cached list needs to refetch too.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) =>
        old ? { ...old, content: old.content.map((n) => ({ ...n, readFlag: true })) } : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // ── Clear all (DELETE /notifications) ──────────────────────────────────────
  const clearAllMutation = useMutation({
    mutationFn: clearAll,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) => (old ? { ...old, content: [] } : old));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = useMemo(
    () => (query.data ?? []).filter((n) => !n.readFlag).length,
    [query.data],
  );

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    unreadCount,
    markRead: (id) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
    isMarkingAllRead: markAllReadMutation.isPending,
    clearAll: () => clearAllMutation.mutate(),
    isClearingAll: clearAllMutation.isPending,
  };
}

// ── Preferences mirror ────────────────────────────────────────────────────────
// The backend currently persists only the channel toggles (inAppEnabled,
// emailEnabled, whatsappEnabled). Every category toggle (paymentReminder,
// receipts, failed payments, …) is accepted by the PATCH but never comes back
// from the GET — so after a refetch the missing key fell back to its default
// and the switch visibly snapped back on. Mirror all preferences locally:
// server fields always win when present; the mirror carries everything else
// until the backend stores those fields too.
//
// Session-adjacent (F6): the mirror holds ONE user's preferences and is
// spread *into* the queryFn result below — so unlike a normal cache entry,
// queryClient.clear() on a session transition does NOT remove it, and the
// next account's first GET would merge the previous account's category
// toggles into its own response. It is on SESSION_ADJACENT_KEYS, which
// clearSessionStorage() drops on every session-ending path, so the mirror is
// empty by the time any later account can fetch. While the user is signed
// in the mirror behaves exactly as before.
const PREFS_MIRROR_KEY = "glass_notification_prefs";

function readPrefsMirror() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_MIRROR_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writePrefsMirror(patch) {
  try {
    localStorage.setItem(PREFS_MIRROR_KEY, JSON.stringify({ ...readPrefsMirror(), ...patch }));
  } catch {
    /* ignore */
  }
}

// GET /api/v1/notifications/preferences
async function fetchPreferences() {
  const res = await client.get("/notifications/preferences");
  return { ...readPrefsMirror(), ...(res.data.data ?? {}) };
}

// PATCH /api/v1/notifications/preferences
async function patchPreferences(payload) {
  const res = await client.patch("/notifications/preferences", payload);
  return res.data.data;
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: fetchPreferences,
    staleTime: 1000 * 60 * 5,
  });

  const update = useMutation({
    mutationKey: ["notification-preferences"],
    mutationFn: patchPreferences,
    // Without this the toggle flips optimistically and nothing confirms the
    // save — indistinguishable from a broken switch when the user is unsure.
    meta: { successMessage: "Notification preferences saved" },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "preferences"] });
      const previous = queryClient.getQueryData(["notifications", "preferences"]);
      // Persist to the local mirror too — for fields the backend doesn't
      // store yet, this is what keeps the toggle where the user put it
      // across refetches and sessions.
      writePrefsMirror(next);
      queryClient.setQueryData(["notifications", "preferences"], (old) => ({ ...old, ...next }));
      return { previous };
    },
    onSuccess: (data) => {
      // The PATCH echoes the saved preferences — merge them in so the cache
      // reflects server truth without waiting for a refetch.
      if (data && typeof data === "object") {
        queryClient.setQueryData(["notifications", "preferences"], (old) => ({ ...old, ...data }));
      }
    },
    onError: (_err, next, ctx) => {
      if (ctx?.previous) {
        // Roll the mirror back too, only for the keys this failed PATCH touched.
        const revert = {};
        for (const k of Object.keys(next ?? {})) revert[k] = ctx.previous[k];
        writePrefsMirror(revert);
        queryClient.setQueryData(["notifications", "preferences"], ctx.previous);
      }
    },
    onSettled: () => {
      // Flipping several toggles quickly runs mutations concurrently — a
      // refetch triggered by an early one can return stale values and snap a
      // later toggle back. Only refetch once the last one settles.
      if (queryClient.isMutating({ mutationKey: ["notification-preferences"] }) === 1) {
        queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
      }
    },
  });

  return {
    preferences: query.data ?? {},
    isLoading: query.isLoading,
    error: query.error,
    update: (key, value) => update.mutate({ [key]: value }),
  };
}
