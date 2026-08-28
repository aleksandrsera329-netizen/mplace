"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function AdminDisputesPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [status, setStatus] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-disputes", status],
    queryFn: () =>
      api.adminDisputes({
        limit: "40",
        ...(status ? { status } : {}),
      }),
  })

  const resolve = useMutation({
    mutationFn: ({
      id,
      resolution,
    }: {
      id: string
      resolution: string
    }) => api.adminResolveDispute(id, resolution, "Resolved via admin UI"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-disputes"] })
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] })
    },
  })

  const items = data?.items ?? []

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{t("nav.disputes")}</h1>
      <p className="mb-6 text-muted-foreground">Disputes / claims</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "OPEN", "APPEALED", "RESOLVED"].map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s ? statusLabel(s) : t("common.all")}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}

      <div className="space-y-3">
        {items.map((d) => (
          <div
            key={d.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {d.order?.orderNumber || d.orderId || d.id}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {statusLabel(d.status)} · {formatDate(d.createdAt)}
                </div>
                {d.reason && (
                  <p className="mt-2 text-sm">{d.reason}</p>
                )}
              </div>
              {(d.status === "OPEN" || d.status === "APPEALED") && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      resolve.mutate({
                        id: d.id,
                        resolution: "BUYER_WINS",
                      })
                    }
                  >
                    Buyer wins
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolve.mutate({
                        id: d.id,
                        resolution: "MERCHANT_WINS",
                      })
                    }
                  >
                    Merchant wins
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!isLoading && !items.length && (
          <p className="text-muted-foreground">{t("admin.noDisputes")}</p>
        )}
      </div>
    </div>
  )
}
