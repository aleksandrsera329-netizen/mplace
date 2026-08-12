"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Mail,
  Palette,
  ScrollText,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/store"
import type { TranslationKey } from "@/i18n/store"

const links: { href: string; labelKey: TranslationKey; icon: typeof Users }[] =
  [
    { href: "/admin", labelKey: "nav.dashboard", icon: LayoutDashboard },
    { href: "/admin/users", labelKey: "nav.users", icon: Users },
    { href: "/admin/shops", labelKey: "nav.shops", icon: Store },
    { href: "/admin/orders", labelKey: "nav.orders", icon: ShoppingBag },
    { href: "/admin/disputes", labelKey: "nav.disputes", icon: AlertTriangle },
    { href: "/admin/payouts", labelKey: "nav.payouts", icon: Wallet },
    { href: "/admin/audit", labelKey: "nav.audit", icon: ScrollText },
    {
      href: "/admin/settings/branding",
      labelKey: "nav.branding",
      icon: Palette,
    },
    { href: "/admin/settings/invites", labelKey: "nav.invites", icon: Mail },
  ]

export function AdminNav() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { t } = useI18n()

  return (
    <aside className="sidebar w-full shrink-0 space-y-4 lg:w-64">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("nav.admin")}
        </div>
        <div className="mt-1 truncate font-semibold">
          {user?.name || user?.email}
        </div>
        <div className="text-xs text-muted-foreground">{user?.role}</div>
      </div>

      <nav className="space-y-1 rounded-xl border border-border bg-card p-2">
        {links.map(({ href, labelKey, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/admin" && pathname.startsWith(href))
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
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>

      <Button variant="outline" className="w-full" asChild>
        <Link href="/">{t("common.storefront")}</Link>
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => {
          logout()
          window.location.href = "/login"
        }}
      >
        <LogOut className="h-4 w-4" />
        {t("nav.logout")}
      </Button>
    </aside>
  )
}
