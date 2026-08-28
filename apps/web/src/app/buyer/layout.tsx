"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  MessageSquare,
  Heart,
  User,
  Shield,
  MapPin,
  LogOut,
  ArrowLeft,
} from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useI18n, type TranslationKey } from "@/i18n/store"

const nav: { href: string; labelKey: TranslationKey; icon: typeof User }[] = [
  { href: "/buyer/dashboard", labelKey: "account.overview", icon: LayoutDashboard },
  { href: "/buyer/orders", labelKey: "nav.orders", icon: ShoppingCart },
  { href: "/buyer/rfqs", labelKey: "nav.rfq", icon: MessageSquare },
  { href: "/wishlist", labelKey: "header.wishlist", icon: Heart },
  { href: "/account/profile", labelKey: "account.profile", icon: User },
  { href: "/buyer/security", labelKey: "buyer.security", icon: Shield },
  { href: "/buyer/addresses", labelKey: "buyer.addresses", icon: MapPin },
]

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const { user, isAuthenticated, logout, hydrated, refresh } = useAuthStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }
    const role = user?.role
    if (role && role !== "CUSTOMER") {
      // Merchants / admins use their own cabinets
      if (role === "MERCHANT") router.push("/merchant")
      else if (role === "ADMIN" || role === "SUPER_ADMIN") router.push("/admin")
      else router.push("/account")
    }
  }, [hydrated, isAuthenticated, user, router])

  if (!hydrated || !isAuthenticated()) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (user?.role && user.role !== "CUSTOMER") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t("common.redirect")}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Link href="/buyer/dashboard" className="text-lg font-bold">
            M<span className="text-primary">place</span>
          </Link>
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            Buyer
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              item.href === "/buyer/dashboard"
                ? pathname === "/buyer/dashboard"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {t("common.storefront")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={() => {
              logout()
              router.push("/login")
            }}
          >
            <LogOut className="h-4 w-4" />
            {t("common.logout")}
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
