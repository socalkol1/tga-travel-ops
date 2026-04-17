import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { staffUsers } from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import { hasMinimumRole, type StaffRole } from "@/lib/auth/roles";

async function upsertStaffUser(email: string, name: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.query.staffUsers.findFirst({
    where: eq(staffUsers.email, normalizedEmail),
  });

  if (existing) {
    await db
      .update(staffUsers)
      .set({
        name,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffUsers.id, existing.id));

    return existing;
  }

  const inserted = await db
    .insert(staffUsers)
    .values({
      email: normalizedEmail,
      name,
      role: "viewer",
      lastLoginAt: new Date(),
    })
    .returning();

  return inserted[0];
}

const devCredentialsSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

const allowedEmails = env.AUTH_ALLOWED_EMAILS.split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const isAllowedStaffEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();

  if (allowedEmails.includes(normalized)) {
    return true;
  }

  if (env.AUTH_ALLOWED_DOMAIN) {
    return normalized.endsWith(`@${env.AUTH_ALLOWED_DOMAIN.toLowerCase()}`);
  }

  return true;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: env.AUTH_TRUST_HOST,
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    ...(env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_CLIENT_ID,
            clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(env.AUTH_ENABLE_DEV_CREDENTIALS
      ? [
          Credentials({
            name: "Local Staff Login",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              const parsed = devCredentialsSchema.safeParse({
                email: credentials?.email ?? env.AUTH_DEV_USER_EMAIL,
                name: credentials?.name ?? env.AUTH_DEV_USER_NAME,
              });

              if (!parsed.success || !isAllowedStaffEmail(parsed.data.email)) {
                return null;
              }

              return {
                email: parsed.data.email,
                name: parsed.data.name,
                id: parsed.data.email,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email && isAllowedStaffEmail(user.email));
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const staffUser = await upsertStaffUser(
          user.email,
          user.name ?? user.email.split("@")[0] ?? "Staff User",
        );
        token.staffRole = staffUser.role;
        token.staffUserId = staffUser.id;
        token.name = staffUser.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.staffUserId ?? "");
        session.user.role = (token.staffRole as StaffRole | undefined) ?? "viewer";
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

function getForbiddenRedirect() {
  return "/dashboard?forbidden=1";
}

export async function requireStaffPageSession(
  minimumRole: StaffRole = "viewer",
  callbackUrl = "/dashboard",
) {
  const session = await auth();

  if (!session?.user?.email || !session.user.role) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (!hasMinimumRole(session.user.role, minimumRole)) {
    redirect(getForbiddenRedirect());
  }

  return session;
}

export async function requireStaffRouteSession(minimumRole: StaffRole = "viewer") {
  const session = await auth();

  if (!session?.user?.email || !session.user.role) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!hasMinimumRole(session.user.role, minimumRole)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session,
  };
}
