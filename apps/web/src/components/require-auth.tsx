"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { useI18n } from "@/i18n/store"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading, hydrated, refresh } = useAuthStore()
  const { t } = useI18n()

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (hydrated && !loading && !user) {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : ""
      const q =
        next && next !== "/login"
          ? `?next=${encodeURIComponent(next)}`
          : ""
      router.replace(`/login${q}`)
    }
  }, [hydrated, loading, user, router])

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        {t("common.redirectLogin")}
      </div>
    )
  }

  return <>{children}</>
}
