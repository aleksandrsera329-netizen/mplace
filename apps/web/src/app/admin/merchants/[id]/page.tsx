"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/i18n/store"

export default function AdminMerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { t } = useI18n()
  const { id } = use(params)
  return (
    <div>
      <Link
        href="/admin/merchants"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.backToMerchants")}
      </Link>
      <h1 className="text-3xl font-bold">{t("admin.shopId", { id })}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("admin.shopSoonDetail")}
      </p>
    </div>
  )
}
