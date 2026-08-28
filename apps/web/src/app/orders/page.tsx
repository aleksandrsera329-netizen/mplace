"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel, useLivePrices } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function OrdersPage() {
  const [status, setStatus] = useState("")
  const { t } = useI18n()
  useLivePrices()
  const FILTERS = [
    { value: "", label: t("common.all") },
    { value: "PENDING_PAYMENT", label: t("status.PENDING_PAYMENT") },
    { value: "PAID", label: t("status.PAID") },
    { value: "PROCESSING", label: t("status.PROCESSING") },
    { value: "SHIPPED", label: t("status.SHIPPED") },
    { value: "COMPLETED", label: t("status.COMPLETED") },
  ]

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
    <AccountShell title={t("orders.title")}>
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
        <p className="text-muted-foreground">{t("orders.loading")}</p>
      )}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : t("common.loadError")}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {t("orders.emptyHint")}{" "}
          <Link href="/" className="text-primary underline">
            {t("cart.goCatalog")}
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
                  {formatDate(o.createdAt)} · {o.shop?.name || t("orders.shop")}
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
