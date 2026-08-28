"use client"

import { Users } from "lucide-react"
import { useI18n } from "@/i18n/store"

export default function MerchantCustomersPage() {
  const { t } = useI18n()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("merchant.clients.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("merchant.customersSubtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card py-20 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">
          {t("merchant.customersEmpty")}
        </p>
      </div>
    </div>
  )
}
