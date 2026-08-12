"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate, statusLabel } from "@/lib/format"

export default function AdminKycPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: () => api.kycPending(),
  })

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: "APPROVED" | "REJECTED"
    }) => api.reviewKyc(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-kyc"] })
    },
  })

  const documents = Array.isArray(data) ? data : []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">KYC</h1>
        <p className="mt-1 text-muted-foreground">
          Проверка документов продавцов
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-danger">
          {error instanceof Error ? error.message : "Ошибка"}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            Нет документов на проверке
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Документ</th>
                <th className="px-4 py-3 text-left font-medium">Магазин</th>
                <th className="px-4 py-3 text-left font-medium">Тип</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-medium">
                    {doc.fileName || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.shop?.name || "—"}
                  </td>
                  <td className="px-4 py-3">{doc.docType || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.createdAt ? formatDate(doc.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {statusLabel(doc.status || "PENDING")}
                    </span>
                  </td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    {(doc.status === "PENDING" || !doc.status) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-success"
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              id: doc.id,
                              status: "APPROVED",
                            })
                          }
                        >
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-danger"
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              id: doc.id,
                              status: "REJECTED",
                            })
                          }
                        >
                          Отклонить
                        </Button>
                      </>
                    )}
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
