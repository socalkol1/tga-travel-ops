import { NextResponse } from "next/server";

import { env } from "@/lib/env/server";
import { processDueJobs } from "@/modules/jobs/processor";
import { enqueueJob } from "@/modules/jobs/service";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${env.CRON_SHARED_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await enqueueJob({
    type: "run_reminder_sweep",
    payload: {},
    idempotencyKey: `reminder-sweep:${new Date().toISOString().slice(0, 13)}`,
  });

  const processed = await processDueJobs();

  return NextResponse.json({ processed });
}
