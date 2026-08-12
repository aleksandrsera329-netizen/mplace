"use client"

import { create } from "zustand"
import { api, type TenantBranding } from "@/lib/api"

interface TenantState {
  tenant: TenantBranding | null
  /** alias for branding pages */
  branding: TenantBranding | null
  isLoading: boolean
  load: () => Promise<void>
  setBranding: (data: TenantBranding | null) => void
}

function applyBranding(data: TenantBranding | null) {
  if (typeof document === "undefined" || !data) return

  if (data.primaryColor) {
    document.documentElement.style.setProperty(
      "--color-primary",
      data.primaryColor,
    )
  }
  if (data.secondaryColor) {
    document.documentElement.style.setProperty(
      "--color-secondary",
      data.secondaryColor,
    )
  }
  if (data.accentColor) {
    document.documentElement.style.setProperty(
      "--color-accent",
      data.accentColor,
    )
  }

  if (data.faviconUrl) {
    let link = document.querySelector(
      "link[rel*='icon']",
    ) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = data.faviconUrl
  }

  if (data.name) {
    document.title = data.name
  }
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  branding: null,
  isLoading: true,

  setBranding: (data) => {
    set({ tenant: data, branding: data })
    applyBranding(data)
  },

  load: async () => {
    try {
      set({ isLoading: true })

      const slug =
        typeof process !== "undefined"
          ? process.env.NEXT_PUBLIC_TENANT_SLUG
          : undefined

      let data: TenantBranding | null = null
      if (slug) {
        data = await api.tenant.bySlug(slug)
      } else {
        // Prefer authenticated tenant; fall back to header/subdomain
        try {
          data = await api.tenant.me()
        } catch {
          data = null
        }
        if (!data) {
          data = await api.tenant.current()
        }
      }

      set({ tenant: data, branding: data, isLoading: false })
      applyBranding(data)
    } catch (e) {
      console.warn("Tenant branding not loaded", e)
      set({ tenant: null, branding: null, isLoading: false })
    }
  },
}))
