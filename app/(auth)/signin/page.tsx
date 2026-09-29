import Image from "next/image";
import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LedClock } from "@/components/led-clock";

export const metadata = { title: "Sign in" };

async function signInWithPassword(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // Auth.js throws a NEXT_REDIRECT "error" on success — it must propagate.
    // Only AuthError (bad credentials / locked) is ours to handle.
    if (error instanceof CredentialsSignin && error.code === "locked") redirect("/signin?error=locked");
    if (error instanceof AuthError) redirect("/signin?error=invalid");
    throw error;
  }
}

const MESSAGES: Record<string, string> = {
  invalid: "That username and password don't match, or the account is switched off.",
  locked: "Too many wrong attempts. Wait 15 minutes, or ask a manager to reset your password.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex min-h-svh flex-col bg-board text-board-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="flex flex-col gap-8 lg:max-w-md">
          <Image src="/brand/gtec-logo.webp" alt="G-TEC Education" width={150} height={91} priority className="h-16 w-auto self-start" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Activity Reporting</h1>
            <p className="mt-3 max-w-sm text-base text-board-muted">
              Log your day, review the team&apos;s work, and keep the tech desk&apos;s complaint queue moving.
            </p>
          </div>
          <div className="flex items-center gap-4 self-start rounded-lg bg-board-well px-4 py-3 ring-1 ring-board-line ring-inset">
            <LedClock className="text-5xl" />
            <p className="text-xs leading-snug text-board-muted">
              India
              <br />
              Standard Time
            </p>
          </div>
        </div>

        <div className="w-full rounded-xl bg-card p-6 text-card-foreground shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)] sm:p-8 lg:max-w-sm">
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use the username and password your manager gave you.</p>

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
              {MESSAGES[error] ?? "Sign-in didn't complete. Please try again."}
            </p>
          )}

          <form action={signInWithPassword} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" />
            </div>
            <Button type="submit" size="lg" className="mt-1 h-11 w-full text-[0.95rem]">
              <LogIn />
              Sign in
            </Button>
          </form>
          <p className="mt-5 text-xs text-muted-foreground">Forgot your password? Ask a manager to reset it from the Team page.</p>
        </div>
      </div>
      <p className="px-5 pb-6 text-center text-xs text-board-muted">G-TEC Education · internal use only</p>
    </div>
  );
}
