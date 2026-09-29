// Pure rules shared by server and browser (no crypto here).
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(password) || /^(?:12345678|password|qwerty)/i.test(password))
    return "That password is too easy to guess.";
  return null;
}

/** Login IDs are case-insensitive: stored and compared lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameProblem(username: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(username))
    return "Usernames are 3–32 characters: letters, numbers, dots, dashes or underscores.";
  return null;
}
