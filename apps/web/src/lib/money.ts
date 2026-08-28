"use client"

import { useI18n } from "@/i18n/store"
import {
  convertCents,
  normalizeCurrency,
  useCurrencyStore,
  type CurrencyCode,
} from "@/store/currency"

const LOCALE_TAG: Record<string, string> = {
  ru: "ru-RU",
  en: "en-US",
  ar: "ar-AE",
}

export function formatConvertedMoney(
  amountCents: number,
  fromCurrency: string | undefined,
  displayCurrency: CurrencyCode,
  locale = "ru",
) {
  const converted = convertCents(
    amountCents || 0,
    fromCurrency || "RUB",
    displayCurrency,
  )
  const digits = displayCurrency === "RUB" ? 0 : 2
  return new Intl.NumberFormat(LOCALE_TAG[locale] || "ru-RU", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(converted / 100)
}

/** Live conversion into the header display currency. */
export function useMoney() {
  const display = useCurrencyStore((s) => s.currency)
  const locale = useI18n((s) => s.locale)
  return {
    currency: display,
    format: (amountCents: number, fromCurrency?: string | null) =>
      formatConvertedMoney(
        amountCents,
        fromCurrency || "RUB",
        display,
        locale,
      ),
    convert: (amountCents: number, fromCurrency?: string | null) =>
      convertCents(amountCents || 0, fromCurrency || "RUB", display),
    normalize: normalizeCurrency,
  }
}
