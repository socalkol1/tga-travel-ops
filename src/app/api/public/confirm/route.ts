import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { consumeConfirmationToken } from "@/modules/confirmations/service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");

  try {
    await consumeConfirmationToken({
      rawToken: token,
      ipAddress: (await headers()).get("x-forwarded-for"),
      actorDisplay: "Guardian confirmation link",
    });

    return NextResponse.redirect(new URL("/?confirmed=1", request.url));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm enrollment" },
      { status: 400 },
    );
  }
}
