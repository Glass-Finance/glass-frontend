import { NavLink } from "react-router-dom";
export default function RecordsTabs({ identifier }) {
  const suffix = `?community=${encodeURIComponent(identifier ?? "")}`;
  return (
    <nav aria-label="Record book" className="flex gap-6 border-b border-black/10 mb-6">
      {[
        ["All records", "/dashboard/records"],
        ["Imports", "/dashboard/records/imports"],
      ].map(([label, path]) => (
        <NavLink
          key={path}
          to={path + suffix}
          end={path === "/dashboard/records"}
          className={({ isActive }) =>
            `py-3 text-sm font-medium border-b-2 ${isActive ? "border-brand text-brand" : "border-transparent text-ink-muted"}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
