import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { AddPersonDialog, TeamTable } from "@/components/team-manager";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const people = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      designation: true,
      role: true,
      tech: true,
      active: true,
      phone: true,
      passwordHash: true,
    },
  });
  // Never send hashes to the browser; only whether one exists.
  const members = people.map(({ passwordHash, ...m }) => ({ ...m, hasPassword: !!passwordHash }));
  const active = members.filter((m) => m.active);

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Team"
        subtitle="Logins for everyone who uses Activity Reporting. Add people, reset passwords, set access."
        action={<AddPersonDialog />}
        counters={[
          { label: "Active people", value: active.length, digits: 3, tone: "white", primary: true },
          { label: "Managers", value: active.filter((m) => m.role === "MANAGER").length, digits: 2, tone: "white" },
          { label: "Tech desk", value: active.filter((m) => m.tech).length, digits: 2, tone: "white" },
          {
            label: "Can't sign in yet",
            value: active.filter((m) => !m.username || !m.hasPassword).length,
            digits: 2,
            tone: active.some((m) => !m.username || !m.hasPassword) ? "amber" : "white",
          },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Section flush title="People" description={`${members.length} ${members.length === 1 ? "account" : "accounts"}`}>
          <TeamTable members={members} meId={user.id} />
        </Section>
      </main>
    </div>
  );
}
