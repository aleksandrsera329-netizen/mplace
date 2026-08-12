"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ScrollText } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"

export default function AdminAuditPage() {
  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit", action, entityType],
    queryFn: () =>
      api.adminAudit({
        limit: "50",
        ...(action.trim() ? { action: action.trim() } : {}),
        ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
      }),
  })

  const logs = data?.items || []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="mt-1 text-muted-foreground">
          Журнал важных действий в системе
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="action filter"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <input
          type="search"
          placeholder="entityType filter"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-danger">
          {error instanceof Error ? error.message : "Ошибка"}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <ScrollText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">Записей пока нет</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-left font-medium">Действие</th>
                <th className="px-4 py-3 text-left font-medium">Пользователь</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Детали</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{log.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.actor?.email || log.actorId || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {log.entityType}
                    {log.entityId ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {String(log.entityId).slice(0, 8)}…
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                    {log.meta || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
