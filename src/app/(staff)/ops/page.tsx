import { requireStaffPageSession } from "@/lib/auth/auth";
import { Card } from "@/components/ui/card";
import { getDashboardSummary } from "@/modules/ops/service";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  await requireStaffPageSession("manager", "/ops");
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ops queue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Failed jobs and failed webhook events that need staff review or manual retry.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Failed jobs</h2>
          <div className="space-y-3 text-sm">
            {summary.failedJobs.length > 0 ? summary.failedJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-slate-200 p-3">
                <div className="font-medium text-slate-900">{job.type}</div>
                <div className="text-slate-500">{job.lastError ?? "Unknown error"}</div>
              </div>
            )) : <p className="text-slate-500">No failed jobs.</p>}
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Failed webhooks</h2>
          <div className="space-y-3 text-sm">
            {summary.failedWebhooks.length > 0 ? summary.failedWebhooks.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                <div className="font-medium text-slate-900">{event.provider}</div>
                <div className="text-slate-500">{event.lastError ?? "Unknown error"}</div>
              </div>
            )) : <p className="text-slate-500">No failed webhook events.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
