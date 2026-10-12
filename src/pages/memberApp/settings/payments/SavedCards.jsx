import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { CreditCard, Trash2 } from "lucide-react";
import { useManagePayments } from "../../../../hooks/usePayments";
import PageLoadingState from "../../../../components/common/PageLoadingState";
import ConfirmSheet from "../../../../components/memberApp/ConfirmSheet";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

export default function SavedCards() {
  const navigate = useNavigate();
  const { data, isLoading, error, toggleAutoPay, isRemoving } = useManagePayments();
  const [removingItem, setRemovingItem] = useState(null);

  function handleDelete(item) {
    setRemovingItem(item);
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => goBackInApp(navigate, "/member/settings")}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">Payment Methods</h1>
      </div>

      <div className="px-4">
        {data.length > 0 && (
          <p className="text-[14px] font-medium text-black/60 mt-0 mx-1 mb-2">Saved Cards</p>
        )}
        <div className="rounded-xl bg-surface-container border border-black/10 overflow-hidden">
          {isLoading ? (
            <PageLoadingState size={56} padding="36px 24px" />
          ) : error ? (
            <p className="text-center text-danger text-[13px] py-6">
              Couldn't load saved payment methods.
            </p>
          ) : data.length === 0 ? (
            // Shaped like a real card row below (same w-9 h-9 rounded-[10px]
            // icon tile, same flex layout) but dashed and empty.
            <div className="flex items-center gap-3 py-3.5 px-4">
              <div className="w-9 h-9 rounded-[10px] flex-shrink-0 border-2 border-dashed border-gray-200" />
              <p className="text-sm text-ink-ghost m-0">No saved cards yet</p>
            </div>
          ) : (
            data.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 py-3.5 px-4 ${i < data.length - 1 ? "border-b border-black/10" : "border-b-0"}`}
              >
                <div className="w-9 h-9 rounded-[10px] bg-brand-wash flex items-center justify-center flex-shrink-0">
                  <CreditCard size={16} className="text-brand-deep" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink m-0">
                    {item.bank ?? "Card"} •••{item.last4 ?? "----"}
                  </p>
                  {item.channel && (
                    <p className="text-xs text-ink-ghost mt-0.5 mx-0 mb-0">{item.channel}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={isRemoving}
                  aria-label="Remove saved card"
                  className={`bg-transparent border-none cursor-pointer p-1.5 flex-shrink-0 ${isRemoving ? "opacity-50" : "opacity-100"}`}
                >
                  <Trash2 size={16} className="text-danger" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {removingItem && (
        <ConfirmSheet
          icon={Trash2}
          title={`Remove ${removingItem.bank ? `${removingItem.bank} ***${removingItem.last4}` : `***${removingItem.last4}`}?`}
          description="Any auto-pay tied to this method will stop, and it won't be usable for future payments."
          confirmLabel="Yes, remove"
          confirmingLabel="Removing…"
          confirming={isRemoving}
          onCancel={() => setRemovingItem(null)}
          onConfirm={() =>
            toggleAutoPay(removingItem.id, false, { onSuccess: () => setRemovingItem(null) })
          }
        />
      )}
    </div>
  );
}
