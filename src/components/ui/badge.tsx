import { cn } from "@/lib/utils/cn";

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "amber" | "emerald" | "rose" | "sky";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "slate" && "bg-slate-100 text-slate-700",
        tone === "amber" && "bg-amber-100 text-amber-800",
        tone === "emerald" && "bg-emerald-100 text-emerald-800",
        tone === "rose" && "bg-rose-100 text-rose-800",
        tone === "sky" && "bg-sky-100 text-sky-800",
      )}
    >
      {children}
    </span>
  );
}
