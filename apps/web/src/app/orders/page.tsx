"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AccountShell } from "@/components/account-shell"
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
]

export default function OrdersPage() {
  const [status, setStatus] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", status],
    queryFn: () =>
      api.orders({
        limit: "30",
        ...(status ? { status } : {}),
      }),
  })

  const items = data?.items ?? []

  return (
    <AccountShell title="Заказы">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <p className="text-muted-foreground">Загрузка заказов…</p>
      )}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : "Ошибка загрузки"}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Заказов нет.{" "}
          <Link href="/" className="text-primary underline">
            Перейти в каталог
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {items.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{o.orderNumber}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatDate(o.createdAt)} · {o.shop?.name || "Магазин"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-accent">
                  {formatMoney(o.totalCents, o.currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {statusLabel(o.status)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AccountShell>
  )
}
