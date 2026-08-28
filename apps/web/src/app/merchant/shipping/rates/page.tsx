"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/i18n/store"

/** Rates UI lives on /merchant/shipping — redirect for bookmark compatibility */
export default function MerchantShippingRatesPage() {
  const router = useRouter()
  const { t } = useI18n()
  useEffect(() => {
    router.replace("/merchant/shipping")
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">{t("common.redirect")}</p>
  )
}
