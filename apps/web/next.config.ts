import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16: allow opening via 127.0.0.1 while dev host is localhost
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.191"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
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
      {
        source: "/merchant/index.html",
        destination: "/merchant",
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Local API is on :3001 (http) — must be allowed for browser fetch
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "img-src 'self' data: https: http: blob:",
              "font-src 'self' data: https:",
              "connect-src 'self' http://127.0.0.1:* http://localhost:* https: wss: ws:",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
