"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function RfqListPage() {
  const { t } = useI18n()
  const { data, isLoading, error } = useQuery({
    queryKey: ["rfq"],
    queryFn: () => api.rfqs({ limit: "30" }),
  })

  const items = data?.items ?? []

  return (
    <AccountShell
      title={t("rfq.pageTitle")}
      actions={
        <Button asChild className="gap-2">
          <Link href="/rfq/new">
            <Plus className="h-4 w-4" />
            {t("rfq.create")}
          </Link>
        </Button>
      }
    >
      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <p className="mb-4">{t("rfq.none")}</p>
          <Button asChild>
            <Link href="/rfq/new">{t("rfq.createFirst")}</Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {items.map((r) => (
          <Link
            key={r.id}
            href={`/rfq/${r.id}`}
            className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {r.number} · {formatDate(r.createdAt)}
                  {r.deadline ? ` · ${t("rfq.until", { date: formatDate(r.deadline) })}` : ""}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{statusLabel(r.status)}</div>
                <div className="text-muted-foreground">
                  {t("rfq.offersCount", { n: r._count?.offers ?? 0 })}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AccountShell>
  )
}
