"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Heart, Trash2 } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/product-card"
import { useAuthStore } from "@/store/auth"
import { api, type WishlistItem } from "@/lib/api"

export default function WishlistPage() {
  const router = useRouter()
  const { isAuthenticated, hydrated, refresh, accessToken } = useAuthStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (hydrated && !isAuthenticated()) {
      router.push("/login")
    }
  }, [hydrated, isAuthenticated, router])

  const enabled = hydrated && (isAuthenticated() || !!accessToken)

  const { data, isLoading, error } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.wishlist(),
    enabled,
  })

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.removeFromWishlist(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
  })

  // backend: array of { productId, product } or { items: [] }
  const raw = data as WishlistItem[] | { items?: WishlistItem[] } | undefined
  const items = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : []
  const products = items
    .map((i) => i.product || (i as unknown as { id: string }))
    .filter((p): p is NonNullable<WishlistItem["product"]> => Boolean(p?.id))

  if (!hydrated || !enabled) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Загрузка…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <Heart className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Избранное</h1>
          <span className="text-muted-foreground">({products.length})</span>
        </div>

        {error && (
          <p className="mb-4 text-sm text-danger">
            {error instanceof Error ? error.message : "Ошибка загрузки"}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-20 text-center">
            <p className="mb-6 text-lg text-muted-foreground">
              В избранном пока пусто
            </p>
            <Button asChild>
              <Link href="/">Перейти в каталог</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <ProductCard product={product} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 z-10 bg-background/80 hover:bg-background"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(product.id)}
                  title="Убрать из избранного"
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
