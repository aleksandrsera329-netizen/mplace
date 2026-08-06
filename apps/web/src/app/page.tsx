"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Header } from "@/components/header"
import { CatalogSidebar } from "@/components/catalog-sidebar"
import { ProductCard } from "@/components/product-card"
import { api } from "@/lib/api"

type ProductRow = {
  id: string
  name: string
  sku?: string | null
  priceCents: number
  stock: number
  imageUrl?: string | null
  categoryId?: string | null
  shopId?: string
  category?: { id?: string; name: string }
  shop?: { id?: string; name: string }
}

function asList(data: unknown): { id: string; name: string }[] {
  if (Array.isArray(data)) return data as { id: string; name: string }[]
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items
    if (Array.isArray(items)) return items as { id: string; name: string }[]
  }
  return []
}

export default function HomePage() {
  const [filters, setFilters] = useState({
    search: "",
    categoryId: "",
    shopId: "",
    inStockOnly: false,
    sort: "default",
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products(),
  })

  const { data: categoriesRaw } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories(),
  })

  const { data: shopsRaw } = useQuery({
    queryKey: ["shops"],
    queryFn: () => api.shops(),
  })

  const categories = asList(categoriesRaw)
  const shops = asList(shopsRaw)

  let products: ProductRow[] = (productsData?.items || []) as ProductRow[]

  // Client-side filters (until API accepts all query params)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    products = products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    )
  }
  if (filters.categoryId) {
    products = products.filter(
      (p) =>
        p.categoryId === filters.categoryId ||
        p.category?.id === filters.categoryId,
    )
  }
  if (filters.shopId) {
    products = products.filter(
      (p) => p.shopId === filters.shopId || p.shop?.id === filters.shopId,
    )
  }
  if (filters.inStockOnly) {
    products = products.filter((p) => p.stock > 0)
  }

  if (filters.sort === "price-asc") {
    products = [...products].sort((a, b) => a.priceCents - b.priceCents)
  } else if (filters.sort === "price-desc") {
    products = [...products].sort((a, b) => b.priceCents - a.priceCents)
  } else if (filters.sort === "name") {
    products = [...products].sort((a, b) => a.name.localeCompare(b.name, "ru"))
  } else if (filters.sort === "stock") {
    products = [...products].sort((a, b) => b.stock - a.stock)
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <CatalogSidebar
          categories={categories}
          shops={shops}
          onFilterChange={setFilters}
        />

        <main className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Оборудование и материалы
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({products.length})
              </span>
            </h2>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-xl border border-border bg-card"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              Ничего не найдено
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
