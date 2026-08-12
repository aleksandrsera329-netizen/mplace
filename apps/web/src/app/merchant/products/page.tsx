"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Plus, Pencil, Trash2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api, type ProductRow } from "@/lib/api"
import { formatMoney, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function MerchantProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const { t } = useI18n()

  const { data, isLoading, error } = useQuery({
    queryKey: ["merchant-products"],
    queryFn: () => api.products({ limit: "100" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["merchant-products"] })
      void queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })

  const raw = (data?.items || data || []) as ProductRow[]
  const products = raw.filter((p) =>
    search
      ? p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      : true,
  )

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("merchant.products.title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("merchant.products.subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href="/merchant/products/new">
            <Plus className="me-2 h-4 w-4" />
            {t("merchant.products.add")}
          </Link>
        </Button>
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

      {error && (
        <p className="mb-4 text-sm text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-6 text-lg text-muted-foreground">
            {search ? "Ничего не найдено" : "Товаров пока нет"}
          </p>
          {!search && (
            <Button asChild>
              <Link href="/merchant/products/new">Добавить первый товар</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Товар</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Цена</th>
                <th className="px-4 py-3 text-left font-medium">Остаток</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.category?.name || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.sku || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(product.priceCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        product.stock > 10
                          ? "text-success"
                          : product.stock > 0
                            ? "text-primary"
                            : "text-danger"
                      }
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {statusLabel(product.status || "ACTIVE")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/merchant/products/${product.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger hover:text-danger"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm("Удалить товар?")) {
                            deleteMutation.mutate(product.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
