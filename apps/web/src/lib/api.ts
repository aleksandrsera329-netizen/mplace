// Docker compose maps API to host :3001; local nest default is :3000
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
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

  return res.json() as Promise<T>
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
  product: (id: string) => request<unknown>(`/products/${id}`),
  cart: () => request<unknown>("/cart"),
  // later: auth, wishlist, etc.
}

export { API_BASE }
