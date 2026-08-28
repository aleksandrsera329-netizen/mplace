"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/store"

export default function BuyerRfqsPage() {
  const search = useSearchParams()
  const { t } = useI18n()
  const filters = [
    { key: "all", label: t("common.all") },
    { key: "open", label: t("status.OPEN") },
    { key: "offers", label: t("status.QUOTED") },
    { key: "awarded", label: t("status.AWARDED") },
    { key: "draft", label: t("status.DRAFT") },
  ]
  const status = search.get("status") || "all"

  const { data, isLoading, error } = useQuery({
    queryKey: ["buyer", "rfqs", status],
    queryFn: () => api.buyerRfqs(status === "all" ? undefined : status),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("buyer.rfqsTitle")}</h1>
          <p className="text-muted-foreground">{t("buyer.rfqsSubtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/rfq/new">{t("buyer.newRfq")}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={
              f.key === "all" ? "/buyer/rfqs" : `/buyer/rfqs?status=${f.key}`
            }
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              status === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}

      <div className="space-y-3">
        {(data?.items ?? []).map((r) => (
          <Link
            key={r.id}
            href={`/rfq/${r.id}`}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.number} · {statusLabel(r.status)} ·{" "}
                  {formatDate(r.createdAt)}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {typeof r._count?.offers === "number"
                  ? t("rfq.offersCount", { n: r._count.offers })
                  : null}
              </div>
            </div>
          </Link>
        ))}
        {!isLoading && (data?.items?.length ?? 0) === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {t("buyer.noRfqs")}{" "}
            <Link href="/rfq/new" className="text-primary underline">
              {t("buyer.createRequest")}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
