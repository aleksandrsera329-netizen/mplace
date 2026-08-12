"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
  MessageSquare,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/store"

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  href,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  href?: string
}) {
  const body = (
    <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default function MerchantDashboard() {
  const user = useAuthStore((s) => s.user)
  const { t } = useI18n()

  const { data, isLoading, error } = useQuery({
    queryKey: ["merchant", "dashboard"],
    queryFn: () => api.merchantDashboard(),
    enabled: user?.role === "MERCHANT",
    retry: false,
  })

  const stats = data?.stats
  const recentOrders = data?.recentOrders ?? []
  const recentOffers = data?.recentOffers ?? []

  if (isLoading) {
    return (
      <div className="text-muted-foreground">Загрузка кабинета продавца…</div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message || "Не удалось загрузить dashboard"}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("merchant.dashboard")}</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.shop?.name
              ? `${data.shop.name}${data.shop.verified ? " · verified" : ""}`
              : "Обзор вашего магазина"}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/merchant/kyc">KYC</Link>
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="GMV"
          value={formatMoney(stats?.gmvCents ?? 0)}
          icon={TrendingUp}
          description="PAID → COMPLETED"
          href="/merchant/orders?status=paid"
        />
        <StatCard
          title="Выручка (после комиссии)"
          value={formatMoney(stats?.revenueCents ?? 0)}
          icon={Wallet}
          description={`Комиссия: ${formatMoney(stats?.commissionCents ?? 0)}`}
        />
        <StatCard
          title="Доступный баланс"
          value={formatMoney(stats?.availableBalanceCents ?? 0)}
          icon={Wallet}
          href="/merchant/payouts"
          description={`В резерве выплат: ${formatMoney(stats?.pendingPayoutsCents ?? 0)}`}
        />
        <StatCard
          title="Заказы / pending"
          value={`${stats?.ordersCount ?? 0} / ${stats?.pendingOrders ?? 0}`}
          icon={ShoppingCart}
          href="/merchant/orders"
        />
        <StatCard
          title="Товары (active)"
          value={`${stats?.activeProducts ?? 0} / ${stats?.productsCount ?? 0}`}
          icon={Package}
          href="/merchant/products"
        />
        <StatCard
          title="Открытые offers"
          value={stats?.openOffers ?? 0}
          icon={MessageSquare}
          href="/merchant/rfq"
          description={`Accepted: ${stats?.awardedOffers ?? 0}`}
        />
        <StatCard
          title="KYC"
          value={
            data?.shop?.verified
              ? "OK"
              : `${stats?.kycPending ?? 0} pending`
          }
          icon={ShieldCheck}
          href="/merchant/kyc"
          description={`Approved docs: ${stats?.kycApproved ?? 0}`}
        />
        <StatCard
          title="Conversion"
          value={`${stats?.conversionRate ?? 0}%`}
          icon={TrendingUp}
          description="COMPLETED / all orders"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Последние заказы</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/merchant/orders">Все</Link>
            </Button>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Заказов пока нет</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex justify-between gap-2 border-b border-border py-2 last:border-0"
                >
                  <Link
                    href={`/merchant/orders/${o.id}`}
                    className="text-primary hover:underline"
                  >
                    {o.orderNumber}
                    <span className="ml-2 text-muted-foreground">
                      {formatDate(o.createdAt)}
                    </span>
                  </Link>
                  <span>
                    {formatMoney(o.totalCents, o.currency)} ·{" "}
                    {statusLabel(o.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Мои offers / RFQ</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/merchant/rfq">Все</Link>
            </Button>
          </div>
          {recentOffers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Offers пока нет</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentOffers.map((o) => (
                <li
                  key={o.id}
                  className="flex justify-between gap-2 border-b border-border py-2 last:border-0"
                >
                  <Link
                    href={`/merchant/rfq/${o.rfq.id}`}
                    className="truncate pr-2 text-primary hover:underline"
                  >
                    {o.rfq.title}
                    <span className="ml-2 text-muted-foreground">
                      {o.rfq.number}
                    </span>
                  </Link>
                  <span className="shrink-0">
                    {formatMoney(o.totalCents, o.currency)} ·{" "}
                    {statusLabel(o.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
