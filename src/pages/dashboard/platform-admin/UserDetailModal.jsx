import GlassModal from "../../../components/common/GlassModal";
import LoadingState from "../../../components/common/LoadingState";
import PulseImg from "../../../components/common/PulseImg";
import { Button } from "../../../components/ui/Button";
import { useAdminKycUser } from "../../../hooks/useAdminKyc";
import { getErrorMessage } from "../../../utils/errorHandler";
import { toTitleCase } from "../../../utils/format";
import { kycStatusLabel } from "../../../utils/kycStatus";
import { parseUserData } from "../../../utils/userData";
import { getInitials } from "../../../utils/getInitials";
import { fmtDateTime } from "./shared";

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 break-words m-0">{value ?? "—"}</dd>
    </div>
  );
}

const yesNo = (value) => (value == null ? null : value ? "Yes" : "No");
const METRICS = [
  ["Communities owned", "communitiesOwned"],
  ["Communities joined", "communitiesJoined"],
  ["Related communities", "totalRelatedCommunities"],
  ["Pending invites", "pendingInvites"],
  ["Pending join requests", "pendingJoinRequests"],
];

export default function UserDetailModal({ userId, onClose }) {
  // The existing KYC query fetches the complete admin UserDto and shares its
  // cache with KYC actions; opening this view refetches that same endpoint.
  const { data, isLoading, error, refetch, isFetching } = useAdminKycUser(userId);
  const user = data?.id ? data : null;
  const profile = parseUserData(user);
  const denied = error?.response?.status === 403;
  const name =
    [profile.firstName, profile.lastName]
      .filter((part) => typeof part === "string" && part.trim())
      .map((part) => toTitleCase(part.trim()))
      .join(" ") || user?.accountName;

  return (
    <GlassModal
      appearance="dashboard"
      className="sm:max-w-3xl"
      title="User details"
      subtitle={user?.email}
      onClose={onClose}
    >
      {isLoading ? (
        <div role="status">
          <LoadingState className="py-10" />
          <span className="sr-only">Loading user details…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            {denied
              ? "You do not have permission to view this user."
              : getErrorMessage(error, "Unable to load user details.")}
          </p>
          {!denied && (
            <Button
              variant="outline-neutral"
              size="sm"
              fullWidth={false}
              loading={isFetching}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          )}
        </div>
      ) : !user ? (
        <p className="text-sm text-gray-500">User details are unavailable.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4 rounded-g-1 bg-gray-50 border border-gray-200 p-4">
            <PulseImg
              key={profile.profileImage?.url ?? "no-photo"}
              src={profile.profileImage?.url}
              alt={`${name || "User"} profile picture`}
              className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-g-1 bg-brand/10 text-brand text-xl font-semibold"
              fallback={<span>{getInitials({ ...profile, email: user.email })}</span>}
            />
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
                {name || user.email || "User"}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {user.enabled == null
                  ? "Account status unavailable"
                  : user.enabled
                    ? "Active account"
                    : "Suspended account"}
              </p>
            </div>
          </div>
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Account overview</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
              <Field label="User ID" value={user.id} />
              <Field label="Email" value={user.email} />
              <Field label="Phone" value={user.phoneNumber} />
              <Field label="Account name" value={user.accountName} />
              <Field label="External reference" value={user.externalReference} />
              <Field label="Timezone" value={user.timezone} />
              <Field label="Platform role" value={user.platformRole} />
              <Field label="Platform administrator" value={yesNo(user.isPlatformAdmin)} />
              <Field label="Account enabled" value={yesNo(user.enabled)} />
              <Field label="Account not expired" value={yesNo(user.accountNonExpired)} />
              <Field label="Account unlocked" value={yesNo(user.accountNonLocked)} />
              <Field label="Credentials not expired" value={yesNo(user.credentialsNonExpired)} />
            </dl>
          </section>
          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Verification and KYC</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
              <Field label="Email verified" value={yesNo(user.emailVerified)} />
              <Field label="Phone verified" value={yesNo(user.phoneVerified)} />
              <Field label="MFA enabled" value={yesNo(user.mfaEnabled)} />
              <Field label="Email verified at" value={fmtDateTime(user.emailVerifiedAt)} />
              <Field label="Phone verified at" value={fmtDateTime(user.phoneVerifiedAt)} />
              <Field
                label="KYC status"
                value={user.kycStatus ? kycStatusLabel(user.kycStatus) : null}
              />
              <Field label="KYC approved at" value={fmtDateTime(user.kycApprovedAt)} />
              <Field label="KYC attempts allowed" value={yesNo(user.kycAttemptsAllowed)} />
              <Field label="KYC restriction reason" value={user.kycRestrictionReason} />
            </dl>
          </section>
          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Community activity</h3>
            {user.metrics ? (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 m-0 bg-gray-50 rounded-g-1 p-4">
                {METRICS.map(([label, key]) => (
                  <Field key={key} label={label} value={user.metrics[key]} />
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Metrics unavailable</p>
            )}
          </section>
          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 m-0">
              <Field label="Last login" value={fmtDateTime(user.lastLoginAt)} />
              <Field label="Created" value={fmtDateTime(user.createdAt)} />
              <Field label="Updated" value={fmtDateTime(user.updatedAt)} />
            </dl>
          </section>
        </div>
      )}
    </GlassModal>
  );
}
