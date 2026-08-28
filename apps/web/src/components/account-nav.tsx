"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Package,
  FileText,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/store"
import type { TranslationKey } from "@/i18n/store"

const links: {
  href: string
  labelKey: TranslationKey
  icon: typeof Package
}[] = [
  { href: "/account", labelKey: "account.overview", icon: LayoutDashboard },
  { href: "/orders", labelKey: "nav.orders", icon: Package },
  { href: "/wishlist", labelKey: "header.wishlist", icon: Heart },
  { href: "/rfq", labelKey: "nav.rfq", icon: FileText },
  { href: "/account/profile", labelKey: "account.profile", icon: User },
]

export function AccountNav() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { t } = useI18n()

  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-64">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("account.buyerRole")}
        </div>
        <div className="mt-1 truncate font-semibold">
          {user?.name || user?.email || "…"}
        </div>
        {user?.company && (
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {user.company}
          </div>
        )}
      </div>

      <nav className="space-y-1 rounded-xl border border-border bg-card p-2">
        {links.map(({ href, labelKey, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/account" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>

      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => {
          logout()
          window.location.href = "/login"
        }}
      >
        <LogOut className="h-4 w-4" />
        {t("common.logout")}
      </Button>
    </aside>
  )
}
