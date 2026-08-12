"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function AdminMerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return (
    <div>
      <Link
        href="/admin/merchants"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к продавцам
      </Link>
      <h1 className="text-3xl font-bold">Магазин {id}</h1>
      <p className="mt-2 text-muted-foreground">
        Детальная карточка продавца — следующий шаг
      </p>
    </div>
  )
}
