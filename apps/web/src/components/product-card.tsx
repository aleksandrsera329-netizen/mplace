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
import { useTranslations } from "@/i18n/store"
import { useMoney } from "@/lib/money"
import { categoryLabel, productLabel } from "@/lib/format"

interface Product {
  id: string
  name: string
  slug?: string | null
  sku?: string | null
  priceCents: number
  currency?: string | null
  stock: number
  imageUrl?: string | null
  category?: { name: string; slug?: string } | null
  shop?: { name: string } | null
}

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const { isAuthenticated, accessToken } = useAuthStore()
  const { t } = useTranslations()
  const { format } = useMoney()
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
      <div className="relative h-48 overflow-hidden bg-secondary">
        <Link
          href={`/product/${product.id}`}
          className="block h-full w-full"
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={productLabel(product, t)}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-40">
              ⚙️
            </div>
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
          {categoryLabel(product.category || {}, t)}
        </div>
        <Link href={`/product/${product.id}`}>
          <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug hover:text-primary">
            {productLabel(product, t)}
          </h3>
        </Link>
        <div className="mb-4 text-sm text-muted-foreground">
          {product.shop?.name || "—"} ·{" "}
          <span className={stockClass}>{stockText}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="text-lg font-bold text-accent">
            {format(product.priceCents, product.currency)}
          </div>
          <Button
            size="sm"
            disabled={product.stock <= 0}
            onClick={() => void addItem(product.id, 1, product.stock)}
          >
            {t("product.addToCart")}
          </Button>
        </div>
      </div>
    </article>
  )
}
