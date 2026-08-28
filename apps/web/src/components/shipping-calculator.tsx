"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Truck, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { formatMoney, useLivePrices } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export type ShippingRateOption = {
  id: string
  methodId?: string
  methodName: string
  methodCode?: string | null
  zoneName: string
  warehouseName?: string | null
  priceCents: number
  estimatedDaysMin?: number | null
  estimatedDaysMax?: number | null
}

export function ShippingCalculator({
  weightKg = 100,
  country = "RU",
  region = "Moscow",
  warehouseId,
  merchantId,
  onSelect,
}: {
  weightKg?: number
  country?: string
  region?: string
  warehouseId?: string
  merchantId?: string
  onSelect?: (rate: ShippingRateOption | null) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  useLivePrices()
  const { t } = useI18n()

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["shipping-rates", country, region, weightKg, warehouseId, merchantId],
    queryFn: () =>
      api.shipping.calculate({
        country,
        region,
        weightKg,
        warehouseId,
        merchantId,
      }),
    enabled: !!country,
  })

  useEffect(() => {
    if (rates.length > 0 && !selected) {
      setSelected(rates[0].id)
      onSelect?.(rates[0])
    }
    if (rates.length === 0) {
      setSelected(null)
      onSelect?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("shipping.calculating")}
      </div>
    )
  }

  if (rates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t("shipping.unavailable")}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-medium">
        <Truck className="h-4 w-4" />
        {t("shipping.method")}
      </div>

      <div className="space-y-2">
        {rates.map((rate) => (
          <label
            key={rate.id}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              selected === rate.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="shipping"
                checked={selected === rate.id}
                onChange={() => {
                  setSelected(rate.id)
                  onSelect?.(rate)
                }}
              />
              <div>
                <div className="font-medium">{rate.methodName}</div>
                <div className="text-sm text-muted-foreground">
                  {rate.estimatedDaysMin && rate.estimatedDaysMax
                    ? t("shipping.days", {
                        min: rate.estimatedDaysMin,
                        max: rate.estimatedDaysMax,
                      })
                    : t("shipping.etaUnknown")}
                  {rate.warehouseName && ` · ${rate.warehouseName}`}
                  {rate.zoneName && ` · ${rate.zoneName}`}
                </div>
              </div>
            </div>
            <div className="font-semibold">{formatMoney(rate.priceCents)}</div>
          </label>
        ))}
      </div>
    </div>
  )
}
