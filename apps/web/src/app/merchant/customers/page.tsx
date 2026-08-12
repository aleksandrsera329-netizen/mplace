"use client"

import { Users } from "lucide-react"

export default function MerchantCustomersPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Клиенты</h1>
        <p className="mt-1 text-muted-foreground">
          Покупатели, которые оформляли заказы в вашем магазине
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card py-20 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">
          Список клиентов появится после появления заказов
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          (будет формироваться на основе заказов вашего магазина)
        </p>
      </div>
    </div>
  )
}
