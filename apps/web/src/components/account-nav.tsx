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

const links = [
  { href: "/account", label: "Обзор", icon: LayoutDashboard },
  { href: "/orders", label: "Заказы", icon: Package },
  { href: "/wishlist", label: "Избранное", icon: Heart },
  { href: "/rfq", label: "RFQ", icon: FileText },
  { href: "/account/profile", label: "Профиль", icon: User },
]

export function AccountNav() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-64">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Покупатель
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
        {links.map(({ href, label, icon: Icon }) => {
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
              {label}
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
        Выйти
      </Button>
    </aside>
  )
}
