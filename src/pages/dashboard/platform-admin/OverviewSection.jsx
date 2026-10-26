/**
 * OverviewSection.jsx — platform-admin landing page (design:
 * Overview@1x (2).png). Every figure composes from endpoints the panel
 * already talks to; no new backend surface:
 *
 *   stat cards        pageSize:1 totalElements on the six list endpoints
 *                     (+ payment-links ACTIVE/EXPIRED, KYC IN_REVIEW)
 *   needs attention   obligations OVERDUE, transactions ABANDONED/FAILED,
 *                     payment-links EXPIRED, reconciliation findings NEW
 *   platform money    GET /admin/balances (displayNames come back exactly
 *                     as the design labels them)
 *   runs table        GET /admin/reconciliation/runs (first 5)
 *   activity feed     GET /admin/audit-logs — actors render as
 *                     platformRoleName (never a UUID), and token-ish
 *                     events are grouped by default per the design
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import LoadingState from "../../../components/common/LoadingState";
import { Skeleton } from "../../../components/common/SkeletonUI";
import {
  getAdminAuditLogs,
  getAdminBalances,
  getAdminCommunities,
  getAdminKycAttempts,
  getAdminObligations,
  getAdminPaymentLinks,
  getAdminReconciliationFindings,
  getAdminReconciliationRuns,
  getAdminTransactions,
  getAdminUsers,
} from "../../../api/admin";
import { fmt, fmtDate, unwrap } from "./shared";

// Response order differs from the design's row order — reorder explicitly so
// the money card always reads gross → settled → net → commission → fees.
const MONEY_ORDER = [
  "MEMBER_INFLOW",
  "SETTLED_TO_BANK",
  "NET_PAYABLE",
  "PLATFORM_COMMISSION",
  "PROCESSOR_FEE",
];

// Routine auth-token noise the design groups by default. The AuditEvent enum
// currently has no TOKEN/REFRESH values (the design's "Refresh token created"
// rows are mock data) — the matcher is what lights up the day the backend
// starts emitting them, without a frontend change.
const TOKEN_EVENT = /TOKEN|REFRESH/;

const AUTH_EVENTS = new Set(["LOGIN", "LOGOUT", "FAILED_LOGIN"]);

function sentenceCase(value) {
  if (!value) return "";
  const s = String(value).replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function fmtDayTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function toUrl(tab) {
  return `/dashboard/admin-panel?tab=${tab}`;
}

const countParams = { pageNumber: 1, pageSize: 1 };

async function total(fetcher, extra = {}) {
  const res = await fetcher({ ...countParams, ...extra });
  return res.data?.data?.totalElements ?? 0;
}

async function pageOf(fetcher, extra = {}) {
  return unwrap(await fetcher({ pageNumber: 1, ...extra }));
}

function activityTitle(a) {
  if (a.event === "LOGIN") return `${a.platformRoleName ?? "Someone"} signed in`;
  if (a.event === "LOGOUT") return `${a.platformRoleName ?? "Someone"} signed out`;
  if (a.event === "FAILED_LOGIN") return "Failed sign-in";
  return sentenceCase(a.event);
}

function activitySubtitle(a) {
  const event = sentenceCase(a.event);
  // Auth rows lead with the actor in the title, so the line under it is the
  // event · result ("Login · Success"). Everything else puts the actor here.
  if (AUTH_EVENTS.has(a.event)) {
    return a.result ? `${event} · ${sentenceCase(a.result)}` : event;
  }
  const actor = a.platformRoleName ?? a.entityType ?? "System";
  return a.result ? `${actor} · ${sentenceCase(a.result)}` : actor;
}

function statusCell(status) {
  const label = sentenceCase(status);
  if (status === "COMPLETED" || status === "SUCCESS") {
    return <span className="text-xs font-semibold text-green-700">✓ {label}</span>;
  }
  if (status === "FAILED" || status === "PARTIAL") {
    return <span className="text-xs font-semibold text-red-600">{label}</span>;
  }
  return <span className="text-xs font-semibold text-gray-500">{label}</span>;
}

function StatCard({ label, value, caption }) {
  return (
    <div className="bg-white border border-surface-container-border rounded-xl p-4">
      <p className="m-0 text-[13px] text-gray-500">{label}</p>
      <p className="m-0 mt-1.5 text-[26px] leading-none font-bold text-gray-900">
        {typeof value === "number" ? value.toLocaleString() : "—"}
      </p>
      <p className="m-0 mt-2 text-[11px] text-gray-400">{caption}</p>
    </div>
  );
}

function Panel({ title, meta, right, isLoading, error, children, className = "" }) {
  return (
    <section className={`bg-white border border-surface-container-border rounded-xl ${className}`}>
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-sunken">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="m-0 text-[15px] font-bold text-gray-900">{title}</h2>
          {meta}
        </div>
        {right}
      </header>
      {isLoading ? (
        <LoadingState className="py-10" />
      ) : error ? (
        <p className="m-0 px-5 py-8 text-xs text-danger text-center">{error.message}</p>
      ) : (
        children
      )}
    </section>
  );
}

function AttentionRow({ chip, chipClass, title, desc, action }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-t border-surface-sunken first:border-t-0">
      <span
        className={`shrink-0 w-[68px] text-center text-[10px] font-semibold px-2 py-1 rounded-full ${chipClass}`}
      >
        {chip}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-semibold text-gray-900">{title}</p>
        <p className="m-0 mt-0.5 text-xs text-gray-500">{desc}</p>
      </div>
      {action && (
        <Link
          to={action.href}
          className="shrink-0 text-xs font-semibold text-brand hover:underline no-underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export default function OverviewSection() {
  const queryClient = useQueryClient();
  const [showAllToken, setShowAllToken] = useState(false);

  const stats = useQuery({
    queryKey: ["admin-overview", "stats"],
    queryFn: async () => {
      const [
        communities,
        users,
        paymentLinks,
        activeLinks,
        expiredLinks,
        transactions,
        obligations,
        kycInReview,
      ] = await Promise.all([
        total(getAdminCommunities),
        total(getAdminUsers),
        total(getAdminPaymentLinks),
        total(getAdminPaymentLinks, { status: "ACTIVE" }),
        total(getAdminPaymentLinks, { status: "EXPIRED" }),
        total(getAdminTransactions),
        total(getAdminObligations),
        total(getAdminKycAttempts, { status: "IN_REVIEW" }),
      ]);
      return {
        communities,
        users,
        paymentLinks,
        activeLinks,
        expiredLinks,
        transactions,
        obligations,
        kycInReview,
      };
    },
    staleTime: 30_000,
  });

  const attention = useQuery({
    queryKey: ["admin-overview", "attention"],
    queryFn: async () => {
      const [overdue, abandoned, failed, expiredLinks, openFindings] = await Promise.all([
        pageOf(getAdminObligations, { status: "OVERDUE", pageSize: 3 }),
        total(getAdminTransactions, { status: "ABANDONED" }),
        pageOf(getAdminTransactions, { status: "FAILED", pageSize: 3 }),
        pageOf(getAdminPaymentLinks, { status: "EXPIRED", pageSize: 4 }),
        // Untouched findings (NEW) — the reconciliation queue's backlog.
        total(getAdminReconciliationFindings, { status: "NEW" }),
      ]);
      return { overdue, abandoned, failed, expiredLinks, openFindings };
    },
    staleTime: 30_000,
  });

  const balances = useQuery({
    queryKey: ["admin-overview", "balances"],
    queryFn: () => getAdminBalances({}).then((r) => r.data?.data),
    staleTime: 30_000,
  });

  const runs = useQuery({
    queryKey: ["admin-overview", "runs"],
    queryFn: () => pageOf(getAdminReconciliationRuns, { pageSize: 5 }),
    staleTime: 30_000,
  });

  const activity = useQuery({
    queryKey: ["admin-overview", "activity"],
    queryFn: () => pageOf(getAdminAuditLogs, { pageSize: 12 }),
    staleTime: 30_000,
  });

  const anyFetching =
    stats.isFetching ||
    attention.isFetching ||
    balances.isFetching ||
    runs.isFetching ||
    activity.isFetching;

  function refresh() {
    stats.refetch();
    attention.refetch();
    balances.refetch();
    runs.refetch();
    activity.refetch();
    // The rail's six counts mirror several of these same lists.
    queryClient.invalidateQueries({ queryKey: ["admin-nav-counts"] });
  }

  const s = stats.data;
  const a = attention.data;

  // ── Needs-attention rows — only the issues that actually exist, plus the
  //    always-on queue row the design shows at the bottom. ──────────────────
  const issueRows = [];
  if (s && a) {
    const overdueCount = a.overdue.totalElements;
    if (overdueCount > 0) {
      const names = a.overdue.content.map((o) => o.community?.name).filter(Boolean);
      let desc;
      if (names.length >= 2) {
        desc =
          overdueCount > names.length
            ? `${names[0]} and ${names[1]} are among ${overdueCount} communities with overdue obligations.`
            : `${names[0]} and ${names[1]} both have overdue obligations.`;
      } else if (names.length === 1) {
        desc =
          overdueCount > 1
            ? `${names[0]} and ${overdueCount - 1} more have overdue obligations.`
            : `${names[0]} has an overdue obligation.`;
      } else {
        desc = `${overdueCount} obligations past due.`;
      }
      issueRows.push({
        key: "overdue",
        chip: "Overdue",
        chipClass: "bg-amber-50 text-amber-700",
        title: "Unpaid obligations past due",
        desc,
        action: { label: "Review obligations", href: toUrl("obligations") },
      });
    }

    const abandonedCount = a.abandoned;
    const failedCount = a.failed.totalElements;
    if (abandonedCount > 0 || failedCount > 0) {
      const bits = [];
      if (abandonedCount > 0) bits.push(`${abandonedCount} abandoned`);
      if (failedCount > 0) bits.push(`${failedCount} failed`);
      const firstFailed = a.failed.content[0];
      const hint = firstFailed
        ? `, latest failure ${firstFailed.community?.name ?? "unknown community"} ${fmt(firstFailed.amount, firstFailed.currency)}`
        : "";
      issueRows.push({
        key: "failing",
        chip: "Failing",
        chipClass: "bg-red-50 text-red-700",
        title: abandonedCount > 0 ? "Recent payments abandoned" : "Recent payments failed",
        desc: `Payment attempts that did not complete: ${bits.join(", ")}${hint}.`,
        action: { label: "Open transactions", href: toUrl("transactions") },
      });
    }

    const expiredCount = a.expiredLinks.totalElements;
    if (expiredCount > 0) {
      const titles = a.expiredLinks.content
        .map((p) => p.title)
        .filter(Boolean)
        .slice(0, 4);
      const more = expiredCount - titles.length;
      issueRows.push({
        key: "expired",
        chip: "Expired",
        chipClass: "bg-gray-100 text-gray-500",
        title: `${expiredCount} of ${s.paymentLinks} payment links have expired`,
        desc: `${joinList(titles)} ${titles.length === 1 ? "is" : "are"} no longer collecting${more > 0 ? `, and ${more} more` : ""}.`,
        action: { label: "Open payment links", href: toUrl("payment-links") },
      });
    }
  }

  const openIssues = issueRows.length;
  const queueBacklog = (a?.openFindings ?? 0) + (s?.kycInReview ?? 0);

  // ── Platform money rows ──────────────────────────────────────────────────
  const currency = balances.data?.currency ?? "NGN";
  const balanceItems = balances.data?.balances ?? [];
  const byCode = new Map(balanceItems.map((b) => [b.code, b]));
  const moneyRows = [
    ...MONEY_ORDER.map((code) => byCode.get(code)).filter(Boolean),
    ...balanceItems.filter((b) => !MONEY_ORDER.includes(b.code)),
  ];

  // ── Activity feed: singles in order, one group row at the first token
  //    event's position, expandable via "Show all". ─────────────────────────
  const activityItems = activity.data?.content ?? [];
  const tokenRows = activityItems.filter((item) => TOKEN_EVENT.test(item.event ?? ""));
  const feed = [];
  let groupInserted = false;
  for (const item of activityItems) {
    if (TOKEN_EVENT.test(item.event ?? "")) {
      if (!groupInserted) {
        feed.push({ type: "group" });
        groupInserted = true;
      }
      if (showAllToken) feed.push({ type: "row", item });
    } else {
      feed.push({ type: "row", item });
    }
  }
  const tokenTimes = tokenRows.map((r) => fmtTime(r.occurredAt)).sort();

  return (
    <div>
      {/* Page header — design's own h1 block (the other sections use the
          smaller SectionHeader; this page's title IS the page). */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="m-0 text-2xl font-bold text-gray-900">Overview</h1>
          <p className="m-0 mt-1 text-sm text-gray-400">
            Glass internal operations. Not visible to community owners.
          </p>
        </div>
        <Button variant="outline-neutral" size="xs" fullWidth={false} onClick={refresh}>
          <RefreshCw size={12} className={anyFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Stat cards */}
      {stats.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : stats.error ? (
        <p className="m-0 mb-4 text-xs text-danger text-center py-4">{stats.error.message}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
          <StatCard
            label="Communities"
            value={s?.communities}
            caption="Registered on the platform"
          />
          <StatCard label="Users" value={s?.users} caption="Registered users" />
          <StatCard
            label="Payment links"
            value={s?.paymentLinks}
            caption={`${s?.activeLinks ?? 0} active · ${s?.expiredLinks ?? 0} expired`}
          />
          <StatCard label="Transactions" value={s?.transactions} caption="Across all communities" />
          <StatCard label="Obligations" value={s?.obligations} caption="Across all communities" />
          <StatCard
            label="KYC in review"
            value={s?.kycInReview}
            caption={(s?.kycInReview ?? 0) > 0 ? "Waiting for review" : "Queue is empty"}
          />
        </div>
      )}

      {/* Needs attention + Platform money */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Panel
          title="Needs attention"
          className="lg:col-span-3"
          isLoading={attention.isLoading}
          error={attention.error}
          meta={
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                openIssues > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
              }`}
            >
              {openIssues > 0 ? `${openIssues} open` : "All clear"}
            </span>
          }
        >
          <>
            {issueRows.map((row) => (
              <AttentionRow key={row.key} {...row} />
            ))}
            <div className="flex items-center gap-4 px-5 py-4 border-t border-surface-sunken first:border-t-0">
              <span
                className={`shrink-0 w-[68px] text-center text-[10px] font-semibold px-2 py-1 rounded-full ${
                  queueBacklog > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                }`}
              >
                {queueBacklog > 0 ? "Queued" : "Clear"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13px] font-semibold text-gray-900">
                  Reconciliation and KYC queue
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                {(a?.openFindings ?? 0).toLocaleString()} findings ·{" "}
                {(s?.kycInReview ?? 0).toLocaleString()} in review
              </span>
            </div>
          </>
        </Panel>

        <Panel
          title="Platform money"
          className="lg:col-span-2"
          isLoading={balances.isLoading}
          error={balances.error}
          meta={
            balances.data?.reconciles == null ? null : (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  balances.data.reconciles ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {balances.data.reconciles ? "Reconciled" : "Out of balance"}
              </span>
            )
          }
        >
          <div className="px-5 py-4">
            <p className="m-0 text-xs text-gray-400">Platform residual</p>
            <p className="m-0 mt-1 text-3xl font-bold text-gray-900">
              {fmt(balances.data?.residual, currency, { minor: false, decimals: 2 })}
            </p>
          </div>
          {moneyRows.map((b) => (
            <div
              key={b.code}
              className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-surface-sunken"
            >
              <span className="text-[13px] text-gray-600">{b.displayName ?? b.code}</span>
              <span className="text-[13px] font-semibold text-gray-900">
                {fmt(b.amount, b.currency ?? currency, { minor: false, decimals: 2 })}
              </span>
            </div>
          ))}
          <div className="px-5 py-3.5 border-t border-surface-sunken">
            <Link
              to={toUrl("balances")}
              className="text-[13px] font-semibold text-brand hover:underline no-underline"
            >
              Open balances
            </Link>
          </div>
        </Panel>
      </div>

      {/* Runs + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Panel
          title="Latest reconciliation runs"
          className="lg:col-span-3"
          isLoading={runs.isLoading}
          error={runs.error}
          right={
            <Link
              to={toUrl("reconciliation")}
              className="text-xs font-semibold text-brand hover:underline no-underline shrink-0"
            >
              All {(runs.data?.totalElements ?? 0).toLocaleString()} runs
            </Link>
          }
        >
          {(runs.data?.content ?? []).length === 0 ? (
            <p className="m-0 px-5 py-6 text-xs text-gray-400">No reconciliation runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-sunken">
                    {["Run", "Window", "Residual", "Findings", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-5 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(runs.data?.content ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-surface-sunken last:border-b-0">
                      <td className="px-5 py-3">
                        <p className="m-0 text-xs font-semibold text-gray-900">
                          {sentenceCase(r.runType)}{" "}
                          <span className="font-normal text-gray-400">
                            · {fmtDayTime(r.startedAt)}
                          </span>
                        </p>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                        {fmtDate(r.windowFrom)} – {fmtDate(r.windowTo)}
                      </td>
                      <td
                        className={`px-5 py-3 text-xs ${r.residual ? "text-red-600 font-semibold" : "text-gray-400"}`}
                      >
                        {fmt(r.residual, "NGN", { minor: false, decimals: 2 })}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-700">{r.findingsTotal ?? 0}</td>
                      <td className="px-5 py-3">{statusCell(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Recent admin activity"
          className="lg:col-span-2"
          isLoading={activity.isLoading}
          error={activity.error}
          right={
            <Link
              to={toUrl("audit-logs")}
              className="text-xs font-semibold text-brand hover:underline no-underline shrink-0"
            >
              {(activity.data?.totalElements ?? 0).toLocaleString()} logs
            </Link>
          }
        >
          {activityItems.length === 0 ? (
            <p className="m-0 px-5 py-6 text-xs text-gray-400">No admin activity yet.</p>
          ) : (
            <>
              {feed.map((entry) =>
                entry.type === "group" ? (
                  <div
                    key="token-group"
                    className="flex items-start justify-between gap-3 px-5 py-3 border-t border-surface-sunken first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[13px] font-semibold text-gray-900">
                        {sentenceCase(tokenRows[0].event)}
                      </p>
                      <p className="m-0 mt-0.5 text-[11px] text-gray-400">
                        {tokenRows[0].platformRoleName ?? "System"} · {tokenRows.length} events
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="m-0 text-[11px] text-gray-400">
                        {tokenTimes[0]}–{tokenTimes[tokenTimes.length - 1]}
                      </p>
                      {!showAllToken && (
                        <Button
                          variant="tertiary"
                          size="xs"
                          fullWidth={false}
                          className="text-brand! px-0! py-0! h-auto!"
                          onClick={() => setShowAllToken(true)}
                        >
                          Show all
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    key={entry.item.id}
                    className="flex items-start justify-between gap-3 px-5 py-3 border-t border-surface-sunken first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[13px] font-semibold text-gray-900">
                        {activityTitle(entry.item)}
                      </p>
                      <p className="m-0 mt-0.5 text-[11px] text-gray-400">
                        {activitySubtitle(entry.item)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {fmtTime(entry.item.occurredAt)}
                    </span>
                  </div>
                ),
              )}
              <p className="m-0 px-5 py-3 text-[11px] text-gray-400 border-t border-surface-sunken">
                Refresh-token events are grouped by default. Actors show as names, not UUIDs.
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
