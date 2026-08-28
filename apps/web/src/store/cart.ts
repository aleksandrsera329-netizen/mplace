import { create } from "zustand"
import { api, type CartItem } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { translate, useI18n } from "@/i18n/store"

function t(key: string) {
  return translate(useI18n.getState().locale, key)
}

function cartErrorMessage(e: unknown) {
  const raw = e instanceof Error ? e.message : ""
  if (/insufficient stock/i.test(raw)) return t("cart.insufficientStock")
  return raw || t("product.addError")
}

function lineForProduct(items: CartItem[], productId: string) {
  return items.find(
    (i) => i.productId === productId || i.product?.id === productId,
  )
}

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
  addItem: (
    productId: string,
    quantity?: number,
    maxStock?: number,
  ) => Promise<void>
  updateQty: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clear: () => Promise<void>
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

  addItem: async (productId, quantity = 1, maxStock) => {
    const existing = lineForProduct(get().items, productId)
    const have = existing?.quantity ?? 0
    const cap = maxStock ?? existing?.product?.stock
    if (typeof cap === "number" && have + quantity > cap) {
      get().open()
      toast({
        title: t("common.error"),
        description: t("cart.maxInRequest"),
        type: "error",
      })
      return
    }
    try {
      await api.addToCart(productId, quantity)
      await get().refresh()
      get().open()
    } catch (e) {
      console.error("Add to cart error", e)
      toast({
        title: t("common.error"),
        description: cartErrorMessage(e),
        type: "error",
      })
    }
  },

  updateQty: async (itemId, quantity) => {
    try {
      await api.updateCartItem(itemId, quantity <= 0 ? 0 : quantity)
      await get().refresh()
    } catch (e) {
      toast({
        title: t("common.error"),
        description: cartErrorMessage(e),
        type: "error",
      })
    }
  },

  removeItem: async (itemId) => {
    try {
      await api.removeFromCart(itemId)
      await get().refresh()
    } catch (e) {
      toast({
        title: t("common.error"),
        description: cartErrorMessage(e),
        type: "error",
      })
    }
  },

  clear: async () => {
    try {
      await api.clearCart()
    } catch {
      /* cart may already be empty after checkout */
    }
    set({ items: [], itemCount: 0, subtotalCents: 0 })
  },
}))
