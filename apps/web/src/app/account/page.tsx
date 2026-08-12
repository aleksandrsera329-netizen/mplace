"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { formatDate, formatMoney, statusLabel } from "@/lib/format"

export default function AccountPage() {
  const router = useRouter()
  const { user, accessToken, logout, isAuthenticated, hydrated, refresh } =
    useAuthStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (hydrated && !isAuthenticated()) {
      router.push("/login?next=/account")
    }
  }, [hydrated, isAuthenticated, router])

  // Stage 20: /account is a hub — send roles to their primary cabinets
  useEffect(() => {
    if (!hydrated || !user?.role) return
    const r = String(user.role).toUpperCase()
    if (r === "MERCHANT") router.replace("/merchant/dashboard")
    else if (r === "ADMIN" || r === "SUPER_ADMIN") router.replace("/admin")
    else if (r === "CUSTOMER") router.replace("/buyer/dashboard")
  }, [hydrated, user, router])

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["orders", "account"],
    queryFn: () => api.orders({ limit: "30" }),
    enabled: !!accessToken || isAuthenticated(),
  })

  const orders = ordersData?.items ?? []

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          Загрузка…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Личный кабинет</h1>
            <p className="mt-1 text-muted-foreground">
              {user.name ? `${user.name} · ` : ""}
              {user.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role === "CUSTOMER" && (
              <Button asChild>
                <Link href="/buyer/dashboard">Кабинет покупателя</Link>
              </Button>
            )}
            {user.role === "MERCHANT" && (
              <Button asChild>
                <Link href="/merchant/dashboard">Кабинет продавца</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/account/profile">Профиль</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/buyer/orders">Все заказы</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/wishlist">Избранное</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/buyer/rfqs">RFQ</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                logout()
                router.push("/")
              }}
            >
              Выйти
            </Button>
          </div>
        </div>

        <h2 className="mb-4 text-xl font-semibold">Мои заказы / заявки</h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 text-center text-muted-foreground">
            Заказов пока нет.{" "}
            <Link href="/" className="text-primary underline">
              В каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition hover:border-primary sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {order.orderNumber || order.id}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(order.createdAt)} · {statusLabel(order.status)}
                  </div>
                </div>
                <div className="font-semibold text-accent">
                  {formatMoney(order.totalCents || 0, order.currency)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
