import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "owner" | "admin" | "manager" | "finance" | "viewer";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    staffRole?: "owner" | "admin" | "manager" | "finance" | "viewer";
    staffUserId?: string;
  }
}
