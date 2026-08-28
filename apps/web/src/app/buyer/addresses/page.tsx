"use client"

import { useI18n } from "@/i18n/store"

export default function BuyerAddressesPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">{t("buyer.addresses")}</h1>
      <p className="text-muted-foreground">{t("addresses.soon")}</p>
    </div>
  )
}
