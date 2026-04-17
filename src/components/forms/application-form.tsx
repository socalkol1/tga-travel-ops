"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ApplicationForm({ tripSlug }: { tripSlug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/public/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to submit application");
      return;
    }

    router.push(`/?submitted=${tripSlug}`);
    router.refresh();
  }

  return (
    <Card>
      <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="tripSlug" value={tripSlug} />
        <Field label="Participant first name">
          <Input name="participantFirstName" required />
        </Field>
        <Field label="Participant last name">
          <Input name="participantLastName" required />
        </Field>
        <Field label="Birth date">
          <Input name="participantBirthDate" type="date" />
        </Field>
        <Field label="Participant email">
          <Input name="participantEmail" type="email" />
        </Field>
        <Field label="Participant phone">
          <Input name="participantPhone" />
        </Field>
        <Field label="Grade level">
          <Input name="participantGradeLevel" />
        </Field>
        <Field label="Club name">
          <Input name="participantClubName" />
        </Field>
        <div />
        <Field label="Guardian first name">
          <Input name="guardianFirstName" required />
        </Field>
        <Field label="Guardian last name">
          <Input name="guardianLastName" required />
        </Field>
        <Field label="Guardian email">
          <Input name="guardianEmail" type="email" required />
        </Field>
        <Field label="Guardian phone">
          <Input name="guardianPhone" required />
        </Field>
        <Field label="Relationship">
          <Input name="guardianRelationship" required />
        </Field>
        <Field
          label="Alternate confirmer email"
          description="Optional separate recipient for the confirmation request."
        >
          <Input name="alternateConfirmerEmail" type="email" />
        </Field>
        <Field label="Address line 1">
          <Input name="addressLine1" required />
        </Field>
        <Field label="Address line 2">
          <Input name="addressLine2" />
        </Field>
        <Field label="City">
          <Input name="city" required />
        </Field>
        <Field label="State">
          <Input name="state" required />
        </Field>
        <Field label="Postal code">
          <Input name="postalCode" required />
        </Field>
        <div className="flex items-center justify-between gap-4 md:col-span-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : <span />}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit application"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
