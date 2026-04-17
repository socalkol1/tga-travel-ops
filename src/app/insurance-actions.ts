"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { uploadInsuranceArtifact } from "@/modules/insurance/service";

export async function submitInsuranceUpload(token: string, formData: FormData) {
  const insuranceFile = formData.get("insuranceFile");

  if (!(insuranceFile instanceof File)) {
    redirect(`/insurance/${token}?error=invalid_file`);
  }

  try {
    await uploadInsuranceArtifact({
      rawToken: token,
      file: insuranceFile,
      ipAddress: (await headers()).get("x-forwarded-for"),
    });
  } catch (error) {
    const isFileError =
      error instanceof Error &&
      (error.message.includes("PDF or image") || error.message.includes("10 MB"));

    redirect(`/insurance/${token}?error=${isFileError ? "invalid_file" : "upload_failed"}`);
  }

  redirect("/?insurance=1");
}
