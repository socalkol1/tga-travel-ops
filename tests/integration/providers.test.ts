import { describe, expect, it } from "vitest";

import { FakeQuickBooksProvider } from "@/lib/providers/quickbooks/fake";
import { FakeSigningProvider } from "@/lib/providers/signing/fake";

describe("fake providers", () => {
  it("creates deterministic fake signing documents", async () => {
    const provider = new FakeSigningProvider();
    const result = await provider.createDocumentFromTemplate({
      enrollmentId: "enr_1",
      templateId: "tpl_1",
      participantName: "Jamie Wrestler",
      guardianName: "Chris Guardian",
      guardianEmail: "guardian@example.org",
    });

    expect(result.documentId).toContain("fake-signing-");
    expect(result.status).toBe("sent");
  });

  it("creates deterministic fake QuickBooks invoices", async () => {
    const provider = new FakeQuickBooksProvider();
    const customer = await provider.findOrCreateCustomer({
      enrollmentId: "enr_1",
      guardianName: "Chris Guardian",
      guardianEmail: "guardian@example.org",
    });
    const invoice = await provider.createInvoice({
      customerId: customer.customerId,
      enrollmentId: "enr_1",
      amountCents: 125000,
      description: "Summer tour",
    });

    expect(invoice.status).toBe("open");
    expect(invoice.amountCents).toBe(125000);
  });
});
