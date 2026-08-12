"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"
import { Button } from "@/components/ui/button"

export default function MerchantKycPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["merchant", "kyc"],
    queryFn: () => api.merchantKyc(),
  })

  if (isLoading) {
    return <p className="text-muted-foreground">Загрузка KYC…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    )
  }

  const shop = data?.shop
  const summary = data?.summary
  const docs = data?.documents ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">KYC / Верификация</h1>
          <p className="text-muted-foreground">
            {shop?.name} ·{" "}
            {shop?.verified ? "Магазин верифицирован" : "Ожидает проверки"}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refetch()}>
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Статус магазина</div>
          <div className="mt-1 text-xl font-semibold">
            {statusLabel(summary?.shopStatus || shop?.status || "—")}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Pending docs</div>
          <div className="mt-1 text-xl font-semibold">
            {summary?.pending ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Approved / Rejected</div>
          <div className="mt-1 text-xl font-semibold">
            {summary?.approved ?? 0} / {summary?.rejected ?? 0}
          </div>
        </div>
      </div>

      {(shop?.kycNotes || shop?.rejectionReason) && (
        <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          {shop.kycNotes && <p>Заметки: {shop.kycNotes}</p>}
          {shop.rejectionReason && (
            <p className="text-destructive">
              Причина отклонения: {shop.rejectionReason}
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium">Файл</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">{d.docType}</td>
                <td className="px-4 py-3">{d.fileName}</td>
                <td className="px-4 py-3">{statusLabel(d.status)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(d.createdAt)}
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Документов нет. Загрузите через API{" "}
                  <code className="text-xs">POST /shops/:id/kyc</code>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
