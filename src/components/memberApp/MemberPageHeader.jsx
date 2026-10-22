import { MobileBackButton } from "../ui/MobileBackButton";

export default function MemberPageHeader({
  title,
  description,
  onBack,
  backLabel = "Back",
  action,
  className = "",
}) {
  return (
    <header
      className={`relative flex items-center justify-center px-5 pt-5 pb-5 md:items-start md:justify-between md:gap-6 md:px-0 md:pt-0 md:pb-6 ${className}`}
    >
      {onBack && (
        <MobileBackButton
          aria-label={backLabel}
          onClick={onBack}
          className="absolute left-5 md:hidden"
        />
      )}
      <div className="min-w-0 text-center md:text-left">
        <h1 className="m-0 text-lg font-medium text-ink md:text-2xl md:font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 hidden text-sm text-ink-muted md:block">{description}</p>
        )}
      </div>
      {action && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 md:static md:translate-y-0">
          {action}
        </div>
      )}
    </header>
  );
}
