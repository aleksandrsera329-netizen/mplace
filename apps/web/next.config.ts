import type { NextConfig } from "next"

/**
 * Stage 22: security headers for Next.js (React) storefront / cabinets.
 * API has its own helmet CSP; this covers the browser app.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Next.js needs 'unsafe-inline' for styles in many setups; tighten later with nonces
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      // Local product images + API hosts over http in dev
      "img-src 'self' data: https: http: blob:",
      "font-src 'self' data: https:",
      // Critical: browser → API on :3001 (not 'self')
      "connect-src 'self' http://127.0.0.1:* http://localhost:* https: wss: ws:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16: allow opening site via 127.0.0.1 while dev server is localhost
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.191"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
  /**
   * Stage 20 — map legacy-style paths to Next App Router routes.
   * (Static *.html files are not served by Next; these cover bookmarked URLs.)
   */
  async redirects() {
    return [
      { source: "/cart.html", destination: "/cart", permanent: false },
      { source: "/checkout.html", destination: "/checkout", permanent: false },
      { source: "/login.html", destination: "/login", permanent: false },
      { source: "/register.html", destination: "/register", permanent: false },
      { source: "/wishlist.html", destination: "/wishlist", permanent: false },
      { source: "/orders.html", destination: "/orders", permanent: false },
      { source: "/account.html", destination: "/account", permanent: false },
      { source: "/rfqs.html", destination: "/rfq", permanent: false },
      { source: "/rfq-create.html", destination: "/rfq/new", permanent: false },
      { source: "/product.html", destination: "/", permanent: false },
      { source: "/merchant.html", destination: "/merchant", permanent: false },
      {
        source: "/merchant-products.html",
        destination: "/merchant/products",
        permanent: false,
      },
      {
        source: "/merchant-orders.html",
        destination: "/merchant/orders",
        permanent: false,
      },
      { source: "/admin/index.html", destination: "/admin", permanent: false },
      { source: "/merchant/index.html", destination: "/merchant", permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
