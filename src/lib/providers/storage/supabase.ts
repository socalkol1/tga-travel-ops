import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env/server";

export function getSupabaseAdminClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage is not configured");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function uploadPrivateArtifact(input: {
  path: string;
  body: ArrayBuffer;
  contentType: string;
}) {
  const client = getSupabaseAdminClient();
  const { error } = await client.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(input.path, input.body, {
      contentType: input.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    bucket: env.SUPABASE_STORAGE_BUCKET,
    path: input.path,
  };
}
