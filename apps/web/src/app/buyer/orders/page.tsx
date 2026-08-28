"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/store"
import { useMoney } from "@/lib/money"

export default function BuyerOrdersPage() {
  const search = useSearchParams()
  const status = search.get("status") || "all"
  const { t } = useI18n()
  const { format } = useMoney()
  const filters = [
    { key: "all", label: t("common.all") },
    { key: "active", label: t("status.PROCESSING") },
    { key: "completed", label: t("status.COMPLETED") },
    { key: "cancelled", label: t("status.CANCELLED") },
  ]

  const { data, isLoading, error } = useQuery({
    queryKey: ["buyer", "orders", status],
    queryFn: () =>
      api.buyerOrders(status === "all" ? undefined : status),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("buyer.ordersTitle")}</h1>
        <p className="text-muted-foreground">{t("buyer.ordersSubtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={
              f.key === "all"
                ? "/buyer/orders"
                : `/buyer/orders?status=${f.key}`
            }
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              status === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {isLoading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("buyer.number")}</th>
              <th className="px-4 py-3 font-medium">{t("buyer.shop")}</th>
              <th className="px-4 py-3 font-medium">{t("common.status")}</th>
              <th className="px-4 py-3 font-medium">{t("common.date")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("cart.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.items ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/orders/${o.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {o.orderNumber || o.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {o.shop?.name || "—"}
                </td>
                <td className="px-4 py-3">{statusLabel(o.status)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(o.createdAt)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {format(o.totalCents, o.currency || "RUB")}
                </td>
              </tr>
            ))}
            {!isLoading && (data?.items?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {t("orders.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
