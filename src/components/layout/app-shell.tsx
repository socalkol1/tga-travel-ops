import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5fb_40%,#f8fafc_100%)]">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold text-white">
              TGA
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Travel Operations</div>
              <div className="text-xs text-slate-500">Nonprofit internal system of record</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Badge tone="sky">V1 foundation</Badge>
            <Link href="/dashboard" className="text-sm font-medium text-slate-700 hover:text-sky-700">
              Staff dashboard
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
        <div className="max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="text-base leading-7 text-slate-600">{description}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
