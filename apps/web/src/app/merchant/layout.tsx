"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  Wallet,
  MessageSquare,
  Users,
  LogOut,
  ArrowLeft,
} from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/merchant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/merchant/products", label: "Товары", icon: Package },
  { href: "/merchant/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/merchant/inventory", label: "Склад", icon: Warehouse },
  { href: "/merchant/finance", label: "Финансы", icon: Wallet },
  { href: "/merchant/payouts", label: "Выплаты", icon: Wallet },
  { href: "/merchant/rfq", label: "RFQ", icon: MessageSquare },
  { href: "/merchant/kyc", label: "KYC", icon: Users },
  { href: "/merchant/customers", label: "Клиенты", icon: Users },
]

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
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
    // Stage 15: merchant cabinet is MERCHANT-only (buyer → /buyer, admin → /admin)
    if (role && role !== "MERCHANT") {
      if (role === "CUSTOMER") router.push("/buyer/dashboard")
      else if (role === "ADMIN" || role === "SUPER_ADMIN")
        router.push("/admin")
      else router.push("/account")
    }
  }, [hydrated, isAuthenticated, user, router])

  if (!hydrated || !isAuthenticated()) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Link href="/merchant" className="text-lg font-bold">
            M<span className="text-primary">place</span>
          </Link>
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            Merchant
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              item.href === "/merchant/dashboard"
                ? pathname === "/merchant" ||
                  pathname === "/merchant/dashboard"
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
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              На витрину
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
            Выйти
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <div className="border-b border-border bg-card/50 px-8 py-4">
          <div className="text-sm text-muted-foreground">
            {user?.email} · {user?.role || "MERCHANT"}
            {user?.shop?.name ? ` · ${user.shop.name}` : ""}
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
