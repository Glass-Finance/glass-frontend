// Shared on/off switch, consolidated out of 7 near-identical per-file copies
// (whose off-center knob was itself a real bug fixed separately in each copy
// before this existed). showLabel adds the "On"/"Off" text some settings
// rows use next to the switch.
export default function Toggle({ on, onChange, disabled, showLabel = false, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`flex items-center gap-1.5 flex-shrink-0 bg-transparent border-none p-0 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <div
        className={`relative w-8 h-[20px] rounded-full transition-all duration-300 ${on ? "bg-brand" : "bg-black/10"}`}
      >
        <div
          className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all duration-300 ${on ? "left-[15px]" : "left-[3px]"}`}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-medium ${on ? "text-gray-600" : "text-gray-400"}`}>
          {on ? "On" : "Off"}
        </span>
      )}
    </button>
  );
}
