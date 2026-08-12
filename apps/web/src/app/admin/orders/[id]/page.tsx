"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

export default function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id),
  })

  if (isLoading) return <div className="text-muted-foreground">Загрузка…</div>

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к заказам
      </Link>
      {error || !order ? (
        <p className="text-danger">
          {error instanceof Error ? error.message : "Заказ не найден"}
        </p>
      ) : (
        <>
          <h1 className="mb-2 text-3xl font-bold">
            Заказ {order.orderNumber || id}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {formatDate(order.createdAt)} · {statusLabel(order.status)} ·{" "}
            {formatMoney(order.totalCents, order.currency)}
          </p>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Позиции</h2>
            <ul className="divide-y divide-border text-sm">
              {(order.items || []).map((item) => (
                <li key={item.id} className="flex justify-between py-2">
                  <span>
                    {item.productName || item.name} × {item.quantity}
                  </span>
                  <span>
                    {formatMoney(
                      item.lineTotalCents ??
                        item.unitPriceCents * item.quantity,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
