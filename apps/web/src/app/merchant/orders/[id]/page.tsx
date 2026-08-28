"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel, productLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function MerchantOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { t } = useI18n()

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id),
  })

  if (isLoading) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>
  }

  if (error || !order) {
    return (
      <div>
        <Link
          href="/merchant/orders"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("order.backToOrders")}
        </Link>
        <p className="text-danger">
          {error instanceof Error ? error.message : t("order.notFound")}
        </p>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/merchant/orders"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("order.backToOrders")}
      </Link>

      <h1 className="mb-2 text-3xl font-bold">
        {t("order.number", { n: order.orderNumber || id })}
      </h1>
      <p className="mb-8 text-muted-foreground">
        {formatDate(order.createdAt)} · {statusLabel(order.status)} ·{" "}
        {formatMoney(order.totalCents, order.currency)}
      </p>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">{t("rfq.items")}</h2>
        <ul className="divide-y divide-border text-sm">
          {(order.items || []).map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-2 py-3"
            >
              <span>
                {productLabel({
                  name: item.productName || item.name,
                  productName: item.productName,
                })} × {item.quantity}
              </span>
              <span className="font-medium">
                {formatMoney(
                  item.lineTotalCents ??
                    item.unitPriceCents * item.quantity,
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          {order.subtotalCents != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("checkout.subtotal")}</span>
              <span>{formatMoney(order.subtotalCents, order.currency)}</span>
            </div>
          )}
          {(order.taxCents ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("checkout.vat")}</span>
              <span>{formatMoney(order.taxCents!, order.currency)}</span>
            </div>
          )}
          {(order.shippingPriceCents ?? 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t("checkout.shipping")}
                {order.shippingMethod?.name
                  ? ` (${order.shippingMethod.name})`
                  : ""}
              </span>
              <span>
                {formatMoney(order.shippingPriceCents!, order.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>{t("checkout.total")}</span>
            <span>{formatMoney(order.totalCents, order.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
