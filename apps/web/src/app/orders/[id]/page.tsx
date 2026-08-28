"use client"

import { use } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel, productLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const qc = useQueryClient()
  const { t } = useI18n()

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id),
  })

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order")
      // Demo / local: create intent then confirm via dev endpoint when available
      await api.paymentIntent(order.id, order.paymentToken || undefined)
      try {
        await api.devConfirmPayment(order.id, order.paymentToken || undefined)
      } catch {
        // Stripe live mode: intent created; UI still refreshes
      }
      return api.order(id)
    },
    onSuccess: (updated) => {
      qc.setQueryData(["order", id], updated)
      void qc.invalidateQueries({ queryKey: ["orders"] })
    },
  })

  return (
    <AccountShell
      title={order ? t("order.number", { n: order.orderNumber }) : t("order.title")}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/orders">{t("orders.back")}</Link>
        </Button>
      }
    >
      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}

      {order && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">{t("common.status")}</div>
                <div className="text-xl font-semibold">
                  {statusLabel(order.status)}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {formatDate(order.createdAt)} · {order.shop?.name || "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">{t("checkout.total")}</div>
                <div className="text-2xl font-bold text-accent">
                  {formatMoney(order.totalCents, order.currency)}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-1 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm">
              {order.subtotalCents != null && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("checkout.subtotal")}</span>
                  <span>
                    {formatMoney(order.subtotalCents, order.currency)}
                  </span>
                </div>
              )}
              {(order.taxCents ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("checkout.vat")}</span>
                  <span>{formatMoney(order.taxCents!, order.currency)}</span>
                </div>
              )}
              {((order.shippingPriceCents ?? 0) > 0 ||
                order.shippingMethod) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("checkout.shipping")}
                    {order.shippingMethod?.name
                      ? ` (${order.shippingMethod.name})`
                      : ""}
                    {order.shippingDaysMin != null &&
                    order.shippingDaysMax != null
                      ? ` ${t("shipping.days", { min: order.shippingDaysMin, max: order.shippingDaysMax })}`
                      : ""}
                  </span>
                  <span>
                    {formatMoney(
                      order.shippingPriceCents || 0,
                      order.currency,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>{t("checkout.total")}</span>
                <span>
                  {formatMoney(order.totalCents, order.currency)}
                </span>
              </div>
            </div>

            {order.status === "PENDING_PAYMENT" && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {t("order.payDemoHint")}
                </p>
                <Button
                  onClick={() => payMutation.mutate()}
                  disabled={payMutation.isPending}
                >
                  {payMutation.isPending ? t("order.paying") : t("order.payDemo")}
                </Button>
                {payMutation.isError && (
                  <p className="mt-2 text-sm text-danger">
                    {payMutation.error instanceof Error
                      ? payMutation.error.message
                      : t("order.payError")}
                  </p>
                )}
                {payMutation.isSuccess && (
                  <p className="mt-2 text-sm text-success">{t("order.statusUpdated")}</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t("rfq.items")}</h2>
            <ul className="divide-y divide-border">
              {(order.items || []).map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {productLabel({
                        name: item.productName || item.name,
                        productName: item.productName,
                      })}
                    </div>
                    <div className="text-muted-foreground">
                      {item.quantity} × {formatMoney(item.unitPriceCents)}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatMoney(
                      item.lineTotalCents ??
                        item.totalCents ??
                        item.unitPriceCents * item.quantity,
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">{t("orders.history")}</h2>
              <ol className="space-y-2 text-sm">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3">
                    <span>
                      {statusLabel(h.toStatus || h.status || "—")}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(h.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </AccountShell>
  )
}
