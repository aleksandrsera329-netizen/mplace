"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  Wallet,
  FileText,
  Store,
  Warehouse,
  Truck,
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
  { href: "/merchant", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/merchant/products", labelKey: "nav.products", icon: Package },
  { href: "/merchant/warehouse", labelKey: "nav.warehouse", icon: Warehouse },
  { href: "/merchant/shipping", labelKey: "nav.shipping", icon: Truck },
  { href: "/merchant/orders", labelKey: "nav.orders", icon: ShoppingBag },
  { href: "/merchant/payouts", labelKey: "nav.payouts", icon: Wallet },
  { href: "/merchant/rfq", labelKey: "nav.rfq", icon: FileText },
]

export function MerchantNav() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { t } = useI18n()

  return (
    <aside className="sidebar w-full shrink-0 space-y-4 lg:w-64">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Store className="h-3.5 w-3.5" />
          {t("nav.merchant")}
        </div>
        <div className="mt-1 truncate font-semibold">
          {user?.shop?.name || user?.name || user?.email}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {user?.shop?.status || user?.role}
        </div>
      </div>

      <nav className="space-y-1 rounded-xl border border-border bg-card p-2">
        {links.map(({ href, labelKey, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/merchant" && pathname.startsWith(href))
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
