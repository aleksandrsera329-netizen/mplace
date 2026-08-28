"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function MerchantRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { t } = useI18n()

  const { data: rfq, isLoading, error } = useQuery({
    queryKey: ["rfq", id],
    queryFn: () => api.rfq(id),
  })

  if (isLoading) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>
  }

  if (error || !rfq) {
    return (
      <div>
        <Link
          href="/merchant/rfq"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("rfq.listBack")}
        </Link>
        <p className="text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/merchant/rfq"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("rfq.listBack")}
      </Link>

      <h1 className="mb-2 text-3xl font-bold">{rfq.title}</h1>
      <p className="mb-6 text-muted-foreground">
        {rfq.number} · {formatDate(rfq.createdAt)} · {statusLabel(rfq.status)}
      </p>

      {rfq.description && (
        <p className="mb-6 text-sm text-muted-foreground">{rfq.description}</p>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-semibold">{t("rfq.items")}</h2>
        <ul className="divide-y divide-border text-sm">
          {(rfq.items || []).map((it) => (
            <li key={it.id} className="py-3">
              <div className="font-medium">{it.name}</div>
              <div className="text-muted-foreground">
                {it.quantity} {it.unit || "pcs"}
                {it.specs ? ` · ${it.specs}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {t("merchant.rfq.respond")}
      </p>
    </div>
  )
}
