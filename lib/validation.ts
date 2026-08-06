// Shared input validation (used by both the login UI and the NextAuth server).

// Native <input type="email"> accepts "a@b" (no TLD), unbounded length, and
// junk local parts like "<script>...". This is stricter:
//  - local part limited to the RFC 5322 "dot-atom" character set (no <>()" etc.)
//  - domain must be dotted with a 2+ letter TLD
//  - enforces the RFC 5321 max address length of 254 characters
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > 254) return false;
  // No leading/trailing dot or consecutive dots in the local part.
  const [local] = v.split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return EMAIL_RE.test(v);
}
