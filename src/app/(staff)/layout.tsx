import Link from "next/link";

import { signOutStaff } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/auth";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="space-x-5 text-sm font-medium text-slate-700">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/trips">Trips</Link>
            <Link href="/ops">Ops</Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{session?.user?.email ?? "Not signed in"}</span>
            {session ? (
              <form action={signOutStaff}>
                <Button type="submit" variant="ghost" className="px-3 py-1.5">
                  Sign out
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
