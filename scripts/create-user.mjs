// Create a login, or reset an existing one's password (e.g. the first manager,
// or a manager who is locked out). Everything else is done from the Team page.
//
//   node scripts/create-user.mjs --username admin --password "<choose one>" --name "Your Name" --role MANAGER [--tech] [--designation "Director"]
//
// Uses DATABASE_URL from .env.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";

process.loadEnvFile(".env");

const { values: a } = parseArgs({
  options: {
    username: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "EMPLOYEE" },
    designation: { type: "string" },
    tech: { type: "boolean", default: false },
  },
});

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const username = (a.username ?? "").trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) fail("--username: 3–32 chars of a-z 0-9 . _ -");
if (!a.password || a.password.length < 8) fail("--password: at least 8 characters");
if (!["EMPLOYEE", "MANAGER"].includes(a.role)) fail("--role: EMPLOYEE or MANAGER");

// Must match lib/password.ts exactly: scrypt N=2^15 r=8 p=1, 16-byte salt, 64-byte key.
const salt = randomBytes(16);
const key = await new Promise((res, rej) =>
  scryptCb(a.password, salt, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k)))
);
const passwordHash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;

const host = new URL(process.env.DATABASE_URL ?? "postgresql://unset").host;
console.log(`→ Database: ${host}`);
const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    await prisma.user.update({
      where: { username },
      data: { passwordHash, active: true, ...(a.role === "MANAGER" && { role: "MANAGER" }) },
    });
    console.log(`✓ Reset password for "${username}" (${existing.name}) and switched the account on.`);
  } else {
    if (!a.name) fail("--name is required for a new account");
    await prisma.user.create({
      data: {
        username,
        passwordHash,
        name: a.name,
        role: a.role,
        tech: a.tech,
        designation: a.designation ?? null,
      },
    });
    console.log(`✓ Created ${a.role === "MANAGER" ? "manager" : "staff"} account "${username}" for ${a.name}.`);
  }
} finally {
  await prisma.$disconnect();
}
