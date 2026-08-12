"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

const filters = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "completed", label: "Завершённые" },
  { key: "cancelled", label: "Отменённые" },
]

export default function BuyerOrdersPage() {
  const search = useSearchParams()
  const status = search.get("status") || "all"

  const { data, isLoading, error } = useQuery({
    queryKey: ["buyer", "orders", status],
    queryFn: () =>
      api.buyerOrders(status === "all" ? undefined : status),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мои заказы</h1>
        <p className="text-muted-foreground">Только ваши заказы как покупателя</p>
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
        <p className="text-muted-foreground">Загрузка…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Номер</th>
              <th className="px-4 py-3 font-medium">Магазин</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 text-right font-medium">Сумма</th>
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
                  {formatMoney(o.totalCents, o.currency || "RUB")}
                </td>
              </tr>
            ))}
            {!isLoading && (data?.items?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Заказов нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
