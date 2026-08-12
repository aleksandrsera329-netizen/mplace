"use client"

import { Header } from "@/components/header"
import { MerchantNav } from "@/components/merchant-nav"
import { RequireRole } from "@/components/require-role"

export function MerchantShell({
  title,
  children,
  actions,
}: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <RequireRole roles={["MERCHANT", "ADMIN", "SUPER_ADMIN"]}>
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {actions}
          </div>
          <div className="flex flex-col gap-8 lg:flex-row">
            <MerchantNav />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </div>
      </div>
    </RequireRole>
  )
}
