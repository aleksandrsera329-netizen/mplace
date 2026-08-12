"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-orders", statusFilter],
    queryFn: () =>
      api.adminOrders({
        limit: "50",
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  })

  const orders = data?.items || []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Заказы</h1>
        <p className="mt-1 text-muted-foreground">Все заказы платформы</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          "",
          "PENDING_PAYMENT",
          "PAID",
          "PROCESSING",
          "SHIPPED",
          "DELIVERED",
          "CANCELLED",
        ].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s ? statusLabel(s) : "Все"}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 text-sm text-danger">
          {error instanceof Error ? error.message : "Ошибка"}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">Заказов нет</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Номер</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-left font-medium">Магазин</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                <th className="px-4 py-3 text-left font-medium">Сумма</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-medium">
                    {order.orderNumber || order.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.shop?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(order.totalCents || 0, order.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/orders/${order.id}`}>Открыть</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
