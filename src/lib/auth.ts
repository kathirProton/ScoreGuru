import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual, createHash } from "crypto";

const COOKIE_NAME = "sg_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET env var is missing or too short.");
  }
  return new TextEncoder().encode(secret);
}

/** Constant-time compare of submitted password against the env password. */
export function verifyPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD env var is not set.");
  // Hash both to fixed length so timingSafeEqual won't throw on length mismatch.
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Issue a signed, httpOnly session cookie. */
export async function createSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function destroySession() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** Returns true if a valid admin session cookie is present. */
export async function isAdmin(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Throw if not authenticated — call at the top of every write action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("UNAUTHORIZED");
  }
}

/** Redirect to login if not authenticated — call at the top of admin pages. */
export async function ensureAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}
