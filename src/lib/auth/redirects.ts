export function resolveAuthRedirectTo(
  candidate: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!candidate) {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
