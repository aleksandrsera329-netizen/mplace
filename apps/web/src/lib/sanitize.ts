/**
 * Stage 21 — XSS: only use when you must render HTML strings.
 * Prefer React children ({value}) which escape automatically.
 *
 * Usage:
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(untrusted) }} />
 */
import DOMPurify from "isomorphic-dompurify"

type SanitizeConfig = {
  USE_PROFILES?: { html?: boolean }
  FORBID_TAGS?: string[]
  FORBID_ATTR?: string[]
}

const DEFAULT_CONFIG: SanitizeConfig = {
  USE_PROFILES: { html: true },
  // Disallow scripts / handlers even if someone relaxes the call site
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
}

/**
 * Sanitize untrusted HTML for safe use with dangerouslySetInnerHTML.
 * Returns empty string for null/undefined.
 */
export function sanitizeHtml(
  dirty: string | null | undefined,
  config: SanitizeConfig = DEFAULT_CONFIG,
): string {
  if (dirty == null || dirty === "") return ""
  // isomorphic-dompurify may return TrustedHTML in DOM lib typings
  return String(DOMPurify.sanitize(String(dirty), config as never))
}

/**
 * Plain-text escape when building HTML outside React (rare).
 * Prefer React text nodes.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
