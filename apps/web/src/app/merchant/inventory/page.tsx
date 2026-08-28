"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Warehouse, AlertTriangle } from "lucide-react"
import { api, type ProductRow } from "@/lib/api"
import { productLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function MerchantInventoryPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-products", "inventory"],
    queryFn: () => api.products({ limit: "100" }),
  })

  const products = ((data?.items || []) as ProductRow[]).filter((p) =>
    search
      ? p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      : true,
  )

  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 10)
  const outOfStock = products.filter((p) => p.stock <= 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("nav.warehouse")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("merchant.inventorySubtitle")}
        </p>
      </div>

      <div className="mb-8 grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {t("merchant.inventoryTotal")}
          </p>
          <p className="mt-1 text-2xl font-bold">{products.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {t("merchant.inventoryLow")}
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{lowStock.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {t("merchant.inventoryOut")}
          </p>
          <p className="mt-1 text-2xl font-bold text-danger">
            {outOfStock.length}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="search"
          placeholder={t("merchant.products.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <Warehouse className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t("merchant.noProducts")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.name")}
                </th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("merchant.warehouse.stock")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isLow = product.stock > 0 && product.stock < 10
                const isOut = product.stock <= 0

                return (
                  <tr
                    key={product.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3 font-medium">{productLabel(product)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.sku || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isOut
                            ? "font-medium text-danger"
                            : isLow
                              ? "font-medium text-primary"
                              : ""
                        }
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t("product.outOfStock")}
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t("product.lowStock")}
                        </span>
                      ) : (
                        <span className="text-success">{t("merchant.inventoryOk")}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
