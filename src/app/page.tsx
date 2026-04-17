import Link from "next/link";

import { signInWithDevCredentials, signInWithGoogle, signOutStaff } from "@/app/auth-actions";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth/auth";
import { resolveAuthRedirectTo } from "@/lib/auth/redirects";
import { env } from "@/lib/env/server";
import { listTrips } from "@/modules/trips/service";

export const dynamic = "force-dynamic";

const authErrorMessages: Record<string, string> = {
  AccessDenied: "Your account is not allowed to sign in.",
  Configuration: "Authentication is not fully configured.",
  CredentialsSignin: "Sign-in failed. Check the local staff credentials and allowlist settings.",
  Default: "Unable to start the sign-in flow.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const trips = await listTrips().catch(() => []);
  const { callbackUrl, error } = await searchParams;
  const redirectTo = resolveAuthRedirectTo(callbackUrl);
  const googleConfigured = Boolean(env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET);
  const devCredentialsEnabled = env.AUTH_ENABLE_DEV_CREDENTIALS;
  const authError = error ? authErrorMessages[error] ?? authErrorMessages.Default : null;

  return (
    <AppShell
      title="One operational hub for trip applications, documents, billing, and readiness"
      description="This v1 keeps staff in one internal app while delegating signatures to DocuSeal and accounting truth to QuickBooks. Public users never need accounts; staff gets Google Workspace SSO and a shared dashboard."
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="bg-slate-950 text-white">
          <div className="space-y-5">
            <Badge tone="sky">Built for low-ops nonprofit operations</Badge>
            <h2 className="text-2xl font-semibold tracking-tight">
              Designed around bursty seasonal travel workflows, not enterprise bloat.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-300">
              Trips, enrollments, confirmations, packet status, insurance, invoicing, payment tracking,
              reminders, and readiness all live here. External providers stay replaceable behind service
              abstractions and a Postgres-backed job model.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button variant="primary">Open staff dashboard</Button>
              </Link>
              <Link href="#staff-sign-in">
                <Button
                  variant="ghost"
                  className="border border-white/15 text-white hover:bg-white/10"
                >
                  {session ? "Manage sign-in" : "Staff sign-in"}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-950">Workflow coverage</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Public trip applications with duplicate detection</li>
              <li>Guardian or alternate confirmer token links</li>
              <li>DocuSeal packets with insurance-card metadata tracking</li>
              <li>QuickBooks invoice creation and payment reconciliation</li>
              <li>Reminder cadence, ops queues, audit trail, and readiness state</li>
            </ul>
          </div>
        </Card>
      </section>
      <section id="staff-sign-in" className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-950">Staff access</h2>
            <p className="text-sm leading-7 text-slate-600">
              Use Google Workspace SSO in production. Local staff credentials remain available for development when enabled.
            </p>
            {redirectTo !== "/dashboard" ? (
              <p className="text-sm text-slate-500">
                After sign-in, you will continue to <span className="font-medium text-slate-900">{redirectTo}</span>.
              </p>
            ) : null}
          </div>
          {authError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {authError}
            </div>
          ) : null}
          {session?.user?.email ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Signed in as <span className="font-medium text-slate-950">{session.user.email}</span>.
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <Button>Open dashboard</Button>
                </Link>
                <form action={signOutStaff}>
                  <Button type="submit" variant="ghost">Sign out</Button>
                </form>
              </div>
            </div>
          ) : googleConfigured ? (
            <form action={signInWithGoogle} className="space-y-3">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button type="submit" className="w-full">Continue with Google</Button>
              <p className="text-xs text-slate-500">
                Register <span className="font-medium text-slate-700">{`${env.APP_URL}/api/auth/callback/google`}</span> as an allowed Google OAuth redirect URI.
              </p>
            </form>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Google OAuth is not configured yet. Set <code>AUTH_GOOGLE_CLIENT_ID</code> and <code>AUTH_GOOGLE_CLIENT_SECRET</code> to enable staff SSO.
            </div>
          )}
        </Card>
        <Card className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-950">Local development login</h2>
            <p className="text-sm leading-7 text-slate-600">
              Use this only for local development. Production staff access should go through Google OAuth.
            </p>
          </div>
          {devCredentialsEnabled ? (
            <form action={signInWithDevCredentials} className="grid gap-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Field
                label="Email"
                description="Must pass the configured allowlist or domain checks."
              >
                <Input
                  name="email"
                  type="email"
                  required
                  defaultValue={env.AUTH_DEV_USER_EMAIL}
                />
              </Field>
              <Field label="Display name">
                <Input
                  name="name"
                  required
                  defaultValue={env.AUTH_DEV_USER_NAME}
                />
              </Field>
              <div className="flex items-center gap-3">
                <Button type="submit" variant="secondary">Sign in locally</Button>
                <span className="text-xs text-slate-500">Enabled by <code>AUTH_ENABLE_DEV_CREDENTIALS=true</code>.</span>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Local staff credentials are disabled in this environment.
            </div>
          )}
        </Card>
      </section>
      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-950">Open trips</h2>
          <Link href="/trips">
            <Button variant="secondary">Manage trips</Button>
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {trips.length > 0 ? (
            trips.map((trip) => (
              <Card key={trip.id}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-950">{trip.name}</h3>
                    <Badge tone={trip.requiresStaffReview ? "amber" : "emerald"}>
                      {trip.requiresStaffReview ? "Review required" : "Auto-confirm"}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{trip.description}</p>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{trip.seasonYear} season</span>
                    <span>${(trip.basePriceCents / 100).toFixed(2)}</span>
                  </div>
                  <Link href={`/trips/${trip.slug}`}>
                    <Button>View trip</Button>
                  </Link>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-600">
                No trips have been created yet. Seed demo data or add a trip from the staff side.
              </p>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}
