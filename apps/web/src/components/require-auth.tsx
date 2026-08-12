"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading, hydrated, refresh } = useAuthStore()

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
        Загрузка…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Перенаправление на вход…
      </div>
    )
  }

  return <>{children}</>
}
