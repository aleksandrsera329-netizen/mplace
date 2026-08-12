"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Users,
  Store,
  ShoppingCart,
  Package,
  TrendingUp,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"
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
    <div className="rounded-xl border border-border bg-card p-6 transition hover:border-primary">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default function AdminDashboard() {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.adminDashboard(),
  })

  const { data: orders } = useQuery({
    queryKey: ["admin-orders", "dash"],
    queryFn: () => api.adminOrders({ limit: "5" }),
  })

  const { data: shops } = useQuery({
    queryKey: ["admin-shops", "pending"],
    queryFn: () => api.adminShops({ status: "PENDING", limit: "5" }),
  })

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{t("admin.dashboard.title")}</h1>
      <p className="mb-8 text-muted-foreground">
        {t("admin.dashboard.subtitle")}
      </p>

      {isLoading && (
        <p className="mb-4 text-muted-foreground">{t("common.loading")}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title={t("admin.stat.users")}
          value={data?.customers ?? "—"}
          icon={Users}
          href="/admin/users"
        />
        <StatCard
          title={t("admin.stat.merchants")}
          value={data?.merchants ?? "—"}
          icon={Store}
          href="/admin/merchants"
        />
        <StatCard
          title={t("admin.stat.orders")}
          value={data?.orders ?? "—"}
          icon={ShoppingCart}
          href="/admin/orders"
        />
        <StatCard
          title={t("admin.stat.products")}
          value={data?.products ?? "—"}
          icon={Package}
          href="/admin/products"
        />
        <StatCard
          title={t("admin.stat.gmv")}
          value={data ? formatMoney(data.gmvCents) : "—"}
          icon={TrendingUp}
        />
        <StatCard
          title={t("admin.stat.pending")}
          value={
            data
              ? `${data.pendingShops} shop / ${data.openDisputes} disputes`
              : "—"
          }
          icon={ShieldAlert}
          href="/admin/kyc"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">{t("admin.recentOrders")}</h2>
          {(orders?.items || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.noOrders")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(orders?.items || []).map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {o.orderNumber}
                  </Link>
                  <span className="text-muted-foreground">
                    {formatMoney(o.totalCents)} · {statusLabel(o.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">Новые / pending магазины</h2>
          {(shops?.items || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет pending</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(shops?.items || []).map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {formatDate(s.createdAt)} · {statusLabel(s.status)}
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
