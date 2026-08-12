"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"

export default function RfqListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["rfq"],
    queryFn: () => api.rfqs({ limit: "30" }),
  })

  const items = data?.items ?? []

  return (
    <AccountShell
      title="RFQ — заявки на котировку"
      actions={
        <Button asChild className="gap-2">
          <Link href="/rfq/new">
            <Plus className="h-4 w-4" />
            Создать RFQ
          </Link>
        </Button>
      }
    >
      {isLoading && <p className="text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-danger">
          {error instanceof Error ? error.message : "Ошибка"}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <p className="mb-4">У вас ещё нет RFQ</p>
          <Button asChild>
            <Link href="/rfq/new">Создать первую заявку</Link>
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
                  {r.deadline ? ` · до ${formatDate(r.deadline)}` : ""}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{statusLabel(r.status)}</div>
                <div className="text-muted-foreground">
                  офферов: {r._count?.offers ?? 0}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AccountShell>
  )
}
