import Image from "next/image";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LedClock } from "@/components/led-clock";

export const metadata = { title: "Sign in" };

const tempLoginEnabled =
  process.env.ALLOW_TEMP_LOGIN === "true" && process.env.NODE_ENV !== "production";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signInWithTempCredentials(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // Auth.js throws a NEXT_REDIRECT "error" on success — it must propagate.
    // Only AuthError (bad credentials) is ours to handle.
    if (error instanceof AuthError) {
      redirect("/signin?error=1");
    }
    throw error;
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  const domain = process.env.ALLOWED_DOMAIN || "gteceducation.com";

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
          <p className="mt-1 text-sm text-muted-foreground">Use your {domain} Google account.</p>

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
              {error === "AccessDenied"
                ? `Only ${domain} Google accounts can sign in. Switch accounts and try again.`
                : error === "1"
                  ? "That username and password didn't match. Try again."
                  : "Sign-in didn't complete. Please try again."}
            </p>
          )}

          <form action={signInWithGoogle} className="mt-6">
            <Button type="submit" size="lg" className="h-11 w-full text-[0.95rem]">
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.9.55 3.95 1.55l2.2-2.2A9 9 0 1 0 12 21c5.2 0 8.85-3.65 8.85-8.8 0-.4-.05-.75-.1-1.1Z"
                />
              </svg>
              Continue with Google
            </Button>
          </form>

          {tempLoginEnabled && (
            <details className="group mt-6 border-t pt-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none hover:text-foreground">
                Test login (development only)
              </summary>
              <form action={signInWithTempCredentials} className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" autoComplete="username" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" variant="outline" className="w-full">
                  Sign in with test account
                </Button>
              </form>
            </details>
          )}
        </div>
      </div>
      <p className="px-5 pb-6 text-center text-xs text-board-muted">G-TEC Education · internal use only</p>
    </div>
  );
}
