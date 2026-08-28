"use client"

import Link from "next/link"
import { useI18n } from "@/i18n/store"

export default function LandingPage() {
  const { t } = useI18n()
  const features = [
    [t("landing.f1t"), t("landing.f1")],
    [t("landing.f2t"), t("landing.f2")],
    [t("landing.f3t"), t("landing.f3")],
    [t("landing.f4t"), t("landing.f4")],
    [t("landing.f5t"), t("landing.f5")],
    [t("landing.f6t"), t("landing.f6")],
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-20 lg:px-8">
        <div className="max-w-4xl">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
            {t("landing.kicker")}
          </span>
          <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-7xl">
            {t("landing.title")}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            {t("landing.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/" className="rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-950">
              {t("landing.open")}
            </Link>
            <Link href="/landing#architecture" className="rounded-xl border border-white/15 px-6 py-3 font-semibold">
              {t("landing.features")}
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
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">{t("landing.built")}</p>
            <h2 className="mt-3 text-3xl font-semibold">{t("landing.notStorefront")}</h2>
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
