import { X } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { toTitleCase, formatDate } from "../../../../utils/format";
import WarnSignIcon from "../../../../assets/dashboard/warn-sign.webp";
import { formatNaira } from "../helpers";
import { isPaidObligationStatus } from "../../../../utils/paymentStatus";

export default function UnpaidObligationAlert({
  myUpcoming,
  onPayNow,
  onDismiss,
  hasActiveAutoPay,
}) {
  const dueList = myUpcoming.filter((o) => !isPaidObligationStatus(o.status));
  const due = dueList[0];
  if (!due) return null;
  const othersDue = dueList.length - 1;
  const daysLeft = due.dueDate ? Math.ceil((new Date(due.dueDate) - new Date()) / 86400000) : null;

  return (
    // Figma's caution banner (node 346:19314): #ccdaff fill, #002fa7 @20%
    // stroke, a 4px radius, 12/16 padding, a 16px gap to a 16px icon, and body
    // copy at 12/400. The node reads radius 2, which is not on the 4/8/12/16
    // scale in DESIGN-SYSTEM.md §1.5, so the closest on-system value wins.
    // Stacks below sm: Figma draws the button past the banner's own edge at
    // 331px wide, so a fixed row would clip it on a phone.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-4 py-3 rounded-g-1 mb-5 bg-brand-100 border border-brand/20">
      <div className="flex items-start gap-4">
        <img
          src={WarnSignIcon}
          alt=""
          className="w-4 h-4 md:w-[26px] md:h-[26px] object-contain flex-shrink-0 mt-0.5 md:mt-1.5"
        />
        <div>
          <p className="text-xs font-normal text-ink m-0">
            Your {toTitleCase(due.name)} payment
            {daysLeft != null
              ? ` is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
              : " is due soon"}
          </p>
          <p className="text-xs font-normal text-ink/60 mt-1 mb-0">
            {formatNaira(due.amount)}
            {due.dueDate ? ` due ${formatDate(due.dueDate)}` : ""}
            {due.type === "recurring" && (
              <>
                {" · "}
                <span className="text-brand font-medium">
                  Auto-Pay is {hasActiveAutoPay(due) ? "on" : "off"}
                </span>
              </>
            )}
          </p>
          {othersDue > 0 && (
            <p className="text-xs font-medium text-brand mt-1 mb-0">
              + {othersDue} other payment{othersDue === 1 ? "" : "s"} due — see Your Payments below.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0">
        <Button variant="outline" size="xs" fullWidth={false} onClick={() => onPayNow(due)}>
          Pay Now
        </Button>
        <Button
          variant="tertiary"
          size="icon-sm"
          aria-label="Close"
          onClick={onDismiss}
          className=""
        >
          <X size={20} />
        </Button>
      </div>
    </div>
  );
}
