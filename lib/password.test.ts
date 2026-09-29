import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordProblem, normalizeUsername, usernameProblem } from "./password";
import { lockedFor, recordFailure, recordSuccess } from "./login-guard";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const h = await hashPassword("correct horse");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("correct horsE", h)).toBe(false);
  });
  it("salts: same password hashes differently", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });
  it("rejects missing or malformed hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });
});

describe("password and username rules", () => {
  it("flags short and obvious passwords", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("aaaaaaaaaa")).toMatch(/easy/);
    expect(passwordProblem("Password123")).toMatch(/easy/);
    expect(passwordProblem("batch-Oct-2026")).toBeNull();
  });
  it("normalises and validates usernames", () => {
    expect(normalizeUsername("  Anita.S ")).toBe("anita.s");
    expect(usernameProblem("anita.s")).toBeNull();
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("has space")).not.toBeNull();
  });
});

describe("login guard", () => {
  it("locks a username after 5 failures and unlocks on success", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) recordFailure("u1", t);
    expect(lockedFor("u1", t)).toBe(0);
    recordFailure("u1", t);
    expect(lockedFor("u1", t)).toBeGreaterThan(0);
    expect(lockedFor("u1", t + 16 * 60_000)).toBe(0);
    recordSuccess("u1");
    expect(lockedFor("u1", t)).toBe(0);
  });
});
