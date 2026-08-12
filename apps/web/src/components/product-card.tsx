"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/store"

interface Product {
  id: string
  name: string
  priceCents: number
  stock: number
  imageUrl?: string | null
  category?: { name: string } | null
  shop?: { name: string } | null
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const { isAuthenticated, accessToken } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()
  const loggedIn = isAuthenticated() || !!accessToken

  const { data: wishlist } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.wishlist(),
    enabled: loggedIn,
    staleTime: 30_000,
  })

  const inWishlist = Boolean(
    wishlist?.some(
      (w) => w.productId === product.id || w.product?.id === product.id,
    ),
  )

  const toggleWish = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated() && !accessToken) {
        router.push("/login")
        return
      }
      if (inWishlist) {
        await api.removeFromWishlist(product.id)
      } else {
        await api.addToWishlist(product.id)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wishlist"] })
    },
  })

  const stockClass = product.stock > 10 ? "text-success" : "text-danger"
  const stockText =
    product.stock > 0
      ? `${t("product.inStock")}: ${product.stock}`
      : t("product.outOfStock")

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
            {t("product.lowStock")}
          </span>
        )}
        <button
          type="button"
          title={
            inWishlist ? t("product.inWishlist") : t("product.wishlist")
          }
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2 hover:bg-background"
          disabled={toggleWish.isPending}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleWish.mutate()
          }}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              inWishlist
                ? "fill-primary text-primary"
                : "text-muted-foreground",
            )}
          />
        </button>
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
            {t("product.addToCart")}
          </Button>
        </div>
      </div>
    </article>
  )
}
