import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getConfirmationTokenRecord } from "@/modules/confirmations/service";

export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await getConfirmationTokenRecord(token);

  if (!record) {
    notFound();
  }

  return (
    <AppShell
      title="Confirm trip enrollment"
      description="This secure link confirms attendance and unlocks the document packet and invoicing workflow."
    >
      <Card className="max-w-xl">
        <form action="/api/public/confirm" method="post" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm leading-7 text-slate-600">
            This link is addressed to <strong>{record.recipientEmail}</strong> and expires on{" "}
            {record.expiresAt.toLocaleString()}.
          </p>
          <Button type="submit">Confirm enrollment</Button>
        </form>
      </Card>
    </AppShell>
  );
}
