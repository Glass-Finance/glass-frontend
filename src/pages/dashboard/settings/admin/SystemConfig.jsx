import { useState } from "react";
import { useEscapeToClose } from "../../../../hooks/useKeyboardShortcuts";
import {
  Search,
  SlidersHorizontal,
  Edit2,
  X,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useSystemConfigs } from "../../../../hooks/useSystemConfigs";
import { useDebounce } from "../../../../hooks/useDebounce";
import LoadingState from "../../../../components/common/LoadingState";
import { Button } from "../../../../components/ui/Button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  SCHEDULER: { bg: "bg-purple-50", text: "text-purple-700" },
  PAYMENT: { bg: "bg-blue-50", text: "text-blue-700" },
  NOTIFICATION: { bg: "bg-amber-50", text: "text-amber-700" },
  SECURITY: { bg: "bg-red-50", text: "text-red-700" },
  GENERAL: { bg: "bg-gray-100", text: "text-gray-600" },
};

function CategoryBadge({ category }) {
  const c = CATEGORY_COLORS[category] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span
      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      {category}
    </span>
  );
}

function EnvBadge({ environment }) {
  return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
      {environment}
    </span>
  );
}

function ValueCell({ value, valueType }) {
  if (valueType === "BOOLEAN") {
    const on = value === "true" || value === true;
    return (
      <span
        className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
          on ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"
        }`}
      >
        {on ? "true" : "false"}
      </span>
    );
  }
  return (
    <span
      className="text-[11px] text-gray-800 font-mono block truncate max-w-[180px]"
      title={value ?? ""}
    >
      {value ?? <span className="text-gray-300">—</span>}
    </span>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ config, onClose, onSave, isSaving }) {
  const [form, setForm] = useState({
    value: config.value ?? "",
    name: config.name ?? "",
    description: config.description ?? "",
  });

  useEscapeToClose(onClose);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  const isBool = config.valueType === "BOOLEAN";

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-bg rounded-2xl w-full max-w-md shadow-2xl border border-surface-container-border">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Edit Configuration</h2>
            <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{config.key}</p>
          </div>
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className=""
          >
            <X size={15} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Meta info row */}
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={config.category} />
            <EnvBadge environment={config.environment} />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stacked-container text-ink-muted">
              {config.valueType}
            </span>
          </div>

          {/* Value */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Value</label>
            {isBool ? (
              <div className="flex gap-2">
                {["true", "false"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, value: v }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      form.value === v
                        ? "bg-brand text-white border-brand"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type={config.valueType === "NUMBER" ? "number" : "text"}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full h-12 min-h-8 px-4 py-1 rounded-lg text-placeholder text-gray-800 outline-none transition-colors border border-hairline-strong focus:border-brand"
                placeholder={`Enter ${(config.valueType ?? "value").toLowerCase()}…`}
              />
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Display Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-12 min-h-8 px-4 py-1 rounded-lg text-placeholder text-gray-800 outline-none transition-colors border border-hairline-strong focus:border-brand"
              placeholder="Human-readable label"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full h-12 min-h-8 px-4 py-1 rounded-lg text-placeholder text-gray-800 outline-none transition-colors resize-none border border-hairline-strong focus:border-brand"
              placeholder="What does this configuration control?"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline-neutral"
              onClick={onClose}
              fullWidth={false}
              size="sm"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSaving} fullWidth={false} size="sm" className="flex-1">
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function SystemConfig() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);

  // Debounce search to avoid firing a request on every keystroke
  const debouncedSetSearch = useDebounce((val) => {
    setDebouncedSearch(val);
    setPage(0);
  });

  function handleSearchChange(val) {
    setSearch(val);
    debouncedSetSearch(val);
  }

  const params = {
    page,
    size: PAGE_SIZE,
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
  };

  const { data, isLoading, isFetching, error, update } = useSystemConfigs(params);
  const configs = data.content;
  const totalPages = data.totalPages;
  const totalElements = data.totalElements;

  // Derive categories from the current full page so the tab list stays stable
  const availableCategories = [
    "ALL",
    ...Array.from(new Set(configs.map((c) => c.category).filter(Boolean))).sort(),
  ];

  function handleSave(form) {
    update.mutate({ id: editing.id, payload: form }, { onSuccess: () => setEditing(null) });
  }

  function handleCategoryChange(cat) {
    setActiveCategory(cat);
    setPage(0);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (error?.response?.status === 403) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
          <X size={18} className="text-danger" />
        </div>
        <p className="text-sm font-semibold text-gray-800">Access Denied</p>
        <p className="text-xs text-gray-400">
          You don't have permission to view system configurations.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Top bar — search + refresh */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">System Configuration</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Platform-level settings that control scheduler, payment, and notification behaviour.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isFetching && !isLoading && (
            <RefreshCw size={13} className="text-gray-400 animate-spin" />
          )}
          <div className="relative">
            <Search
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search configs…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-lg text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-brand transition-colors border border-hairline-strong w-[200px] bg-white"
            />
          </div>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {availableCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              activeCategory === cat
                ? "bg-brand text-white border-brand"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container rounded-2xl overflow-hidden border border-surface-container-border">
        {isLoading ? (
          <LoadingState className="py-20" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-xs text-danger font-medium">Failed to load configurations</p>
            <p className="text-xs text-gray-400">{error?.message ?? "Unknown error"}</p>
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <SlidersHorizontal size={20} className="text-gray-200" />
            <p className="text-xs text-gray-400">No configurations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stacked-container">
                  {["Key", "Name", "Value", "Category", "Type", "Env", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg, i) => (
                  <tr
                    key={cfg.id}
                    className={`group transition-colors hover:bg-gray-50 ${i < configs.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
                  >
                    {/* Key */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <span
                        className="text-[11px] text-gray-700 font-mono block truncate"
                        title={cfg.key}
                      >
                        {cfg.key}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <span
                        className="text-[12px] text-gray-800 font-medium block truncate"
                        title={cfg.name}
                      >
                        {cfg.name || <span className="text-gray-300">—</span>}
                      </span>
                      {cfg.description && (
                        <span
                          className="text-[10px] text-gray-400 block truncate mt-0.5"
                          title={cfg.description}
                        >
                          {cfg.description}
                        </span>
                      )}
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3">
                      <ValueCell value={cfg.value} valueType={cfg.valueType} />
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CategoryBadge category={cfg.category} />
                    </td>

                    {/* Value Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {cfg.valueType}
                      </span>
                    </td>

                    {/* Environment */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EnvBadge environment={cfg.environment} />
                    </td>

                    {/* Edit */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        fullWidth={false}
                        onClick={() => setEditing(cfg)}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 size={11} />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-[11px] text-gray-400">
            {totalElements} configuration{totalElements !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="tertiary"
              size="icon-md"
              aria-label="Back"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className=""
            >
              <ChevronLeft size={13} />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => Math.abs(i - page) <= 2)
              .map((i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                    i === page
                      ? "bg-brand text-white border-none"
                      : "bg-white text-gray-500 hover:bg-gray-100 border border-surface-container-border"
                  }`}
                >
                  {i + 1}
                </button>
              ))}

            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Next"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className=""
            >
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          config={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          isSaving={update.isPending}
        />
      )}
    </div>
  );
}
