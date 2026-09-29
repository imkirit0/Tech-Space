import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { normalizeUsername, verifyPassword } from "@/lib/password";
import { lockedFor, recordFailure, recordSuccess } from "@/lib/login-guard";

/** Surfaces as /signin?error=CredentialsSignin&code=locked */
class LockedOut extends CredentialsSignin {
  code = "locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // one working day
  pages: { signIn: "/signin" },
  // Required when deployed behind a reverse proxy (any non-Vercel host);
  // the app is only ever reached via the org's own trusted host.
  trustHost: true,
  providers: [
    Credentials({
      name: "Username and password",
      credentials: { username: {}, password: {} },
      authorize: async (c) => {
        const username = normalizeUsername(String(c?.username ?? ""));
        const password = String(c?.password ?? "");
        if (!username || !password) return null;
        if (lockedFor(username) > 0) throw new LockedOut();

        const user = await prisma.user.findUnique({
          where: { username },
          select: { id: true, name: true, passwordHash: true, active: true },
        });
        // verifyPassword runs even when there's no user, so timing doesn't reveal which usernames exist.
        const ok = await verifyPassword(password, user?.passwordHash);
        if (!user || !ok || !user.active) {
          recordFailure(username);
          return null;
        }
        recordSuccess(username);
        return { id: user.id, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      if (!token.uid) return null;
      // Re-read the account on every request so switching someone off, or
      // changing their role or ticket access, applies immediately.
      const db = await prisma.user.findUnique({
        where: { id: token.uid as string },
        select: { name: true, role: true, designation: true, tech: true, active: true, passwordHash: true },
      });
      // No password = not a real login (e.g. a session left over from the old Google/test sign-in): end it.
      if (!db || !db.active || !db.passwordHash) return null;
      token.name = db.name;
      token.role = db.role;
      token.designation = db.designation;
      token.tech = db.tech;
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.uid as string;
      (session.user as any).role = token.role;
      (session.user as any).designation = token.designation ?? null;
      (session.user as any).tech = token.tech ?? false;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
