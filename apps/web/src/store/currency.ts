"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type CurrencyCode = "RUB" | "USD" | "EUR"

/** Spec seed FX: 1 USD = 90 RUB, 1 USD = 0.92 EUR */
export const FX_PER_USD: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  RUB: 90,
}

export function convertCents(
  amountCents: number,
  from: string,
  to: string,
): number {
  const src = normalizeCurrency(from)
  const dst = normalizeCurrency(to)
  if (src === dst) return Math.round(amountCents || 0)
  const usd = (amountCents || 0) / FX_PER_USD[src]
  return Math.round(usd * FX_PER_USD[dst])
}

export function normalizeCurrency(code?: string | null): CurrencyCode {
  const c = (code || "RUB").toUpperCase()
  if (c === "USD" || c === "EUR" || c === "RUB") return c
  return "RUB"
}

interface CurrencyState {
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "RUB",
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "mplace-currency", skipHydration: true },
  ),
)
