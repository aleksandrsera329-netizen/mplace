"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FolderTree, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useI18n } from "@/i18n/store"

function asList(data: unknown): Array<{
  id: string
  name: string
  _count?: { products?: number }
}> {
  if (Array.isArray(data)) return data as ReturnType<typeof asList>
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items
    if (Array.isArray(items)) return items as ReturnType<typeof asList>
  }
  return []
}

export default function AdminCategoriesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")

  const { data: categoriesRaw, isLoading, error } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories(),
  })
  const categories = useMemo(() => asList(categoriesRaw), [categoriesRaw])

  const createMutation = useMutation({
    mutationFn: (n: string) => api.createCategory({ name: n }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] })
      setName("")
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("admin.categories")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("admin.categoriesSubtitle")}
        </p>
      </div>

      <div className="mb-8 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.categoryNamePh")}
          className="max-w-md flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <Button
          onClick={() => name.trim() && createMutation.mutate(name.trim())}
          disabled={!name.trim() || createMutation.isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("common.add")}
        </Button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-danger">
          {error instanceof Error ? error.message : t("common.error")}
        </p>
      )}
      {createMutation.isError && (
        <p className="mb-4 text-sm text-danger">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : t("admin.createError")}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <FolderTree className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t("admin.noCategories")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.productsCount")}</th>
                <th className="px-4 py-3 text-left font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cat._count?.products ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {cat.id}
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
