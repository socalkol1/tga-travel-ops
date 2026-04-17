export function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
      {description ? (
        <span className="text-xs font-normal text-slate-500">{description}</span>
      ) : null}
    </label>
  );
}
