"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { SlidersHorizontal, X } from "lucide-react"
import { Header } from "@/components/header"
import { CatalogSidebar } from "@/components/catalog-sidebar"
import { ProductCard } from "@/components/product-card"
import { api } from "@/lib/api"
import { useI18n } from "@/i18n/store"

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

function HomeCatalog() {
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get("q") || ""
  const { t } = useI18n()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({
    search: queryFromUrl,
    categoryId: "",
    shopId: "",
    inStockOnly: false,
    sort: "default",
  })

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: queryFromUrl }))
  }, [queryFromUrl])

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", queryFromUrl],
    queryFn: () =>
      queryFromUrl
        ? api.products({ search: queryFromUrl, limit: "100" }).catch(() =>
            api.products({ limit: "100" }),
          )
        : api.products({ limit: "100" }),
  })

  // Prefer Meilisearch endpoint when user typed a query
  const { data: searchData } = useQuery({
    queryKey: ["products-search", queryFromUrl],
    queryFn: async () => {
      try {
        return await api.products({ q: queryFromUrl, limit: "50" })
      } catch {
        return null
      }
    },
    enabled: queryFromUrl.length >= 2,
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

  // If dedicated search returned hits, prefer them (when API supports q)
  if (
    queryFromUrl &&
    searchData &&
    Array.isArray(searchData.items) &&
    searchData.items.length > 0
  ) {
    products = searchData.items as ProductRow[]
  }

  const activeSearch = filters.search || queryFromUrl

  if (activeSearch) {
    const q = activeSearch.toLowerCase()
    products = products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q) ||
        p.shop?.name?.toLowerCase().includes(q),
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
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      <button
        type="button"
        className="mb-0 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {t("catalog.filters")}
      </button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 transform overflow-y-auto border-r border-border bg-card p-5 transition-transform lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span className="font-semibold">{t("catalog.filters")}</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <CatalogSidebar
          categories={categories}
          shops={shops}
          searchValue={activeSearch}
          onFilterChange={(f) => {
            setFilters(f)
            setSidebarOpen(false)
          }}
        />
      </div>

      <main className="flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">
            {t("catalog.title")}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({products.length})
            </span>
          </h2>
          {activeSearch && (
            <p className="text-sm text-muted-foreground">
              {t("catalog.search")}: «{activeSearch}»
            </p>
          )}
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
            {t("catalog.empty")}
            {activeSearch ? ` «${activeSearch}»` : ""}
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
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <Suspense
        fallback={
          <div className="py-20 text-center text-muted-foreground">
            …
          </div>
        }
      >
        <HomeCatalog />
      </Suspense>
    </div>
  )
}
