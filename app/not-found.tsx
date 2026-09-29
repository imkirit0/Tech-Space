import Link from "next/link";
import { Led } from "@/components/led";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-board p-6 text-center text-board-foreground">
      <div className="rounded-lg bg-board-well px-5 py-4 ring-1 ring-board-line ring-inset">
        <Led value="404" digits={3} tone="red" className="text-7xl" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-board-muted">The link may be old or mistyped. Head back to your dashboard.</p>
      <Link href="/" className={buttonVariants({ variant: "board", size: "lg" })}>
        Go to dashboard
      </Link>
    </div>
  );
}
