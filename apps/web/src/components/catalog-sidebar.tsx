"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/store"

import { categoryLabel } from "@/lib/format"

interface CatalogSidebarProps {
  categories: { id: string; name: string; slug?: string }[]
  shops: { id: string; name: string }[]
  /** Sync search from Header ?q= */
  searchValue?: string
  onFilterChange: (filters: {
    search: string
    categoryId: string
    shopId: string
    inStockOnly: boolean
    sort: string
  }) => void
}

export function CatalogSidebar({
  categories,
  shops,
  searchValue = "",
  onFilterChange,
}: CatalogSidebarProps) {
  const [search, setSearch] = useState(searchValue)
  const [categoryId, setCategoryId] = useState("")
  const [shopId, setShopId] = useState("")
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState("default")
  const { t } = useI18n()

  useEffect(() => {
    setSearch(searchValue)
  }, [searchValue])

  const apply = () => {
    onFilterChange({ search, categoryId, shopId, inStockOnly, sort })
  }

  return (
    <aside className="w-full shrink-0 space-y-6 rounded-xl border border-border bg-card p-5 lg:w-72">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("catalog.search")}
        </h3>
        <input
          type="search"
          placeholder={t("catalog.search.placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("catalog.categories")}
        </h3>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary">
            <input
              type="radio"
              name="category"
              checked={categoryId === ""}
              onChange={() => setCategoryId("")}
            />
            {t("catalog.allCategories")}
          </label>
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <input
                type="radio"
                name="category"
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
              />
              {categoryLabel(c, t)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("catalog.shops")}
        </h3>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary">
            <input
              type="radio"
              name="shop"
              checked={shopId === ""}
              onChange={() => setShopId("")}
            />
            {t("catalog.allShops")}
          </label>
          {shops.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <input
                type="radio"
                name="shop"
                checked={shopId === s.id}
                onChange={() => setShopId(s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
          />
          {t("catalog.inStockOnly")}
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("catalog.sort")}
        </h3>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          <option value="default">{t("catalog.sort.default")}</option>
          <option value="price-asc">{t("catalog.sort.priceAsc")}</option>
          <option value="price-desc">{t("catalog.sort.priceDesc")}</option>
          <option value="name">{t("catalog.sort.name")}</option>
          <option value="stock">{t("catalog.sort.stock")}</option>
        </select>
      </div>

      <Button className="w-full" onClick={apply}>
        {t("catalog.apply")}
      </Button>
    </aside>
  )
}
