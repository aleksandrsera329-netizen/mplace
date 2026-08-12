"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

const FILTERS = [
  { value: "", label: "Все" },
  { value: "PENDING_PAYMENT", label: "Оплата" },
  { value: "PAID", label: "Оплачен" },
  { value: "PROCESSING", label: "В работе" },
  { value: "SHIPPED", label: "Отправлен" },
  { value: "DELIVERED", label: "Доставлен" },
  { value: "CANCELLED", label: "Отменён" },
]

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: "bg-blue-500/15 text-blue-500",
  PAID: "bg-green-500/15 text-green-500",
  PROCESSING: "bg-yellow-500/15 text-yellow-500",
  SHIPPED: "bg-purple-500/15 text-purple-500",
  DELIVERED: "bg-success/15 text-success",
  CANCELLED: "bg-danger/15 text-danger",
}

const NEXT: Record<string, string | null> = {
  PAID: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
}

export default function MerchantOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["merchant-orders", statusFilter],
    queryFn: () =>
      api.orders({
        limit: "50",
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  })

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateOrderStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["merchant-orders"] })
    },
  })

  const orders = data?.items || []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Заказы</h1>
        <p className="mt-1 text-muted-foreground">Заказы вашего магазина</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <button
            key={s.value || "all"}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">Заказов пока нет</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Номер</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                <th className="px-4 py-3 text-left font-medium">Сумма</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const next = NEXT[order.status]
                return (
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
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          statusColors[order.status] || "bg-secondary"
                        }`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(order.totalCents || 0, order.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {next && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={advance.isPending}
                            onClick={() =>
                              advance.mutate({ id: order.id, status: next })
                            }
                          >
                            → {statusLabel(next)}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/merchant/orders/${order.id}`}>
                            Открыть
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
