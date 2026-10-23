import { Skeleton } from "../common/SkeletonUI";

function SkeletonRegion({ label, children, className = "" }) {
  return (
    <div role="status" aria-label={label} aria-live="polite" aria-busy="true" className={className}>
      {children}
    </div>
  );
}

export function UpcomingPaymentsSkeleton() {
  return (
    <SkeletonRegion label="Loading upcoming payments" className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center justify-between gap-3 rounded-2xl border border-surface-container-border bg-white px-4 py-[18px]"
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-5 w-28" />
            <Skeleton className="mb-2 h-4 w-3/4 max-w-52" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-10 w-24 flex-shrink-0" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function TransactionsSkeleton() {
  return (
    <SkeletonRegion
      label="Loading payment history"
      className="mx-3 mb-3 overflow-hidden rounded-2xl bg-surface-container md:mx-0"
    >
      <div aria-hidden="true" className="border-b border-stacked-container px-5 py-3">
        <Skeleton className="h-4 w-28" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center justify-between gap-2 border-b border-stacked-container bg-white px-5 py-3.5"
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-2/3 max-w-56" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function InviteCardsSkeleton({ count = 2 }) {
  return (
    <SkeletonRegion label="Loading invitations" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-2xl border border-surface-container-border bg-white p-3.5"
        >
          <div className="mb-3.5 flex items-center gap-3">
            <Skeleton className="h-10 w-10 flex-shrink-0 rounded-[10px]" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-2/3 max-w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function NotificationsSkeleton() {
  return (
    <SkeletonRegion
      label="Loading notifications"
      className="flex flex-col gap-4 rounded-2xl border border-surface-container-border bg-white p-4"
    >
      <div aria-hidden="true">
        <Skeleton className="mb-3 h-4 w-20" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-start gap-3 py-2">
              <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-4 w-3/4 max-w-60" />
                <Skeleton className="mb-2 h-3.5 w-full max-w-72" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function CommunityCardsSkeleton() {
  return (
    <SkeletonRegion label="Loading communities">
      <div className="hidden grid-cols-1 gap-5 md:grid lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="rounded-g-2 border border-surface-container-border bg-white p-5"
          >
            <div className="flex min-h-[54px] items-start gap-3.5">
              <Skeleton className="h-[52px] w-[52px] flex-shrink-0 rounded-full" />
              <div className="flex-1 pt-1">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-g-1" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-surface-container-border pt-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 md:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="flex items-center gap-3 rounded-2xl border border-surface-container-border bg-white p-3.5"
          >
            <Skeleton className="h-11 w-11 flex-shrink-0 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-2/3" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SavedCardsSkeleton() {
  return (
    <SkeletonRegion label="Loading saved payment methods">
      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`flex items-center gap-3 border-black/10 px-4 py-3.5 ${index === 0 ? "border-b" : ""}`}
        >
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-[10px]" />
          <div className="flex-1">
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function AutoPayRowsSkeleton() {
  return (
    <SkeletonRegion label="Loading Auto-Pay plans">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`flex items-center justify-between gap-3 p-4 ${index < 2 ? "border-b border-black/10" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-2/3 max-w-52" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="h-5 w-8 flex-shrink-0 rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function ManagePlanCardsSkeleton() {
  return (
    <SkeletonRegion label="Loading payment plans" className="flex flex-col gap-3.5">
      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-surface-container-border bg-white"
        >
          <div className="px-4 pb-3.5 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-11 w-11 rounded-[10px]" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mb-2 h-5 w-28" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-3.5 w-40" />
          </div>
          <div className="flex items-center justify-between border-t border-hairline-soft px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function VerificationAttemptsSkeleton() {
  return (
    <SkeletonRegion
      label="Loading verification history"
      className="overflow-hidden rounded-2xl border border-surface-container-border bg-surface-container"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center justify-between gap-3 border-b border-stacked-container bg-white px-5 py-3.5"
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-6 w-20 flex-shrink-0 rounded-md" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function TwoFactorSettingsSkeleton() {
  return (
    <SkeletonRegion label="Loading security settings" className="flex flex-col gap-4">
      <div
        aria-hidden="true"
        className="flex items-center gap-3.5 rounded-2xl border border-surface-container-border bg-white px-4 py-5"
      >
        <Skeleton className="h-11 w-11 flex-shrink-0 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-4 w-48 max-w-full" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border border-surface-container-border bg-white"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`flex items-center justify-between gap-3 px-4 py-4 ${index < 2 ? "border-b border-surface-container-border" : ""}`}
          >
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-36" />
              <Skeleton className="h-3.5 w-56 max-w-full" />
            </div>
            <Skeleton className="h-10 w-24 flex-shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
