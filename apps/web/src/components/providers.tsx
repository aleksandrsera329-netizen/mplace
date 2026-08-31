"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { CartDrawer } from "@/components/cart-drawer"
import { Toaster } from "@/components/ui/toast"
import { useTenantStore } from "@/store/tenant"
import { applyDocumentLocale, useI18n } from "@/i18n/store"
import { useCurrencyStore } from "@/store/currency"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  )
  const loadTenant = useTenantStore((s) => s.load)

  useEffect(() => {
    void loadTenant()
  }, [loadTenant])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.all([
        useI18n.persist.rehydrate(),
        useCurrencyStore.persist.rehydrate(),
      ])
      if (cancelled) return
      applyDocumentLocale(useI18n.getState().locale)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <CartDrawer />
      <Toaster />
    </QueryClientProvider>
  )
}
