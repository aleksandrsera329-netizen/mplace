"use client"

import { useEffect, useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { Header } from "@/components/header"
import { CatalogSidebar } from "@/components/catalog-sidebar"
import { ProductCard } from "@/components/product-card"
import { useTranslations } from "@/i18n/store"
import type { CatalogListItem, CatalogProduct } from "@/lib/server-catalog"

export function HomeHero() {
  const { t } = useTranslations()
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/img/photos/hero-rig.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
      <div className="relative mx-auto flex min-h-[280px] max-w-7xl flex-col justify-end gap-4 px-4 py-12 sm:min-h-[340px] sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {t("hero.kicker")}
        </p>
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-white sm:text-5xl">
          {t("hero.title")}
        </h1>
        <p className="max-w-xl text-sm text-white/80 sm:text-base">
          {t("hero.subtitle")}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#catalog"
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("hero.cta")}
          </a>
          <a
            href="/rfq/new"
            className="inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            {t("hero.rfq")}
          </a>
        </div>
      </div>
    </section>
  )
}

export function HomeCatalog({
  initialProducts,
  initialCategories,
  initialShops,
}: {
  initialProducts: CatalogProduct[]
  initialCategories: CatalogListItem[]
  initialShops: CatalogListItem[]
}) {
  const { t, locale } = useTranslations()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [queryFromUrl, setQueryFromUrl] = useState("")
  const [filters, setFilters] = useState({
    search: "",
    categoryId: "",
    shopId: "",
    inStockOnly: false,
    sort: "default",
  })
  const [productsRaw, setProductsRaw] =
    useState<CatalogProduct[]>(initialProducts)
  const [categories, setCategories] = useState(initialCategories)
  const [shops, setShops] = useState(initialShops)

  useEffect(() => {
    setQueryFromUrl(new URLSearchParams(window.location.search).get("q") || "")
  }, [])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: queryFromUrl }))
  }, [queryFromUrl])

  useEffect(() => {
    if (initialProducts.length > 0) return
    const host = window.location.hostname
    const base =
      host !== "localhost" && host !== "127.0.0.1"
        ? "/api"
        : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api"
    let cancelled = false
    const load = async () => {
      try {
        const [pRes, cRes, sRes] = await Promise.all([
          fetch(`${base}/products?limit=100`),
          fetch(`${base}/categories`),
          fetch(`${base}/shops`),
        ])
        const pJson = await pRes.json()
        const cJson = await cRes.json()
        const sJson = await sRes.json()
        if (cancelled) return
        const items = Array.isArray(pJson)
          ? pJson
          : Array.isArray(pJson?.items)
            ? pJson.items
            : []
        setProductsRaw(items as CatalogProduct[])
        const asList = (data: unknown) => {
          if (Array.isArray(data)) return data as CatalogListItem[]
          if (data && typeof data === "object" && "items" in data) {
            const it = (data as { items: unknown }).items
            if (Array.isArray(it)) return it as CatalogListItem[]
          }
          return []
        }
        setCategories(asList(cJson))
        setShops(asList(sJson))
      } catch {
        /* keep initial empty */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [initialProducts.length])

  let products = productsRaw
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
  if (filters.inStockOnly) products = products.filter((p) => p.stock > 0)
  if (filters.sort === "price-asc")
    products = [...products].sort((a, b) => a.priceCents - b.priceCents)
  else if (filters.sort === "price-desc")
    products = [...products].sort((a, b) => b.priceCents - a.priceCents)
  else if (filters.sort === "name")
    products = [...products].sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    )
  else if (filters.sort === "stock")
    products = [...products].sort((a, b) => b.stock - a.stock)

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
        </div>

        {products.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            {t("catalog.empty")}
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

export function HomeShell({
  products,
  categories,
  shops,
}: {
  products: CatalogProduct[]
  categories: CatalogListItem[]
  shops: CatalogListItem[]
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <HomeHero />
      <div id="catalog">
        <HomeCatalog
          initialProducts={products}
          initialCategories={categories}
          initialShops={shops}
        />
      </div>
    </div>
  )
}
