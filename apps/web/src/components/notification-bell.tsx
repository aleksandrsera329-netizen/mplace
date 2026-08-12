"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Bell, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import Link from "next/link"

function formatRelative(dateStr: string) {
  const d = new Date(dateStr).getTime()
  const diff = Math.max(0, Date.now() - d)
  const min = Math.floor(diff / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин. назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч. назад`
  const days = Math.floor(h / 24)
  return `${days} дн. назад`
}

export function NotificationBell() {
  const queryClient = useQueryClient()
  const { user, isAuthenticated, accessToken } = useAuthStore()
  const loggedIn = Boolean(user) || isAuthenticated() || !!accessToken
  const [open, setOpen] = useState(false)

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(),
    enabled: loggedIn,
    refetchInterval: 30_000,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markAsRead = useMutation({
    mutationFn: (id: string) => api.notifications.markAsRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const markAllAsRead = useMutation({
    mutationFn: () => api.notifications.markAllAsRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!loggedIn) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
        title="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-50 mt-2 w-96 max-w-[95vw] rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-semibold">Уведомления</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                >
                  <Check className="me-1 h-4 w-4" />
                  Прочитать все
                </Button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Нет уведомлений
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-border px-4 py-3 transition hover:bg-secondary/50 ${
                      !n.isRead ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{n.title}</div>
                        <div className="mt-0.5 text-sm text-muted-foreground">
                          {n.message}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatRelative(n.createdAt)}
                        </div>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead.mutate(n.id)}
                          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                          title="Отметить прочитанным"
                        />
                      )}
                    </div>
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.isRead) markAsRead.mutate(n.id)
                          setOpen(false)
                        }}
                        className="mt-2 inline-block text-sm text-primary hover:underline"
                      >
                        Перейти →
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
