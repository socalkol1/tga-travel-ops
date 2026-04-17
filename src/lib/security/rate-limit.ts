const requests = new Map<string, { count: number; expiresAt: number }>();

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const record = requests.get(key);

  if (!record || record.expiresAt <= now) {
    requests.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  requests.set(key, record);

  return { allowed: true, remaining: limit - record.count };
}
