import { NavLink } from "react-router-dom";
import { BookOpen, FileSpreadsheet } from "lucide-react";
export default function RecordsTabs({ identifier }) {
  const suffix = `?community=${encodeURIComponent(identifier ?? "")}`;
  return (
    <nav
      aria-label="Record book"
      className="inline-flex gap-1 mb-5 bg-stacked-container rounded-g-1 p-1"
    >
      {[
        ["All records", "/dashboard/records", BookOpen],
        ["Imports", "/dashboard/records/imports", FileSpreadsheet],
      ].map(([label, path, Icon]) => (
        <NavLink
          key={path}
          to={path + suffix}
          end={path === "/dashboard/records"}
          className={({ isActive }) =>
            `inline-flex min-h-10 md:min-h-7 items-center gap-1.5 rounded-g-1 px-4 py-1.5 text-xs font-medium transition-colors ${isActive ? "bg-white text-ink border border-black/5 shadow-sm" : "border border-transparent text-ink-muted hover:text-ink"}`
          }
        >
          <Icon size={13} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
