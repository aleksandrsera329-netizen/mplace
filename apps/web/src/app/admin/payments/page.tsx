"use client"

import { useI18n } from "@/i18n/store"

export default function AdminPaymentsPage() {
  const { t } = useI18n()
  return (
    <div>
      <h1 className="text-3xl font-bold">{t("admin.payments.title")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("admin.paymentsSoon")}
      </p>
    </div>
  )
}
