import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { MoreHorizontal, Pencil, Bell, Users, Pause, Play, Trash2 } from "lucide-react";
import { usePaymentPlanAccess } from "../../../hooks/usePaymentPlanAccess";
import { getErrorMessage } from "../../../utils/errorHandler";
import ConfirmDialog from "../../../components/dashboard/ConfirmDialog";

function MenuItem({ icon, label, onClick, disabled, danger, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium bg-transparent border-none cursor-pointer transition-colors text-left
        ${disabled ? "text-gray-300 cursor-not-allowed" : danger ? "text-danger hover:bg-danger-wash" : "text-gray-700 hover:bg-gray-50"}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
}

export default function PlanOverflowMenu({ plan, planPlans, onEdit, onViewMembers, onDuplicate }) {
  const [open, setOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { canDelete } = usePaymentPlanAccess();
  const status = plan.status;
  const isActive = status === "ACTIVE";
  const isPaused = status === "PAUSED";
  const isDraft = status === "DRAFT";
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <Button
        variant="tertiary"
        size="icon-sm"
        aria-label="More options"
        onClick={() => setOpen((o) => !o)}
        className=""
      >
        <MoreHorizontal size={14} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-surface-container-border shadow-xl z-20 overflow-hidden min-w-[180px] py-1">
            <MenuItem
              icon={<Pencil size={13} />}
              label="Edit Plan"
              onClick={() => {
                onEdit(plan);
                close();
              }}
            />
            {/* On-demand reminders have no backend route yet (the
                plan-level reminderFrequency/reminderChannels cadence on
                create/update does). Kept visible but inert, matching the
                disabled "coming soon" affordance in Members.jsx. */}
            <MenuItem
              icon={<Bell size={13} />}
              label="Send Reminder"
              disabled
              title="Send Reminder — coming soon"
            />
            <MenuItem
              icon={<Users size={13} />}
              label="View Members"
              onClick={() => {
                onViewMembers(plan);
                close();
              }}
            />
            {(isActive || isPaused) && (
              <>
                <div className="h-px bg-gray-100 my-1" />
                {isActive && (
                  <MenuItem
                    icon={<Pause size={13} />}
                    label="Pause Plan"
                    onClick={() => {
                      planPlans.pause.mutate(plan.id);
                      close();
                    }}
                  />
                )}
                {isPaused && (
                  <MenuItem
                    icon={<Play size={13} />}
                    label="Resume Plan"
                    onClick={() => {
                      planPlans.resume.mutate(plan.id);
                      close();
                    }}
                  />
                )}
                <MenuItem
                  icon={<Trash2 size={13} />}
                  label="End Plan"
                  danger
                  onClick={() => {
                    setConfirmingEnd(true);
                    close();
                  }}
                />
              </>
            )}
            {isDraft && (
              <>
                <div className="h-px bg-gray-100 my-1" />
                <MenuItem
                  label="Activate"
                  onClick={() => {
                    planPlans.activate.mutate(plan.id);
                    close();
                  }}
                />
              </>
            )}
            {isDraft && canDelete && (
              <>
                <div className="h-px bg-gray-100 my-1" />
                <MenuItem
                  icon={<Trash2 size={13} />}
                  label="Delete"
                  danger
                  disabled={planPlans.delete.isPending}
                  onClick={() => {
                    planPlans.delete.reset();
                    setConfirmingDelete(true);
                    close();
                  }}
                />
              </>
            )}
            {status !== "DELETED" && (
              <MenuItem
                label="Duplicate"
                onClick={() => {
                  onDuplicate(plan);
                  close();
                }}
              />
            )}
          </div>
        </>
      )}

      {confirmingEnd && (
        <ConfirmDialog
          title="End Plan"
          subtitle={plan.name}
          description={`This can't be undone -- it can't be reactivated afterward, only duplicated as a new plan.`}
          confirmLabel="End Plan"
          confirmingLabel="Ending…"
          confirming={planPlans.expire.isPending}
          onClose={() => setConfirmingEnd(false)}
          onConfirm={() =>
            planPlans.expire.mutate(plan.id, { onSuccess: () => setConfirmingEnd(false) })
          }
        />
      )}

      {confirmingDelete && isDraft && canDelete && (
        <ConfirmDialog
          title="Delete Plan"
          subtitle={plan.name}
          description="This permanently deletes this draft payment plan. This cannot be undone. Plans with payment or billing history cannot be deleted."
          confirmLabel="Delete"
          confirmingLabel="Deleting…"
          confirming={planPlans.delete.isPending}
          confirmDisabled={planPlans.delete.isPending}
          error={planPlans.delete.error ? getErrorMessage(planPlans.delete.error) : ""}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={() =>
            planPlans.delete.mutate(plan.id, { onSuccess: () => setConfirmingDelete(false) })
          }
        />
      )}
    </div>
  );
}
