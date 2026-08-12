"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

export default function MerchantPayoutsPage() {
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const { data: balance } = useQuery({
    queryKey: ["merchant-balance"],
    queryFn: () => api.merchantBalance(),
  })

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: () => api.payouts(),
  })

  const request = useMutation({
    mutationFn: () => {
      const rub = Number(amount)
      if (!Number.isFinite(rub) || rub <= 0) {
        throw new Error("Укажите сумму")
      }
      const cents = Math.round(rub * 100)
      return api.requestPayout(cents, note || undefined)
    },
    onSuccess: () => {
      setAmount("")
      setNote("")
      setError("")
      void qc.invalidateQueries({ queryKey: ["payouts"] })
      void qc.invalidateQueries({ queryKey: ["merchant-balance"] })
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Ошибка запроса"),
  })

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Выплаты</h1>
      <p className="mb-6 text-muted-foreground">Баланс и заявки на вывод</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Доступно</div>
          <div className="mt-1 text-3xl font-bold text-primary">
            {balance
              ? formatMoney(balance.availableCents, balance.currency)
              : "—"}
          </div>
          {typeof balance?.pendingCents === "number" && (
            <div className="mt-2 text-sm text-muted-foreground">
              В ожидании: {formatMoney(balance.pendingCents, balance.currency)}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Запросить вывод</h2>
          <div className="space-y-3">
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Сумма, ₽"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="Комментарий"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              disabled={request.isPending}
              onClick={() => {
                setError("")
                request.mutate()
              }}
            >
              {request.isPending ? "Отправка…" : "Запросить"}
            </Button>
          </div>
        </div>
      </div>

      <h2 className="mb-3 font-semibold">История</h2>
      {isLoading && <p className="text-muted-foreground">Загрузка…</p>}
      <div className="space-y-2">
        {(payouts || []).map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium">
                {formatMoney(p.amountCents)} · {statusLabel(p.status)}
              </div>
              <div className="text-muted-foreground">
                {formatDate(p.createdAt)}
                {p.note ? ` · ${p.note}` : ""}
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !(payouts || []).length && (
          <p className="text-muted-foreground">Заявок на вывод пока нет</p>
        )}
      </div>
    </div>
  )
}
