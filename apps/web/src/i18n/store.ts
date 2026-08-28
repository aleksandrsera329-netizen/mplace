"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ru } from "./dictionaries/ru"
import { en } from "./dictionaries/en"
import { ar } from "./dictionaries/ar"

export type Locale = "ru" | "en" | "ar"
export type TranslationKey = keyof typeof ru
export type Dictionary = Record<TranslationKey, string>

const dictionaries: Record<Locale, Dictionary> = {
  ru: ru as Dictionary,
  en: en as Dictionary,
  ar: ar as Dictionary,
}

function table(locale: Locale): Record<string, string> {
  if (locale === "en") return en as Record<string, string>
  if (locale === "ar") return ar as Record<string, string>
  return ru as Record<string, string>
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const fromLocale = table(locale)[key]
  const fromEn = (en as Record<string, string>)[key]
  let text =
    fromLocale ||
    (locale === "ru" ? fromEn : undefined) ||
    (locale === "ar" ? fromEn : undefined) ||
    key
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replaceAll(`{${k}}`, String(v))
    })
  }
  return text
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return
  const dir = locale === "ar" ? "rtl" : "ltr"
  document.documentElement.lang = locale
  document.documentElement.dir = dir
}

interface I18nState {
  locale: Locale
  dir: "ltr" | "rtl"
  setLocale: (locale: Locale) => void
  t: (
    key: TranslationKey | string,
    params?: Record<string, string | number>,
  ) => string
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: "ru",
      dir: "ltr",
      setLocale: (locale) => {
        const dir = locale === "ar" ? "rtl" : "ltr"
        applyDocumentLocale(locale)
        set({ locale, dir })
      },
      t: (key, params) => translate(get().locale, key, params),
    }),
    {
      name: "mplace-locale",
      partialize: (s) => ({ locale: s.locale, dir: s.dir }),
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          applyDocumentLocale(state.locale)
          state.dir = state.locale === "ar" ? "rtl" : "ltr"
        }
      },
    },
  ),
)
