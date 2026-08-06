import { create } from "zustand"
import { api, type CartItem } from "@/lib/api"

interface CartState {
  items: CartItem[]
  itemCount: number
  subtotalCents: number
  isOpen: boolean
  isLoading: boolean
  open: () => void
  close: () => void
  toggle: () => void
  refresh: () => Promise<void>
  addItem: (productId: string, quantity?: number) => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  isOpen: false,
  isLoading: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  refresh: async () => {
    try {
      set({ isLoading: true })
      const cart = await api.cart()
      set({
        items: cart.items || [],
        itemCount: cart.itemCount || cart.items?.length || 0,
        subtotalCents: cart.subtotalCents || 0,
      })
    } catch (e) {
      console.warn("Cart refresh error", e)
      set({ items: [], itemCount: 0, subtotalCents: 0 })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (productId: string, quantity = 1) => {
    try {
      await api.addToCart(productId, quantity)
      await get().refresh()
      get().open()
    } catch (e) {
      console.error("Add to cart error", e)
      const msg = e instanceof Error ? e.message : "Не удалось добавить в корзину"
      alert(msg)
    }
  },
}))
