// Docker compose maps API to host :3001; local nest default is :3000
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api"

const SESSION_KEY_STORAGE = "mplace_session_key"

/** Guest cart identity for Nest (X-Session-Key). */
export function getSessionKey(): string {
  if (typeof window === "undefined") return ""
  let key = localStorage.getItem(SESSION_KEY_STORAGE)
  if (!key) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(SESSION_KEY_STORAGE, key)
  }
  return key
}

export type CartItem = {
  id: string
  quantity: number
  productId?: string
  product?: {
    id: string
    name: string
    priceCents: number
    imageUrl?: string | null
    stock?: number
  }
  priceCents?: number
}

export type CartResponse = {
  id?: string
  items?: CartItem[]
  itemCount?: number
  subtotalCents?: number
  subtotal?: string
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  }

  // Guest carts require X-Session-Key (see OrdersService.getOrCreateCart)
  if (typeof window !== "undefined") {
    const sk = getSessionKey()
    if (sk) headers["X-Session-Key"] = sk
    const token = sessionStorage.getItem("mplace_access_token")
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  })

  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as {
      message?: string | string[]
    }
    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message
    throw new Error(message || `API error ${res.status}`)
  }

  // DELETE may return empty body
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export const api = {
  products: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{ items: unknown[]; nextCursor?: string; hasMore?: boolean }>(
      `/products${q}`,
    )
  },
  categories: () => request<unknown[]>("/categories"),
  shops: () => request<unknown[]>("/shops"),
  product: (id: string) =>
    request<{
      id: string
      name: string
      description?: string | null
      sku?: string | null
      priceCents: number
      stock: number
      imageUrl?: string | null
      category?: { id?: string; name: string }
      shop?: { id?: string; name: string }
    }>(`/products/${id}`),

  // Cart / order draft
  cart: () => request<CartResponse>("/cart"),
  addToCart: (productId: string, quantity = 1) =>
    request<CartResponse>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  updateCartItem: (itemId: string, quantity: number) =>
    request<CartResponse>(`/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  // Backend has no DELETE /cart/items/:id — quantity 0 removes the line
  removeFromCart: (itemId: string) =>
    request<CartResponse>(`/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: 0 }),
    }),
  clearCart: () =>
    request<CartResponse>("/cart", {
      method: "DELETE",
    }),

  /** POST /api/checkout — creates order(s) from guest/user cart (X-Session-Key) */
  checkout: (body: {
    customerName?: string
    customerEmail?: string
    comment?: string
  }) =>
    request<{
      orders: Array<{
        id: string
        orderNumber: string
        totalCents: number
        currency: string
        status: string
        shop: { id: string; name: string } | null
        paymentToken?: string
      }>
      message?: string
    }>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (email: string, password: string) =>
    request<{
      accessToken: string
      refreshToken?: string
      user?: { id: string; email: string; role: string; name?: string }
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
}

const TOKEN_KEY = "mplace_access_token"
const REFRESH_KEY = "mplace_refresh_token"

export function saveAuthTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken)
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}

export { API_BASE }
