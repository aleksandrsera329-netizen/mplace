"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Trash2, Minus, Plus } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart"
import type { CartItem } from "@/lib/api"
import { useI18n } from "@/i18n/store"
import { useMoney } from "@/lib/money"
import { productLabel } from "@/lib/format"

export default function CartPage() {
  const {
    items,
    itemCount,
    subtotalCents,
    isLoading,
    refresh,
    updateQty,
    removeItem,
  } = useCartStore()
  const { t } = useI18n()
  const { format: formatMoney } = useMoney()

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("cart.continue")}
        </Link>

        <h1 className="mb-8 text-3xl font-bold">
          {t("cart.title")}
          {itemCount > 0 && (
            <span className="ml-2 text-lg font-normal text-muted-foreground">
              ({itemCount})
            </span>
          )}
        </h1>

        {isLoading && items.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-20 text-center">
            <p className="text-lg text-muted-foreground">{t("cart.emptyHint")}</p>
            <Button asChild className="mt-6">
              <Link href="/">{t("cart.goCatalog")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {items.map((item: CartItem) => {
                const product = item.product
                const price = item.priceCents || product?.priceCents || 0
                const qty = item.quantity || 1
                const lineTotal = price * qty
                const productId = product?.id || item.productId
                const productName = product
                  ? productLabel(product, t)
                  : t("common.name")
                const lineCurrency = product?.currency
                const imageUrl = product?.imageUrl

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-secondary text-3xl">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt=""
                          className="max-h-16 max-w-16 object-contain"
                        />
                      ) : (
                        <span aria-hidden>⚙️</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {productId ? (
                        <Link
                          href={`/product/${productId}`}
                          className="font-medium hover:text-primary"
                        >
                          {productName}
                        </Link>
                      ) : (
                        <span className="font-medium">{productName}</span>
                      )}
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatMoney(price, lineCurrency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void updateQty(item.id, qty - 1)}
                        aria-label={t("cart.decrease")}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center font-medium">{qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={
                          typeof product?.stock === "number" &&
                          qty >= product.stock
                        }
                        onClick={() => void updateQty(item.id, qty + 1)}
                        aria-label={t("cart.increase")}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="min-w-[5rem] text-right font-semibold">
                      {formatMoney(lineTotal, lineCurrency)}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-danger"
                      onClick={() => void removeItem(item.id)}
                      title={t("cart.remove")}
                      aria-label={t("cart.remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="h-fit rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("cart.total")}</h2>

              <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                <span>{t("cart.lines")}</span>
                <span>{itemCount}</span>
              </div>
              <div className="mb-6 flex justify-between text-xl font-bold">
                <span>{t("cart.amount")}</span>
                <span className="text-accent">
                  {formatMoney(subtotalCents)}
                </span>
              </div>

              <Button className="w-full" size="lg" asChild>
                <Link href="/checkout">{t("cart.checkoutBtn")}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
