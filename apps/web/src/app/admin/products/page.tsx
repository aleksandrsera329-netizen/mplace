"use client"

import { useQuery } from "@tanstack/react-query"
import { Package } from "lucide-react"
import { api, type ProductRow } from "@/lib/api"
import { formatMoney, statusLabel } from "@/lib/format"

export default function AdminProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api.products({ limit: "50" }),
  })
  const products = (data?.items || []) as ProductRow[]

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Товары</h1>
      <p className="mb-8 text-muted-foreground">Каталог платформы (read-only)</p>

      {isLoading ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Товаров нет</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left">Название</th>
                <th className="px-4 py-3 text-left">Магазин</th>
                <th className="px-4 py-3 text-left">Цена</th>
                <th className="px-4 py-3 text-left">Статус</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.shop?.name || "—"}
                  </td>
                  <td className="px-4 py-3">{formatMoney(p.priceCents)}</td>
                  <td className="px-4 py-3">
                    {statusLabel(p.status || "ACTIVE")}
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
