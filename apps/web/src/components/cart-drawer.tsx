"use client"

import { useEffect } from "react"
import { Minus, Plus, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useCartStore } from "@/store/cart"
import { Button } from "@/components/ui/button"
import type { CartItem } from "@/lib/api"
import { useI18n } from "@/i18n/store"
import { useMoney } from "@/lib/money"
import { productLabel } from "@/lib/format"

export function CartDrawer() {
  const {
    isOpen,
    close,
    items,
    subtotalCents,
    itemCount,
    refresh,
    updateQty,
    removeItem,
  } = useCartStore()
  const { t } = useI18n()
  const { format: formatMoney } = useMoney()

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={close}
        aria-hidden
      />

      <aside className="cart-drawer fixed end-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-s border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">
            {t("cart.title")}{" "}
            <span className="text-muted-foreground">({itemCount})</span>
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <p className="mt-16 text-center text-muted-foreground">
              {t("cart.empty")}
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item: CartItem) => {
                const unit = item.product?.priceCents ?? item.priceCents ?? 0
                const stock = item.product?.stock
                const atMax =
                  typeof stock === "number" && item.quantity >= stock
                return (
                  <div
                    key={item.id}
                    className="flex gap-3 border-b border-border pb-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.product ? productLabel(item.product, t) : "—"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatMoney(unit)}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("cart.decrease")}
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            void updateQty(item.id, item.quantity - 1)
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-6 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("cart.increase")}
                          disabled={atMax}
                          onClick={() =>
                            void updateQty(item.id, item.quantity + 1)
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          aria-label={t("cart.remove")}
                          onClick={() => void removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatMoney(unit * item.quantity)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="relative z-10 border-t border-border bg-card p-5">
          <div className="mb-4 flex justify-between text-lg font-bold">
            <span>{t("cart.total")}</span>
            <span>{formatMoney(subtotalCents)}</span>
          </div>
          {items.length === 0 ? (
            <Button className="w-full" disabled>
              {t("cart.checkout")}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button className="w-full" asChild>
                <Link href="/checkout" onClick={close}>
                  {t("cart.checkout")}
                </Link>
              </Button>
              <Button variant="outline" className="w-full bg-card" asChild>
                <Link href="/cart" onClick={close}>
                  {t("cart.openCart")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
