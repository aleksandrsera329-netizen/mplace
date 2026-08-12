"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingCart,
  Package,
  FolderTree,
  CreditCard,
  ShieldCheck,
  ScrollText,
  Settings,
  LogOut,
  ArrowLeft,
  AlertTriangle,
  Wallet,
} from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/merchants", label: "Продавцы", icon: Store },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/admin/products", label: "Товары", icon: Package },
  { href: "/admin/categories", label: "Категории", icon: FolderTree },
  { href: "/admin/payments", label: "Платежи", icon: CreditCard },
  { href: "/admin/payouts", label: "Выплаты", icon: Wallet },
  { href: "/admin/disputes", label: "Споры", icon: AlertTriangle },
  { href: "/admin/kyc", label: "KYC", icon: ShieldCheck },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
]

export default function AdminLayout({
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
    if (role && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      router.push("/account")
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
          <Link href="/admin" className="text-lg font-bold">
            M<span className="text-primary">place</span>
          </Link>
          <span className="rounded bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
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
          <Button variant="ghost" className="w-full justify-start gap-3" asChild>
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
            {user?.email} · {user?.role || "ADMIN"}
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
