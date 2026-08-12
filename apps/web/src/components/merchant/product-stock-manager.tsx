"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { api, type Warehouse } from "@/lib/api"
import { useI18n } from "@/i18n/store"
import { Loader2, Warehouse as WarehouseIcon } from "lucide-react"
import Link from "next/link"

export function ProductStockManager({ productId }: { productId: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const { data: warehouses = [] } = useQuery({
    queryKey: ["merchant-warehouses"],
    queryFn: () => api.warehouses.list(),
  })

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ["product-stocks", productId],
    queryFn: () => api.getProductStocks(productId),
    enabled: !!productId,
  })

  const [quantities, setQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    const map: Record<string, number> = {}
    for (const s of stocks) {
      map[s.warehouseId] = s.quantity
    }
    setQuantities(map)
  }, [stocks])

  const mutation = useMutation({
    mutationFn: (data: { warehouseId: string; quantity: number }) =>
      api.warehouses.updateStock({
        productId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-stocks", productId] })
      queryClient.invalidateQueries({ queryKey: ["product", productId] })
      toast({
        title: t("common.success"),
        description: "Остаток обновлён",
        type: "success",
      })
    },
    onError: (err: Error) => {
      toast({
        title: t("common.error"),
        description: err.message,
        type: "error",
      })
    },
  })

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <WarehouseIcon className="h-5 w-5" />
        <h3 className="font-semibold">{t("merchant.warehouse.stock")}</h3>
      </div>

      {warehouses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Сначала создайте хотя бы один склад.{" "}
          <Link href="/merchant/warehouse" className="text-primary underline">
            {t("merchant.warehouse.title")}
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {warehouses.map((wh: Warehouse) => (
            <div key={wh.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {wh.name}
                  {wh.isDefault ? (
                    <span className="ms-2 text-xs text-primary">★</span>
                  ) : null}
                </div>
                {wh.code && (
                  <div className="text-xs text-muted-foreground">{wh.code}</div>
                )}
              </div>
              <Input
                type="number"
                min={0}
                className="w-28"
                value={quantities[wh.id] ?? 0}
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [wh.id]: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
              <Button
                size="sm"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    warehouseId: wh.id,
                    quantity: quantities[wh.id] ?? 0,
                  })
                }
              >
                {t("common.save")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
