"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { CartDrawer } from "@/components/cart-drawer"
import { Toaster } from "@/components/ui/toast"
import { useTenantStore } from "@/store/tenant"
import { useI18n } from "@/i18n/store"

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

  // Apply persisted locale + RTL on mount
  useEffect(() => {
    const { locale, setLocale } = useI18n.getState()
    setLocale(locale)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <CartDrawer />
      <Toaster />
    </QueryClientProvider>
  )
}
