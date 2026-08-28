"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function MerchantRfqPage() {
  const { t } = useI18n()
  const { data, isLoading, error } = useQuery({
    queryKey: ["merchant-rfq"],
    queryFn: () => api.rfqs({ incoming: "1", limit: "50" }),
  })

  const rfqs = data?.items || []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("nav.rfq")}</h1>
        <p className="mt-1 text-muted-foreground">{t("rfq.pageTitle")}</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : rfqs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t("rfq.none")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  {t("buyer.number")} / {t("rfq.subject")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.date")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("common.status")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((rfq) => (
                <tr
                  key={rfq.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {rfq.title || rfq.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {rfq.number}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(rfq.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {statusLabel(rfq.status || "OPEN")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/merchant/rfq/${rfq.id}`}>{t("admin.open")}</Link>
                    </Button>
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
