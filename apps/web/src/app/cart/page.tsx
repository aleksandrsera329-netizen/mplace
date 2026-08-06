"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Trash2, Minus, Plus } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart"
import { api } from "@/lib/api"
import type { CartItem } from "@/lib/api"

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function CartPage() {
  const { items, itemCount, subtotalCents, isLoading, refresh } = useCartStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      // Backend: PATCH quantity 0 removes the line
      await api.updateCartItem(itemId, quantity <= 0 ? 0 : quantity)
      await refresh()
    } catch (e) {
      console.error(e)
      const msg =
        e instanceof Error ? e.message : "Не удалось изменить количество"
      alert(msg)
    }
  }

  const removeItem = async (itemId: string) => {
    try {
      await api.updateCartItem(itemId, 0)
      await refresh()
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : "Не удалось удалить позицию"
      alert(msg)
    }
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Продолжить покупки
        </Link>

        <h1 className="mb-8 text-3xl font-bold">
          Корзина
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
            <p className="text-lg text-muted-foreground">Корзина пуста</p>
            <Button asChild className="mt-6">
              <Link href="/">Перейти в каталог</Link>
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
                const productName = product?.name || "Товар"
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
                        {formatMoney(price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void updateQuantity(item.id, qty - 1)}
                        aria-label="Уменьшить"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center font-medium">{qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void updateQuantity(item.id, qty + 1)}
                        aria-label="Увеличить"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="min-w-[5rem] text-right font-semibold">
                      {formatMoney(lineTotal)}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-danger"
                      onClick={() => void removeItem(item.id)}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="h-fit rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Итого</h2>

              <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                <span>Позиций</span>
                <span>{itemCount}</span>
              </div>
              <div className="mb-6 flex justify-between text-xl font-bold">
                <span>Сумма</span>
                <span className="text-accent">
                  {formatMoney(subtotalCents)}
                </span>
              </div>

              <Button className="w-full" size="lg" asChild>
                <Link href="/checkout">Оформить заказ</Link>
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                После оформления поставщик получит вашу заявку
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
