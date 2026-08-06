"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useCartStore } from "@/store/cart"

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const addItem = useCartStore((s) => s.addItem)

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.product(id),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">
          Загрузка…
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">Товар не найден</p>
          <Button asChild className="mt-6">
            <Link href="/">Вернуться в каталог</Link>
          </Button>
        </div>
      </div>
    )
  }

  const stockClass = product.stock > 10 ? "text-success" : "text-danger"
  const stockText =
    product.stock > 0 ? `В наличии: ${product.stock}` : "Нет в наличии"

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в каталог
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-secondary to-background">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="max-h-[80%] max-w-[80%] object-contain"
              />
            ) : (
              <span className="text-8xl opacity-30" aria-hidden>
                ⚙️
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <div className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">
              {product.category?.name || "—"}
            </div>

            <h1 className="mb-4 text-3xl font-bold leading-tight">
              {product.name}
            </h1>

            <div className="mb-6 text-sm text-muted-foreground">
              Поставщик:{" "}
              <span className="font-medium text-foreground">
                {product.shop?.name || "—"}
              </span>
              {" · "}
              <span className={stockClass}>{stockText}</span>
            </div>

            {product.description && (
              <p className="mb-8 leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}

            <div className="mt-auto space-y-6">
              <div className="text-3xl font-bold text-accent">
                {formatMoney(product.priceCents)}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  disabled={product.stock <= 0}
                  onClick={() => void addItem(product.id)}
                  className="min-w-[180px]"
                >
                  В корзину
                </Button>

                <Button size="lg" variant="outline" asChild>
                  <Link href="/">Продолжить покупки</Link>
                </Button>
              </div>

              {product.sku && (
                <div className="text-xs text-muted-foreground">
                  SKU: {product.sku}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
