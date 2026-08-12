"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  FileText,
  Heart,
  Moon,
  Package,
  Search,
  ShoppingCart,
  Sun,
  User,
} from "lucide-react"
import type { Locale } from "@/i18n/store"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notification-bell"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { useTenantStore } from "@/store/tenant"
import { useI18n } from "@/i18n/store"
import { homePathForRole } from "@/lib/role-routes"

export function Header() {
  const { theme, setTheme } = useTheme()
  const { itemCount, open } = useCartStore()
  const { user, hydrated, refresh, isAuthenticated } = useAuthStore()
  const { locale, setLocale, t } = useI18n()
  const tenant = useTenantStore((s) => s.tenant)
  const router = useRouter()
  const [search, setSearch] = useState("")

  const languages = [
    { code: "ru" as Locale, label: "RU" },
    { code: "en" as Locale, label: "EN" },
    { code: "ar" as Locale, label: "AR" },
  ]

  useEffect(() => {
    if (!hydrated) void refresh()
  }, [hydrated, refresh])

  const loggedIn = Boolean(user) || isAuthenticated()
  const accountHref = loggedIn ? homePathForRole(user?.role) : "/login"

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}`)
    } else {
      router.push("/")
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-xl font-extrabold tracking-tight"
        >
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name || "Logo"}
              className="h-8 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <>
              M<span className="text-primary">place</span> Energy
            </>
          )}
          {tenant?.name && !tenant.logoUrl && (
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              {tenant.name}
            </span>
          )}
        </Link>

        <form
          onSubmit={handleSearch}
          className="mx-2 hidden min-w-0 flex-1 max-w-md md:flex"
        >
          <div className="relative w-full">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("header.search.placeholder")}
              className="w-full rounded-lg border border-border bg-background py-2 ps-10 pe-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </form>

        <nav className="hidden items-center gap-1 lg:flex">
          {user && (
            <>
              {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">{t("nav.admin")}</Link>
                </Button>
              )}
              {(user.role === "MERCHANT" ||
                user.role === "ADMIN" ||
                user.role === "SUPER_ADMIN") && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/merchant">{t("nav.merchant")}</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/orders" className="gap-1.5" title={t("nav.orders")}>
                  <Package className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/rfq" className="gap-1.5" title={t("nav.rfq")}>
                  <FileText className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLocale(lang.code)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  locale === lang.code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={t("header.theme")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <NotificationBell />

          <Button
            variant="ghost"
            size="icon"
            asChild
            title={t("header.wishlist")}
          >
            <Link href={loggedIn ? "/wishlist" : "/login"}>
              <Heart className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            asChild
            title={loggedIn ? t("header.account") : t("header.login")}
          >
            <Link href={accountHref}>
              <User className="h-5 w-5" />
            </Link>
          </Button>

          {/* Stage 20: primary path is /cart; drawer is quick peek */}
          <Button className="gap-2" asChild>
            <Link
              href="/cart"
              onClick={(e) => {
                // Ctrl/Cmd or middle-click → full page; plain click opens drawer
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                e.preventDefault()
                open()
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">{t("header.cart")}</span>
              {itemCount > 0 && (
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-bold">
                  {itemCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 md:hidden">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("catalog.search.placeholder")}
            className="w-full rounded-lg border border-border bg-background py-2 ps-10 pe-4 text-sm outline-none focus:border-primary"
          />
        </form>
      </div>
    </header>
  )
}
