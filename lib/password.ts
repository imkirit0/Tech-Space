import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  );

// OWASP-recommended scrypt cost for interactive logins.
const OPTS: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export { MIN_PASSWORD_LENGTH, passwordProblem, normalizeUsername, usernameProblem } from "./password-rules";

/** "scrypt$<salt hex>$<key hex>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, OPTS);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [algo, saltHex, keyHex] = (stored ?? "").split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) {
    // Still do the work so a missing account takes as long as a wrong password.
    await scrypt(password, Buffer.alloc(16), KEYLEN, OPTS);
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, OPTS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
