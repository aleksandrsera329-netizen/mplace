/**
 * Stage 20 — Frontend consolidation: role → primary Next.js routes.
 * Single source of truth for post-login redirects and cabinet homes.
 */

export type AppRole =
  | "CUSTOMER"
  | "MERCHANT"
  | "ADMIN"
  | "SUPER_ADMIN"
  | string

/** Primary home after login / "account" icon */
export function homePathForRole(role?: string | null): string {
  const r = String(role || "").toUpperCase()
  if (r === "ADMIN" || r === "SUPER_ADMIN") return "/admin"
  if (r === "MERCHANT") return "/merchant/dashboard"
  if (r === "CUSTOMER") return "/buyer/dashboard"
  return "/account"
}

/** Safe internal path for ?next= (no open redirects) */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null
  const t = next.trim()
  if (!t.startsWith("/") || t.startsWith("//")) return null
  if (t.includes("://")) return null
  return t
}

/** Resolve post-login destination */
export function postLoginPath(
  role: string | null | undefined,
  next?: string | null,
): string {
  return safeNextPath(next) || homePathForRole(role)
}

/** Roles allowed on path prefixes (client-side guard helper) */
export function rolesForPath(pathname: string): string[] | null {
  if (pathname.startsWith("/admin")) return ["ADMIN", "SUPER_ADMIN"]
  if (pathname.startsWith("/merchant")) return ["MERCHANT"]
  if (pathname.startsWith("/buyer")) return ["CUSTOMER"]
  return null
}
