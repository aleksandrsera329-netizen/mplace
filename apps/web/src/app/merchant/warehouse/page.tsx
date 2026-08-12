"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Warehouse, MapPin, Star, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { api, type Warehouse as WarehouseType } from "@/lib/api"
import { useI18n } from "@/i18n/store"
import { RequireRole } from "@/components/require-role"

export default function MerchantWarehousePage() {
  return (
    <RequireRole roles={["MERCHANT", "ADMIN", "SUPER_ADMIN"]}>
      <MerchantWarehouseInner />
    </RequireRole>
  )
}

function MerchantWarehouseInner() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    address: "",
    isDefault: false,
  })

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["merchant-warehouses"],
    queryFn: () => api.warehouses.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.warehouses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-warehouses"] })
      toast({
        title: t("common.success"),
        description: "Склад создан",
        type: "success",
      })
      setIsCreating(false)
      setForm({ name: "", code: "", city: "", address: "", isDefault: false })
    },
    onError: (err: Error) => {
      toast({
        title: t("common.error"),
        description: err.message,
        type: "error",
      })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    createMutation.mutate(form)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("merchant.warehouse.title")}</h1>
          <p className="mt-1 text-muted-foreground">
            Управление складами и остатками
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="me-2 h-4 w-4" />
          Добавить склад
        </Button>
      </div>

      {isCreating && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Новый склад</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Склад Москва"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Код</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MSK-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Город</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Москва"
              />
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="ул. Примерная, 1"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm({ ...form, isDefault: e.target.checked })
                }
              />
              <Label htmlFor="isDefault">Склад по умолчанию</Label>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                Создать
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreating(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : warehouses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <Warehouse className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">Складов пока нет</p>
          <Button className="mt-4" onClick={() => setIsCreating(true)}>
            Создать первый склад
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((wh: WarehouseType) => (
            <div
              key={wh.id}
              className="relative rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
            >
              {wh.isDefault && (
                <div className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Star className="h-3 w-3" />
                  По умолчанию
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Warehouse className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pe-16">
                  <h3 className="font-semibold">{wh.name}</h3>
                  {wh.code && (
                    <p className="text-sm text-muted-foreground">{wh.code}</p>
                  )}
                </div>
              </div>
              {(wh.city || wh.address) && (
                <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {wh.city}
                    {wh.city && wh.address && ", "}
                    {wh.address}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
