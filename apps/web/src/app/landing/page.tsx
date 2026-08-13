import Link from "next/link"

const features = [
  ["RFQ → Offer → Award", "Полный B2B procurement workflow от запроса до заказа."],
  ["Multi-vendor", "Изоляция tenant, merchant cabinets и shop-level operations."],
  ["Stripe & Ledger", "PaymentIntent, webhooks, refunds, payouts и double-entry ledger."],
  ["Security", "JWT rotation, MFA, ACL, rate limiting и cross-tenant enforcement."],
  ["Search & Inventory", "Meilisearch, stock reservations, очереди и фоновые jobs."],
  ["Production stack", "PostgreSQL, Redis, BullMQ, Docker, Kubernetes и observability."],
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-20 lg:px-8">
        <div className="max-w-4xl">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
            Mplace Energy · B2B Marketplace Platform
          </span>
          <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-7xl">
            B2B marketplace infrastructure, готовая для пилота.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Multi-vendor procurement platform для industrial, oil & gas и
            equipment marketplaces: RFQ, merchants, checkout, Stripe,
            inventory, payouts и tenant isolation в одной архитектуре.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/" className="rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-950">
              Открыть marketplace
            </Link>
            <Link href="/landing#architecture" className="rounded-xl border border-white/15 px-6 py-3 font-semibold">
              Посмотреть возможности
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="architecture" className="border-y border-white/10 bg-slate-900/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-3 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Built for B2B</p>
            <h2 className="mt-3 text-3xl font-semibold">Не просто storefront.</h2>
          </div>
          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            {[
              ["Backend", "NestJS 11 · Prisma · PostgreSQL · Redis · BullMQ"],
              ["Frontend", "Next.js 16 · React 19 · responsive buyer/merchant/admin UX"],
              ["Payments", "Stripe test/live provider abstraction · Connect · webhook idempotency"],
              ["Operations", "Docker · Kubernetes/Helm · health checks · metrics · backups"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/10 p-5">
                <div className="text-sm font-medium text-amber-200">{k}</div>
                <div className="mt-2 text-sm text-slate-300">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
