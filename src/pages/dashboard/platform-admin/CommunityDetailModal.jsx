import GlassModal from "../../../components/common/GlassModal";
import LoadingState from "../../../components/common/LoadingState";
import { Button } from "../../../components/ui/Button";
import { useAdminCommunity } from "../../../hooks/useAdminCommunity";
import { getErrorMessage } from "../../../utils/errorHandler";
import { formatJson } from "../../../utils/formatJson";
import { fmt, fmtDateTime } from "./shared";
import { StatusBadge } from "./SharedUI";

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 break-words m-0">{value ?? "—"}</dd>
    </div>
  );
}

const MEMBER_METRICS = [
  ["Total members", "totalMembers"],
  ["Active members", "activeMembers"],
  ["Inactive members", "inactiveMembers"],
  ["Suspended members", "suspendedMembers"],
  ["Exited members", "exitedMembers"],
  ["Overdue members", "overdueMembers"],
  ["Active payment links", "activePaymentLinks"],
  ["Active recurring plans", "activeRecurringPlans"],
];

const yesNo = (value) => (value == null ? null : value ? "Yes" : "No");

export default function CommunityDetailModal({ identifier, onClose }) {
  const { data, isLoading, error, refetch, isFetching } = useAdminCommunity(identifier);
  const metrics = data?.metrics;
  const currency = metrics?.currency ?? data?.defaultCurrency;
  const money = (amount) =>
    amount == null ? null : currency ? fmt(amount, currency) : `${amount} (currency unavailable)`;
  const denied = error?.response?.status === 403;

  return (
    <GlassModal
      appearance="dashboard"
      className="rounded-g-1! sm:max-w-3xl"
      title="Community details"
      subtitle={data?.name}
      onClose={onClose}
    >
      <>
        {isLoading ? (
          <div role="status">
            <LoadingState className="py-10" />
            <span className="sr-only">Loading community details…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-danger">
              {denied
                ? "You do not have permission to view this community."
                : getErrorMessage(error, "Unable to load community details.")}
            </p>
            {!denied && (
              <Button
                variant="outline-neutral"
                size="sm"
                fullWidth={false}
                onClick={() => refetch()}
                loading={isFetching}
              >
                Retry
              </Button>
            )}
          </div>
        ) : !data ? (
          <p className="text-sm text-gray-500">Community details are unavailable.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              {data.logo?.url && (
                <img src={data.logo.url} alt="" className="w-12 h-12 rounded-g-1 object-cover" />
              )}
              <StatusBadge status={data.status} />
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
              <Field label="Community ID" value={data.id} />
              <Field label="Slug" value={data.slug} />
              <Field label="Description" value={data.description} />
              <Field label="Categories" value={data.category?.join(", ")} />
              <Field label="Contact email" value={data.contactEmail} />
              <Field label="Contact phone" value={data.contactPhone} />
              <Field label="Default currency" value={data.defaultCurrency} />
              <Field label="Member approval required" value={yesNo(data.requiresMemberApproval)} />
              <Field label="Publicly visible" value={yesNo(data.publicVisible)} />
              <Field label="Created" value={fmtDateTime(data.createdAt)} />
              <Field label="Updated" value={fmtDateTime(data.updatedAt)} />
            </dl>
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Members and payments</h3>
              {!metrics ? (
                <p className="text-sm text-gray-500">Metrics unavailable</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
                  {MEMBER_METRICS.map(([label, key]) => (
                    <Field key={key} label={label} value={metrics[key]} />
                  ))}
                  <Field label="Collected amount" value={money(metrics.collectedAmount)} />
                  <Field label="Outstanding amount" value={money(metrics.outstandingAmount)} />
                </dl>
              )}
            </section>
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Commission schedule</h3>
              {data.commissionSchedule == null ? (
                <p className="text-sm text-gray-500">Platform default</p>
              ) : (
                <pre className="m-0 p-3 rounded-g-1 border border-surface-container-border font-mono text-xs overflow-x-auto">
                  {formatJson(data.commissionSchedule) ?? data.commissionSchedule}
                </pre>
              )}
            </section>
          </div>
        )}
      </>
    </GlassModal>
  );
}
