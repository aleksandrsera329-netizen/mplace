"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface CatalogSidebarProps {
  categories: { id: string; name: string }[]
  shops: { id: string; name: string }[]
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
  onFilterChange,
}: CatalogSidebarProps) {
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [shopId, setShopId] = useState("")
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState("default")

  const apply = () => {
    onFilterChange({ search, categoryId, shopId, inStockOnly, sort })
  }

  return (
    <aside className="w-full shrink-0 space-y-6 rounded-xl border border-border bg-card p-5 lg:w-72">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Поиск
        </h3>
        <input
          type="search"
          placeholder="Название, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Категории
        </h3>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary">
            <input
              type="radio"
              name="category"
              checked={categoryId === ""}
              onChange={() => setCategoryId("")}
            />
            Все категории
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
              {c.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Поставщики
        </h3>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary">
            <input
              type="radio"
              name="shop"
              checked={shopId === ""}
              onChange={() => setShopId("")}
            />
            Все поставщики
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
          Только в наличии
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Сортировка
        </h3>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          <option value="default">По умолчанию</option>
          <option value="price-asc">Цена ↑</option>
          <option value="price-desc">Цена ↓</option>
          <option value="name">Название</option>
          <option value="stock">Остаток</option>
        </select>
      </div>

      <Button className="w-full" onClick={apply}>
        Применить
      </Button>
    </aside>
  )
}
