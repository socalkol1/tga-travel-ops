import { describe, expect, it } from "vitest";

import { generateOpaqueToken, hashToken, tokensEqual } from "@/lib/security/tokens";

describe("token helpers", () => {
  it("generates opaque random tokens", () => {
    const token = generateOpaqueToken();
    expect(token).toHaveLength(43);
  });

  it("hashes consistently", () => {
    expect(hashToken("abc123")).toBe(hashToken("abc123"));
  });

  it("compares tokens safely", () => {
    expect(tokensEqual("same", "same")).toBe(true);
    expect(tokensEqual("same", "different")).toBe(false);
  });
});
