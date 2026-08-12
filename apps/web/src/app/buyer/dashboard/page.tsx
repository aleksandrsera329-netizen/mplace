"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ShoppingCart,
  MessageSquare,
  Heart,
  ArrowRight,
} from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"

export default function BuyerDashboardPage() {
  const { user } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ["buyer", "dashboard"],
    queryFn: () => api.buyerDashboard(),
  })

  if (isLoading) {
    return (
      <div className="text-muted-foreground">Загрузка кабинета…</div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message || "Не удалось загрузить dashboard"}
      </div>
    )
  }

  const stats = data?.stats
  const recentOrders = data?.recentOrders ?? []
  const recentRfqs = data?.recentRfqs ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Здравствуйте{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Обзор заказов, RFQ и избранного
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Активные заказы"
          value={stats?.activeOrders ?? 0}
          href="/buyer/orders?status=active"
          icon={ShoppingCart}
        />
        <StatCard
          title="Открытые RFQ"
          value={stats?.pendingRfqs ?? 0}
          href="/buyer/rfqs?status=open"
          icon={MessageSquare}
        />
        <StatCard
          title="С предложениями"
          value={stats?.rfqsWithOffers ?? 0}
          href="/buyer/rfqs?status=offers"
          icon={MessageSquare}
        />
        <StatCard
          title="Избранное"
          value={stats?.wishlistCount ?? 0}
          href="/wishlist"
          icon={Heart}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold">Последние заказы</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/buyer/orders">
                Все <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Заказов пока нет.{" "}
                <Link href="/" className="text-primary underline">
                  В каталог
                </Link>
              </p>
            )}
            {recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {o.orderNumber || o.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(o.createdAt)} · {statusLabel(o.status)}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold">
                  {formatMoney(o.totalCents, o.currency || "RUB")}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold">Последние RFQ</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/buyer/rfqs">
                Все <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentRfqs.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                RFQ нет.{" "}
                <Link href="/rfq/new" className="text-primary underline">
                  Создать запрос
                </Link>
              </p>
            )}
            {recentRfqs.map((r) => (
              <Link
                key={r.id}
                href={`/rfq/${r.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.number} · {statusLabel(r.status)}
                    {r._count?.offers != null
                      ? ` · офферов: ${r._count.offers}`
                      : ""}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(r.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  href,
  icon: Icon,
}: {
  title: string
  value: number
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
    </Link>
  )
}
