import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { submitInsuranceUpload } from "@/app/insurance-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getInsuranceUploadTokenRecord } from "@/modules/insurance/service";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_file: "Upload a PDF, JPG, PNG, or WEBP insurance card under 10 MB.",
  upload_failed: "We could not save the insurance card. Try again.",
};

export default async function InsuranceUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const record = await getInsuranceUploadTokenRecord(token);
  const submitAction = submitInsuranceUpload.bind(null, token);

  if (!record) {
    notFound();
  }

  return (
    <AppShell
      title="Upload insurance card"
      description="Use this secure link to upload the insurance card required for travel readiness."
    >
      <Card className="max-w-xl space-y-4">
        <p className="text-sm leading-7 text-slate-600">
          This link is addressed to <strong>{record.recipientEmail}</strong> and expires on{" "}
          {record.expiresAt.toLocaleString()}.
        </p>
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessages[error] ?? "Unable to upload insurance card."}
          </div>
        ) : null}
        <form action={submitAction} className="space-y-4">
          <input
            type="file"
            name="insuranceFile"
            accept=".pdf,image/jpeg,image/png,image/webp"
            required
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <Button type="submit">Upload insurance card</Button>
        </form>
      </Card>
    </AppShell>
  );
}
