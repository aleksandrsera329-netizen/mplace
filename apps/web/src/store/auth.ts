"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { api, type AuthUser } from "@/lib/api"

const SESSION_TOKEN = "mplace_access_token"
const SESSION_REFRESH = "mplace_refresh_token"

function syncSessionToken(token: string | null, user?: AuthUserLite | null) {
  if (typeof window === "undefined") return
  if (token) {
    sessionStorage.setItem(SESSION_TOKEN, token)
  } else {
    sessionStorage.removeItem(SESSION_TOKEN)
    sessionStorage.removeItem(SESSION_REFRESH)
  }
  // Immediate localStorage so getAccessToken() works before zustand persist flush
  try {
    const raw = localStorage.getItem("mplace-auth")
    const prev = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    prev.state = {
      ...(prev.state || {}),
      accessToken: token,
      ...(user !== undefined ? { user } : {}),
    }
    localStorage.setItem("mplace-auth", JSON.stringify(prev))
  } catch {
    /* ignore */
  }
}

export type AuthUserLite = {
  id: string
  email: string
  name?: string | null
  role?: string
  phone?: string | null
  company?: string | null
  shopId?: string | null
  shop?: AuthUser["shop"]
}

interface AuthState {
  accessToken: string | null
  user: AuthUserLite | null
  loading: boolean
  hydrated: boolean
  setAuth: (token: string, user: AuthUserLite) => void
  setUser: (user: AuthUserLite | null) => void
  logout: () => void
  isAuthenticated: () => boolean
  refresh: () => Promise<void>
  _setHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,
      hydrated: false,

      setAuth: (token, user) => {
        syncSessionToken(token, user)
        set({ accessToken: token, user, hydrated: true })
      },

      setUser: (user) => set({ user }),

      logout: () => {
        syncSessionToken(null, null)
        set({ accessToken: null, user: null, hydrated: true })
      },

      isAuthenticated: () => !!get().accessToken,

      refresh: async () => {
        const token = get().accessToken
        if (!token) {
          syncSessionToken(null, null)
          set({ user: null, loading: false, hydrated: true })
          return
        }
        syncSessionToken(token)
        set({ loading: true })
        try {
          const user = await api.me()
          syncSessionToken(token, user)
          set({ user, loading: false, hydrated: true })
        } catch {
          syncSessionToken(null, null)
          set({ accessToken: null, user: null, loading: false, hydrated: true })
        }
      },

      _setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "mplace-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          syncSessionToken(state.accessToken)
        }
        useAuthStore.setState({ hydrated: true })
      },
    },
  ),
)
