"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowLeft, Heart } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/store"
import { useMoney } from "@/lib/money"
import { categoryLabel, productLabel, productDescription } from "@/lib/format"

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const { isAuthenticated, accessToken } = useAuthStore()
  const { t } = useI18n()
  const { format } = useMoney()
  const qc = useQueryClient()
  const loggedIn = isAuthenticated() || !!accessToken

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.product(id),
  })

  const { data: wishlist } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.wishlist(),
    enabled: loggedIn,
    staleTime: 30_000,
  })

  const inWishlist = Boolean(
    wishlist?.some((w) => w.productId === id || w.product?.id === id),
  )

  const toggleWish = useMutation({
    mutationFn: async () => {
      if (!loggedIn) {
        router.push("/login")
        return
      }
      if (inWishlist) {
        await api.removeFromWishlist(id)
      } else {
        await api.addToWishlist(id)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wishlist"] })
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">{t("product.notFound")}</p>
          <Button asChild className="mt-6">
            <Link href="/">{t("product.backToCatalog")}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const available =
    product.availableStock ??
    product.stocks?.reduce(
      (sum, s) => sum + Math.max(0, (s.quantity || 0) - (s.reserved || 0)),
      0,
    ) ??
    product.stock
  const stockClass = available > 10 ? "text-success" : "text-danger"
  const stockText =
    available > 0
      ? t("catalog.inStockCount", { count: available })
      : t("product.outOfStock")

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("product.back")}
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
            {product.imageUrl ? (
              // eslint-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={productLabel(product, t)}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-8xl opacity-30">
                ⚙️
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">
              {categoryLabel(product.category || {}, t)}
            </div>

            <h1 className="mb-4 text-3xl font-bold leading-tight">
              {productLabel(product, t)}
            </h1>

            <div className="mb-6 text-sm text-muted-foreground">
              {t("product.supplier")}:{" "}
              <span className="font-medium text-foreground">
                {product.shop?.name || "—"}
              </span>
              {" · "}
              <span className={stockClass}>{stockText}</span>
            </div>

            {productDescription(product, t) && (
              <p className="mb-8 leading-relaxed text-muted-foreground">
                {productDescription(product, t)}
              </p>
            )}

            <div className="mt-auto space-y-6">
              <div className="text-3xl font-bold text-accent">
                {format(product.priceCents, product.currency)}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  disabled={available <= 0}
                  onClick={() => void addItem(product.id, 1, available)}
                  className="min-w-[180px]"
                >
                  {t("product.addToBasket")}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  disabled={toggleWish.isPending}
                  onClick={() => toggleWish.mutate()}
                >
                  <Heart
                    className={cn(
                      "h-4 w-4",
                      inWishlist && "fill-primary text-primary",
                    )}
                  />
                  {inWishlist ? t("product.inWishlist") : t("product.wishlist")}
                </Button>

                <Button size="lg" variant="outline" asChild>
                  <Link href="/">{t("product.continue")}</Link>
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
