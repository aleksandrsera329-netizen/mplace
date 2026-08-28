"use client"

/**
 * Stage 20 — TZ alias `/dashboard` → role cabinet.
 */
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { homePathForRole } from "@/lib/role-routes"
import { useI18n } from "@/i18n/store"

export default function DashboardAliasPage() {
  const router = useRouter()
  const { user, hydrated, refresh, isAuthenticated } = useAuthStore()
  const { t } = useI18n()

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated()) {
      router.replace("/login?next=/dashboard")
      return
    }
    router.replace(homePathForRole(user?.role))
  }, [hydrated, isAuthenticated, user, router])

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      {t("dashboard.redirect")}
    </div>
  )
}
