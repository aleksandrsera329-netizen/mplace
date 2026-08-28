"use client"

import { useI18n } from "@/i18n/store"

export default function BuyerSecurityPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">{t("security.title")}</h1>
      <p className="text-muted-foreground">{t("security.soon")}</p>
    </div>
  )
}
