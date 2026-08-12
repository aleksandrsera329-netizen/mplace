"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Truck, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { useI18n } from "@/i18n/store"
import { RequireRole } from "@/components/require-role"
import { formatMoney } from "@/lib/format"

export default function MerchantShippingPage() {
  return (
    <RequireRole roles={["MERCHANT", "ADMIN", "SUPER_ADMIN"]}>
      <MerchantShippingInner />
    </RequireRole>
  )
}

function MerchantShippingInner() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [showZone, setShowZone] = useState(false)
  const [showRate, setShowRate] = useState(false)
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
  })
  const [zoneForm, setZoneForm] = useState({
    name: "Москва и МО",
    countries: "RU",
    regions: "Moscow, Moscow Oblast",
  })
  const [rateForm, setRateForm] = useState({
    shippingMethodId: "",
    shippingZoneId: "",
    priceCents: "150000",
    pricePerKgCents: "500",
    estimatedDaysMin: "2",
    estimatedDaysMax: "5",
  })

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["shipping-methods"],
    queryFn: () => api.shipping.listMethods(),
  })

  const { data: zones = [] } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: () => api.shipping.listZones(),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.shipping.createMethod(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] })
      toast({
        title: t("common.success"),
        description: "Метод доставки создан",
        type: "success",
      })
      setIsCreating(false)
      setForm({ name: "", code: "", description: "" })
    },
    onError: (err: Error) => {
      toast({
        title: t("common.error"),
        description: err.message,
        type: "error",
      })
    },
  })

  const zoneMutation = useMutation({
    mutationFn: () =>
      api.shipping.createZone({
        name: zoneForm.name,
        countries: zoneForm.countries
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        regions: zoneForm.regions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-zones"] })
      toast({
        title: t("common.success"),
        description: "Зона создана",
        type: "success",
      })
      setShowZone(false)
    },
    onError: (err: Error) =>
      toast({ title: t("common.error"), description: err.message, type: "error" }),
  })

  const rateMutation = useMutation({
    mutationFn: () =>
      api.shipping.createRate({
        shippingMethodId: rateForm.shippingMethodId,
        shippingZoneId: rateForm.shippingZoneId,
        priceCents: parseInt(rateForm.priceCents, 10) || 0,
        pricePerKgCents: parseInt(rateForm.pricePerKgCents, 10) || undefined,
        estimatedDaysMin: parseInt(rateForm.estimatedDaysMin, 10) || undefined,
        estimatedDaysMax: parseInt(rateForm.estimatedDaysMax, 10) || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] })
      toast({
        title: t("common.success"),
        description: "Тариф создан",
        type: "success",
      })
      setShowRate(false)
    },
    onError: (err: Error) =>
      toast({ title: t("common.error"), description: err.message, type: "error" }),
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Доставка</h1>
          <p className="mt-1 text-muted-foreground">
            Методы, зоны и тарифы доставки
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowZone(true)}>
            <MapPin className="me-2 h-4 w-4" />
            Зона
          </Button>
          <Button variant="outline" onClick={() => setShowRate(true)}>
            Тариф
          </Button>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="me-2 h-4 w-4" />
            Метод
          </Button>
        </div>
      </div>

      {isCreating && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Новый метод доставки</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.name.trim()) return
              createMutation.mutate(form)
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Автотранспорт"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Код</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="truck"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Описание</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Доставка фурой до объекта"
              />
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

      {showZone && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Новая зона</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={zoneForm.name}
                onChange={(e) =>
                  setZoneForm({ ...zoneForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Страны (через запятую)</Label>
              <Input
                value={zoneForm.countries}
                onChange={(e) =>
                  setZoneForm({ ...zoneForm, countries: e.target.value })
                }
                placeholder="RU"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Регионы (через запятую)</Label>
              <Input
                value={zoneForm.regions}
                onChange={(e) =>
                  setZoneForm({ ...zoneForm, regions: e.target.value })
                }
                placeholder="Moscow, Moscow Oblast"
              />
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button
                onClick={() => zoneMutation.mutate()}
                disabled={zoneMutation.isPending}
              >
                Создать зону
              </Button>
              <Button variant="outline" onClick={() => setShowZone(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRate && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Новый тариф</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Метод</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={rateForm.shippingMethodId}
                onChange={(e) =>
                  setRateForm({
                    ...rateForm,
                    shippingMethodId: e.target.value,
                  })
                }
              >
                <option value="">Выберите метод</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Зона</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={rateForm.shippingZoneId}
                onChange={(e) =>
                  setRateForm({ ...rateForm, shippingZoneId: e.target.value })
                }
              >
                <option value="">Выберите зону</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Цена (копейки)</Label>
              <Input
                value={rateForm.priceCents}
                onChange={(e) =>
                  setRateForm({ ...rateForm, priceCents: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>За кг (копейки)</Label>
              <Input
                value={rateForm.pricePerKgCents}
                onChange={(e) =>
                  setRateForm({ ...rateForm, pricePerKgCents: e.target.value })
                }
              />
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button
                onClick={() => rateMutation.mutate()}
                disabled={
                  rateMutation.isPending ||
                  !rateForm.shippingMethodId ||
                  !rateForm.shippingZoneId
                }
              >
                Создать тариф
              </Button>
              <Button variant="outline" onClick={() => setShowRate(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {zones.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Зоны</h2>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <span
                key={z.id}
                className="rounded-full border border-border bg-card px-3 py-1 text-sm"
              >
                {z.name} · {z.countries?.join(", ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <Truck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            Методов доставки пока нет
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{method.name}</h3>
                  {method.code && (
                    <p className="text-sm text-muted-foreground">
                      {method.code}
                    </p>
                  )}
                  {method.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {method.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Тарифов: {method.rates?.length || 0}
                    {method.rates && method.rates.length > 0
                      ? ` · от ${formatMoney(
                          Math.min(
                            ...(method.rates as { priceCents?: number }[]).map(
                              (r) => r.priceCents || 0,
                            ),
                          ),
                        )}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
