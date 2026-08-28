"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { RequireAuth } from "@/components/require-auth"
import { homePathForRole } from "@/lib/role-routes"
import { useI18n } from "@/i18n/store"

export function RequireRole({
  roles,
  children,
}: {
  roles: string[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { t } = useI18n()

  useEffect(() => {
    if (user?.role && !roles.includes(user.role)) {
      // Stage 20: send to role home instead of generic /account
      router.replace(homePathForRole(user.role))
    }
  }, [user, roles, router])

  return (
    <RequireAuth>
      {user?.role && roles.includes(user.role) ? (
        children
      ) : user ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          {t("common.noAccess")}
        </div>
      ) : null}
    </RequireAuth>
  )
}
