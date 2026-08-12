import { escapeHtml, sanitizeHtml } from "./sanitize"

describe("sanitize (Stage 21 XSS)", () => {
  it("escapeHtml encodes angle brackets and quotes", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    )
  })

  it("sanitizeHtml strips script tags", () => {
    const dirty = `<p>ok</p><script>alert(1)</script>`
    const clean = sanitizeHtml(dirty)
    expect(clean).toContain("ok")
    expect(clean.toLowerCase()).not.toContain("<script")
  })

  it("sanitizeHtml removes onerror handlers", () => {
    const dirty = `<img src=x onerror="alert(1)">`
    const clean = sanitizeHtml(dirty)
    expect(clean.toLowerCase()).not.toContain("onerror")
  })

  it("handles null", () => {
    expect(escapeHtml(null)).toBe("")
    expect(sanitizeHtml(undefined)).toBe("")
  })
})
