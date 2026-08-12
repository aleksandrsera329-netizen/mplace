"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

export default function AdminPayoutsPage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-payouts", status],
    queryFn: () =>
      api.adminPayouts({
        limit: "40",
        ...(status ? { status } : {}),
      }),
  })

  const process = useMutation({
    mutationFn: ({ id, st }: { id: string; st: string }) =>
      api.adminProcessPayout(id, st),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payouts"] }),
  })

  const items = data?.items ?? []

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Выплаты</h1>
      <p className="mb-6 text-muted-foreground">Заявки на вывод средств</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {["", "PENDING", "APPROVED", "REJECTED", "PAID"].map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s ? statusLabel(s) : "All"}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : "Ошибка"}
        </p>
      )}

      <div className="space-y-3">
        {items.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div>
              <div className="font-semibold">
                {formatMoney(p.amountCents)} · {p.shop?.name || "Shop"}
              </div>
              <div className="text-sm text-muted-foreground">
                {statusLabel(p.status)} · {formatDate(p.createdAt)}
                {p.note ? ` · ${p.note}` : ""}
              </div>
            </div>
            {p.status === "PENDING" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => process.mutate({ id: p.id, st: "APPROVED" })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => process.mutate({ id: p.id, st: "REJECTED" })}
                >
                  Reject
                </Button>
              </div>
            )}
            {p.status === "APPROVED" && (
              <Button
                size="sm"
                onClick={() => process.mutate({ id: p.id, st: "PAID" })}
              >
                Mark Paid
              </Button>
            )}
          </div>
        ))}
        {!isLoading && !items.length && (
          <p className="text-muted-foreground">Выплат нет</p>
        )}
      </div>
    </div>
  )
}
