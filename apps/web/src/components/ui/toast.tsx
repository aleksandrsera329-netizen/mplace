"use client"

import { create } from "zustand"
import { cn } from "@/lib/utils"

interface Toast {
  id: string
  title: string
  description?: string
  type?: "default" | "success" | "error"
}

interface ToastState {
  toasts: Toast[]
  add: (toast: Omit<Toast, "id">) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },
  remove: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function toast(props: Omit<Toast, "id">) {
  useToastStore.getState().add(props)
}

export function Toaster() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="pointer-events-none fixed bottom-4 start-4 z-[100] flex max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto min-w-[240px] cursor-pointer rounded-lg border bg-card px-4 py-3 shadow-xl",
            t.type === "success" && "border-success text-foreground",
            t.type === "error" && "border-danger text-foreground",
          )}
          onClick={() => remove(t.id)}
        >
          <div className="text-sm font-medium">{t.title}</div>
          {t.description && (
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t.description}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
