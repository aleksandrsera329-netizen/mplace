"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Wallet, ArrowUpRight, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

export default function MerchantFinancePage() {
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const { data: balance } = useQuery({
    queryKey: ["merchant-balance"],
    queryFn: () => api.merchantBalance(),
    retry: false,
  })

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: () => api.payouts(),
    retry: false,
  })

  const request = useMutation({
    mutationFn: () => {
      const rub = Number(amount)
      if (!Number.isFinite(rub) || rub <= 0) throw new Error("Укажите сумму")
      return api.requestPayout(Math.round(rub * 100), note || undefined)
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

  const available = balance?.availableCents ?? 0
  const pending =
    balance?.pendingCents ??
    (Array.isArray(payouts)
      ? payouts
          .filter((p) => p.status === "PENDING")
          .reduce((s, p) => s + p.amountCents, 0)
      : 0)

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Финансы</h1>
          <p className="mt-1 text-muted-foreground">Баланс и выплаты</p>
        </div>
      </div>

      <div className="mb-10 grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Доступно к выплате</p>
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-bold text-accent">
            {formatMoney(available, balance?.currency)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">В ожидании</p>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="mt-3 text-3xl font-bold">{formatMoney(pending)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Всего заработано</p>
            <ArrowUpRight className="h-5 w-5 text-success" />
          </div>
          <p className="mt-3 text-3xl font-bold">
            {formatMoney(
              (balance as { earnedCents?: number } | undefined)?.earnedCents ??
                available + pending,
            )}
          </p>
        </div>
      </div>

      <div className="mb-10 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold">Запросить выплату</h2>
        <div className="flex max-w-lg flex-col gap-3 sm:flex-row">
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Сумма, ₽"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="Комментарий"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button
            disabled={request.isPending}
            onClick={() => {
              setError("")
              request.mutate()
            }}
          >
            {request.isPending ? "…" : "Запросить"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4 font-semibold">
          История выплат
        </div>

        {isLoading ? (
          <div className="px-5 py-8 text-muted-foreground">Загрузка…</div>
        ) : !(payouts || []).length ? (
          <div className="px-5 py-16 text-center text-muted-foreground">
            Выплат пока нет
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(payouts || []).map((payout) => (
              <div
                key={payout.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <div className="font-medium">
                    {formatMoney(payout.amountCents)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(payout.createdAt)}
                    {payout.note ? ` · ${payout.note}` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                  {statusLabel(payout.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
