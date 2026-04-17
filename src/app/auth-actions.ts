"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/lib/auth/auth";
import { resolveAuthRedirectTo } from "@/lib/auth/redirects";

function getRedirectTo(formData: FormData) {
  return resolveAuthRedirectTo(formData.get("redirectTo")?.toString());
}

export async function signInWithGoogle(formData: FormData) {
  const redirectTo = getRedirectTo(formData);
  await signIn("google", { redirectTo });
}

export async function signInWithDevCredentials(formData: FormData) {
  const redirectTo = getRedirectTo(formData);
  const payload = new FormData();

  payload.set("email", String(formData.get("email") ?? ""));
  payload.set("name", String(formData.get("name") ?? ""));
  payload.set("redirectTo", redirectTo);

  try {
    await signIn("credentials", payload);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/?error=${encodeURIComponent(error.type)}&callbackUrl=${encodeURIComponent(redirectTo)}`);
    }

    throw error;
  }
}

export async function signOutStaff() {
  await signOut({ redirectTo: "/" });
}
