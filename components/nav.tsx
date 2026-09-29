import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { unreadTaskCount } from "@/lib/task-queries";
import { prisma } from "@/lib/db";
import { PhoneDialog } from "@/components/phone-dialog";
import { NavLinks } from "@/components/nav-links";
import { Led, type LedTone } from "@/components/led";
import { cn } from "@/lib/utils";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/signin" });
}

export type Counter = {
  label: string;
  value: string | number;
  tone?: LedTone;
  digits?: number;
  hint?: string;
  /** The one number that matters most on this page: wider cell, bigger readout. */
  primary?: boolean;
};

/**
 * The token board: brand bar, page title, primary action and live LED
 * counters on navy. Every signed-in page opens with it.
 */
export async function Board({
  title,
  subtitle,
  action,
  counters = [],
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  counters?: Counter[];
}) {
  const u = await getCurrentUser();
  if (!u) return null;

  const links: { href: string; label: string; badge?: number }[] =
    u.role === "MANAGER"
      ? [
          { href: "/manager", label: "Manager" },
          { href: "/manager/team", label: "Team" },
        ]
      : [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/activities", label: "My Activities" },
        ];
  const [unreadTasks, me] = await Promise.all([
    unreadTaskCount(u),
    prisma.user.findUnique({ where: { id: u.id }, select: { phone: true, username: true } }),
  ]);
  const phone = me?.phone ?? null;
  links.push({ href: "/tasks", label: "Tasks", badge: unreadTasks });
  if (u.tech) links.push({ href: "/tickets", label: "Tickets" });

  const initials = u.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="bg-board text-board-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4 border-b border-board-line">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="flex shrink-0 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none">
              <Image src="/brand/gtec-logo.webp" alt="G-TEC" width={66} height={40} priority className="h-10 w-auto" />
            </Link>
            <NavLinks links={links} className="hidden sm:flex" />
          </div>
          <div className="flex items-center gap-1">
            <PhoneDialog
              userId={u.id}
              username={me?.username ?? null}
              phone={phone}
              trigger={
                <button
                  type="button"
                  title={phone ? "Your account" : "Your account: add your WhatsApp number"}
                  className="flex items-center gap-2.5 rounded-md py-1 pr-2 pl-1 text-left transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
                >
                  <span className="relative flex size-8 items-center justify-center rounded-full bg-board-well text-xs font-semibold ring-1 ring-board-line">
                    {initials || "?"}
                    {!phone && (
                      <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-led-amber ring-2 ring-board" aria-hidden />
                    )}
                  </span>
                  <span className="hidden leading-tight sm:block">
                    <span className="block text-sm font-medium">{u.name}</span>
                    <span className="block text-xs text-board-muted">
                      {phone ? (
                        <>
                          {u.role === "MANAGER" ? "Manager" : (u.designation ?? "Staff")}
                          {u.tech ? " · Tech desk" : ""}
                        </>
                      ) : (
                        "Add WhatsApp number"
                      )}
                    </span>
                  </span>
                  <span className="sr-only sm:hidden">Your account</span>
                </button>
              }
            />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-board-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </form>
          </div>
        </div>

        <NavLinks links={links} className="-mx-1 flex border-b border-board-line sm:hidden" />

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-5 pb-4 sm:pt-7 sm:pb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-board-muted">{subtitle}</div>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
        </div>

        {counters.length > 0 && (
          <div className="pb-5 sm:pb-6">
            <dl className="flex snap-x divide-x divide-board-line overflow-x-auto rounded-lg bg-board-well ring-1 ring-board-line ring-inset [scrollbar-width:none]">
              {counters.map((c) => (
                <div
                  key={c.label}
                  className={cn(
                    "flex shrink-0 snap-start flex-col gap-1.5 px-4 pt-3 pb-3.5 sm:min-w-0 sm:shrink sm:px-5",
                    c.primary ? "w-44 sm:w-auto sm:flex-[1.6]" : "w-36 sm:w-auto sm:flex-1"
                  )}
                >
                  <dt className="truncate text-xs font-medium text-board-muted">{c.label}</dt>
                  <dd className="flex items-baseline gap-2">
                    <Led
                      value={c.value}
                      digits={c.digits ?? 3}
                      tone={c.tone}
                      className={c.primary ? "text-[2.4rem] sm:text-[3.5rem]" : "text-[1.9rem] sm:text-[2.5rem]"}
                    />
                    {c.hint && <span className="text-xs text-board-muted">{c.hint}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </header>
  );
}
