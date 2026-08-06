"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart"

interface Product {
  id: string
  name: string
  priceCents: number
  stock: number
  imageUrl?: string | null
  category?: { name: string }
  shop?: { name: string }
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)
  const stockClass = product.stock > 10 ? "text-success" : "text-danger"
  const stockText =
    product.stock > 0 ? `В наличии: ${product.stock}` : "Нет в наличии"

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg">
      <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-secondary to-background">
        <Link
          href={`/product/${product.id}`}
          className="flex h-full w-full items-center justify-center"
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-28 max-w-full object-contain"
            />
          ) : (
            <span className="text-5xl opacity-40" aria-hidden>
              ⚙️
            </span>
          )}
        </Link>
        {product.stock > 0 && product.stock < 8 && (
          <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            Мало
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">
          {product.category?.name || "—"}
        </div>
        <Link href={`/product/${product.id}`}>
          <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug hover:text-primary">
            {product.name}
          </h3>
        </Link>
        <div className="mb-4 text-sm text-muted-foreground">
          {product.shop?.name || "—"} ·{" "}
          <span className={stockClass}>{stockText}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="text-lg font-bold text-accent">
            {formatMoney(product.priceCents)}
          </div>
          <Button
            size="sm"
            disabled={product.stock <= 0}
            onClick={() => void addItem(product.id)}
          >
            В корзину
          </Button>
        </div>
      </div>
    </article>
  )
}
