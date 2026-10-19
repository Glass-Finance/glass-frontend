import GlassModal from "../common/GlassModal";

// Dashboard geometry and tokens with the shared modal's focus/scroll behavior.
export default function DashboardDialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "default",
  closeDisabled = false,
}) {
  return (
    <GlassModal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      closeDisabled={closeDisabled}
      appearance="dashboard"
      className={size === "wide" ? "max-w-3xl" : size === "detail" ? "max-w-2xl" : "max-w-md"}
      footer={footer}
    >
      {children}
    </GlassModal>
  );
}
