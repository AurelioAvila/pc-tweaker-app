import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { getPool, isConfigured } from "./db";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "30d";

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** `tokenVersion` must match the user's current `token_version` in the
 * database — bumping that column (on password reset or "log out everywhere")
 * invalidates every token issued before the bump, even though JWTs are
 * otherwise stateless and can't normally be revoked before they expire. */
function signToken(userId: number, tokenVersion: number): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }
  return jwt.sign({ sub: userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Express middleware: requires a valid, non-revoked `Authorization: Bearer <token>` header. */
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  if (!JWT_SECRET) {
    res.status(500).json({ error: "server auth is not configured (JWT_SECRET missing)" });
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    // Algorithm pinned explicitly: with a symmetric secret only HMAC is
    // valid anyway, but stating it removes any future algorithm-confusion
    // surface if the secret is ever swapped for a key object.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded === "string") throw new Error("unexpected string payload");
    payload = decoded;
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }

  if (!isConfigured) {
    // Can't check for revocation without a database — fail closed rather
    // than trusting a token we're unable to verify hasn't been revoked.
    res.status(503).json({ error: "database not configured (DATABASE_URL missing)" });
    return;
  }

  try {
    const result = await getPool().query("SELECT token_version FROM users WHERE id = $1", [payload.sub]);
    if (result.rowCount === 0 || result.rows[0].token_version !== payload.tv) {
      res.status(401).json({ error: "invalid or expired token" });
      return;
    }
  } catch (err) {
    console.error("token revocation check failed:", err);
    res.status(500).json({ error: "auth check failed" });
    return;
  }

  // The JWT type declares `sub` as a string (per the JWT spec convention),
  // but `signToken` below puts the numeric user id there directly — it is
  // never stringified, so this reflects what is actually on the wire, not a
  // real type mismatch.
  req.userId = payload.sub as unknown as number;
  next();
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8;
}

export { hashPassword, verifyPassword, signToken, requireAuth, isValidEmail, isValidPassword };
