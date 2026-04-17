import { describe, expect, it, vi } from "vitest";

import { setupModuleContext } from "../helpers/module-context";

describe("staff action route auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    const context = await setupModuleContext();

    try {
      vi.doMock("@/lib/auth/auth", () => ({
        requireStaffRouteSession: vi.fn(async () => ({
          ok: false as const,
          response: Response.json({ error: "Unauthorized" }, { status: 401 }),
        })),
      }));

      const { POST } = await import("@/app/api/staff/enrollments/[id]/actions/route");
      const response = await POST(
        new Request("http://localhost/api/staff/enrollments/enr_1/actions", {
          method: "POST",
          body: new URLSearchParams([["action", "approve-review"]]),
        }),
        { params: Promise.resolve({ id: "enr_1" }) },
      );

      expect(response.status).toBe(401);
    } finally {
      await context.client.close();
    }
  });

  it("returns 403 when the user lacks the required role", async () => {
    const context = await setupModuleContext();

    try {
      vi.doMock("@/lib/auth/auth", () => ({
        requireStaffRouteSession: vi.fn(async () => ({
          ok: false as const,
          response: Response.json({ error: "Forbidden" }, { status: 403 }),
        })),
      }));

      const { POST } = await import("@/app/api/staff/enrollments/[id]/actions/route");
      const response = await POST(
        new Request("http://localhost/api/staff/enrollments/enr_1/actions", {
          method: "POST",
          body: new URLSearchParams([["action", "approve-review"]]),
        }),
        { params: Promise.resolve({ id: "enr_1" }) },
      );

      expect(response.status).toBe(403);
    } finally {
      await context.client.close();
    }
  });
});
