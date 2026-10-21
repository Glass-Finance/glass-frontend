import { Info } from "lucide-react";
import { Skeleton } from "../../../../components/common/SkeletonUI";

export default function DashboardStats({ stats, isLoading, error = null }) {
  return (
    // 2x2 below md (Figma node 332:19196), then auto-fit/minmax above it
    // (was a single full-width column on mobile and grid-cols-3/lg:grid-cols-5
    // on desktop) -- that jumped straight from 3 to 5
    // columns at the lg breakpoint, and 5-across didn't leave enough width
    // for the longer labels ("Inactive Members", "Overdue Members") to fit
    // on one line right around 1024px, while the shorter labels stayed
    // single-line and threw the row out of alignment. This sizes each card
    // to whatever the row actually has room for instead of a hardcoded
    // column count.
    <div className="grid grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2.5 md:gap-3 mb-5">
      {stats.map((s, index) => (
        <div
          key={s.label}
          // The four primary cards keep Figma's 108px mobile height; the fifth
          // spans both columns as a compact horizontal card so it doesn't sit
          // alone in a third row. Desktop cards retain the shared
          // StatCard.jsx sizing used by Members/Payments/MemberDetail.
          className={`${
            index === 4
              ? "col-span-2 min-h-[76px] flex-row items-center px-4 py-3 md:col-span-1 md:min-h-[108px] md:flex-col md:items-stretch md:justify-between md:p-4"
              : "min-h-[108px] flex-col justify-between px-3 py-4 md:p-4"
          } flex bg-surface-container rounded-g-2 border border-surface-container-border`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs md:text-sm text-gray-500 font-medium">{s.label}</span>
            <Info size={15} className="text-brand flex-shrink-0" />
          </div>
          <div className="flex items-center gap-3">
            <img
              src={s.icon}
              alt={s.label}
              className="w-8 h-8 object-contain flex-shrink-0"
              loading="lazy"
            />
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : error ? (
              // The stat cards are money and counts, so falling through to the
              // "0" fallbacks the parent computes on a failed fetch reads as a
              // real zero-contributions community rather than a load failure.
              <span className="text-sm font-medium text-danger">Couldn't load</span>
            ) : (
              <span className="text-base md:text-xl font-medium md:font-bold text-black">
                {s.value}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
