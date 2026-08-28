"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/i18n/store"

/** Legacy path — redirect to merchants */
export default function AdminShopsRedirect() {
  const { t } = useI18n()
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/merchants")
  }, [router])
  return (
    <div className="text-muted-foreground">{t("admin.redirectMerchants")}</div>
  )
}
