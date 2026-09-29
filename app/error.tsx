"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const signedOut = error.message === "UNAUTHORIZED";
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <span className="font-led text-6xl leading-none font-black text-red-600" aria-hidden>
        !
      </span>
      <h1 className="text-xl font-semibold tracking-tight">
        {signedOut ? "Your session has ended" : "Something went wrong"}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {signedOut
          ? "Sign in again to carry on. Anything you saved is safe."
          : "Try again. If it keeps happening, tell the admin what you were doing when it broke."}
      </p>
      <div className="flex gap-2">
        {signedOut ? (
          <Link href="/signin" className={buttonVariants({ size: "lg" })}>
            Sign in
          </Link>
        ) : (
          <>
            <Button size="lg" onClick={reset}>
              Try again
            </Button>
            <Link href="/" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Go home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
