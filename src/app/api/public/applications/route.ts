import { NextResponse } from "next/server";

import { env } from "@/lib/env/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { applicationSchema } from "@/modules/enrollments/schemas";
import { DuplicateApplicationError, submitApplication } from "@/modules/enrollments/service";
import { TripNotAcceptingApplicationsError } from "@/modules/trips/service";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const rate = consumeRateLimit(
    `application:${ip}`,
    env.RATE_LIMIT_PUBLIC_REQUESTS_PER_MINUTE,
    60_000,
  );

  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const payload = applicationSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const enrollment = await submitApplication(payload.data);
    return NextResponse.json({ enrollmentId: enrollment.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TripNotAcceptingApplicationsError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: 409 },
      );
    }

    if (error instanceof DuplicateApplicationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit application" },
      { status: 400 },
    );
  }
}
