"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function AdminMerchantsPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [status, setStatus] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-merchants", status],
    queryFn: () =>
      api.adminShops({
        limit: "50",
        ...(status ? { status } : {}),
      }),
  })

  const update = useMutation({
    mutationFn: ({ id, st }: { id: string; st: string }) =>
      api.adminUpdateShopStatus(id, st),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-merchants"] })
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] })
    },
  })

  const merchants = data?.items || []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("admin.merchants.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("admin.merchantsSubtitle")}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["", "PENDING", "ACTIVE", "SUSPENDED"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              status === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {s ? statusLabel(s) : t("common.all")}
          </button>
        ))}
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
      ) : merchants.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t("admin.noMerchants")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("admin.shop")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("admin.owner")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("admin.shopCount")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("admin.created")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((shop) => (
                <tr
                  key={shop.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-medium">{shop.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shop.owner?.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        shop.status === "ACTIVE"
                          ? "bg-success/15 text-success"
                          : "bg-secondary"
                      }`}
                    >
                      {statusLabel(shop.status || "—")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {shop._count?.products ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shop.createdAt ? formatDate(shop.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {shop.status !== "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({ id: shop.id, st: "ACTIVE" })
                          }
                        >
                          Approve
                        </Button>
                      )}
                      {shop.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({ id: shop.id, st: "SUSPENDED" })
                          }
                        >
                          Suspend
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/merchants/${shop.id}`}>
                          {t("admin.open")}
                        </Link>
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
