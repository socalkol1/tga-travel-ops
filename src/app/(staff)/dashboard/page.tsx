import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireStaffPageSession } from "@/lib/auth/auth";
import { listEnrollments } from "@/modules/enrollments/service";
import { getDashboardSummary } from "@/modules/ops/service";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  applied: "Applied",
  awaiting_review: "Awaiting review",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  docs_pending: "Docs pending",
  docs_completed: "Docs completed",
  invoice_open: "Invoice open",
  invoice_paid: "Invoice paid",
  ready_for_travel: "Ready for travel",
  blocked: "Blocked",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; forbidden?: string }>;
}) {
  await requireStaffPageSession("viewer", "/dashboard");
  const { query, forbidden } = await searchParams;
  const [summary, rows] = await Promise.all([
    getDashboardSummary(),
    listEnrollments({ query }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Operational view across applications, confirmations, packets, billing, reminders, and readiness.
          </p>
        </div>
        <Link href="/ops">
          <Button variant="secondary">Ops queue</Button>
        </Link>
      </div>
      {forbidden === "1" ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Your account does not have access to the page you tried to open.
          </p>
        </Card>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Object.entries(summary.counts).map(([key, value]) => (
          <Card key={key}>
            <div className="space-y-1">
              <div className="text-sm text-slate-500">{labels[key] ?? key}</div>
              <div className="text-3xl font-semibold text-slate-950">{Number(value ?? 0)}</div>
            </div>
          </Card>
        ))}
      </section>
      <Card>
        <form className="flex flex-col gap-3 md:flex-row">
          <input
            name="query"
            defaultValue={query ?? ""}
            placeholder="Search by participant, guardian, or email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <Button type="submit">Search</Button>
        </form>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Guardian</th>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Statuses</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.participant_first_name} {row.participant_last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.guardian_first_name} {row.guardian_last_name}
                    <div className="text-xs text-slate-400">{row.guardian_email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.trip_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="slate">{row.enrollment_status}</Badge>
                      <Badge tone="sky">{row.confirmation_status}</Badge>
                      <Badge tone="amber">{row.packet_status}</Badge>
                      <Badge tone="emerald">{row.billing_status}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.readiness_status === "ready" ? "emerald" : row.readiness_status === "exception" ? "rose" : "slate"}>
                      {row.readiness_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/enrollments/${row.id}`}>
                      <Button variant="ghost">Open</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
