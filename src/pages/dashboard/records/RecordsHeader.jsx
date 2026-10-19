import RecordsTabs from "./RecordsTabs";
export default function RecordsHeader({
  identifier,
  description = "A clear view of your community's payments, expenses, and other records.",
  children,
}) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-black">Records</h1>
          <p className="text-sm text-ink-ghost mt-0.5">{description}</p>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </header>
      <RecordsTabs identifier={identifier} />
    </>
  );
}
