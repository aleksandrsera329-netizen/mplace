"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const qc = useQueryClient()
  const { t } = useI18n()
  const [message, setMessage] = useState("")

  const { data: rfq, isLoading, error } = useQuery({
    queryKey: ["rfq", id],
    queryFn: () => api.rfq(id),
  })

  const award = useMutation({
    mutationFn: (offerId: string) => api.awardRfqOffer(id, offerId),
    onSuccess: (data) => {
      qc.setQueryData(["rfq", id], data)
      void qc.invalidateQueries({ queryKey: ["rfq"] })
    },
  })

  const sendMsg = useMutation({
    mutationFn: () => api.postRfqMessage(id, message.trim()),
    onSuccess: () => {
      setMessage("")
      void qc.invalidateQueries({ queryKey: ["rfq", id] })
    },
  })

  return (
    <AccountShell
      title={rfq?.title || "RFQ"}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/rfq">{t("rfq.listBack")}</Link>
        </Button>
      }
    >
      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}

      {rfq && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">{rfq.number}</div>
                <div className="mt-1 text-lg font-semibold">
                  {statusLabel(rfq.status)}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("rfq.createdAt", { date: formatDate(rfq.createdAt) })}
                {rfq.deadline ? (
                  <>
                    <br />
                    {t("rfq.deadlineAt", { date: formatDate(rfq.deadline) })}
                  </>
                ) : null}
              </div>
            </div>
            {rfq.description && (
              <p className="mt-4 text-sm text-muted-foreground">
                {rfq.description}
              </p>
            )}
          </div>

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

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">
              {t("rfq.offersTitle", { n: rfq.offers?.length ?? 0 })}
            </h2>
            {!rfq.offers?.length ? (
              <p className="text-sm text-muted-foreground">
                {t("rfq.noOffers")}
              </p>
            ) : (
              <div className="space-y-3">
                {rfq.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {offer.shop?.name || offer.shopId}
                        </div>
                        {offer.message && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {offer.message}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {typeof offer.totalCents === "number" && (
                          <div className="font-bold text-accent">
                            {formatMoney(offer.totalCents)}
                          </div>
                        )}
                        {rfq.status !== "AWARDED" && (
                          <Button
                            size="sm"
                            className="mt-2"
                            disabled={award.isPending}
                            onClick={() => award.mutate(offer.id)}
                          >
                            {t("rfq.award")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {award.isError && (
              <p className="mt-2 text-sm text-danger">
                {award.error instanceof Error
                  ? award.error.message
                  : t("rfq.awardError")}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">{t("rfq.messages")}</h2>
            <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
              {(rfq.messages || []).length === 0 && (
                <p className="text-sm text-muted-foreground">{t("rfq.emptyMessages")}</p>
              )}
              {(rfq.messages || []).map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                >
                  <div className="text-xs text-muted-foreground">
                    {m.author?.name || t("rfq.participant")} · {formatDate(m.createdAt)}
                  </div>
                  <div className="mt-1">{m.body}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("rfq.messagePh")}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button
                disabled={!message.trim() || sendMsg.isPending}
                onClick={() => sendMsg.mutate()}
              >
                {t("rfq.send")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  )
}
