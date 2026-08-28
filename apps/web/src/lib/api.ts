/** Same-origin `/api` on Render. Local Next still talks to Nest on :3001. */
function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host !== "localhost" && host !== "127.0.0.1") return "/api"
    return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api"
  }
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env && env.startsWith("http")) return env
  return process.env.INTERNAL_API_URL || "http://127.0.0.1:3001/api"
}

const SESSION_KEY_STORAGE = "mplace_session_key"
const TOKEN_KEY = "mplace_access_token"
const REFRESH_KEY = "mplace_refresh_token"

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
    slug?: string | null
    sku?: string | null
    priceCents: number
    currency?: string | null
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

function authHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {}
  if (json) headers["Content-Type"] = "application/json"
  if (typeof window !== "undefined") {
    const sk = getSessionKey()
    if (sk) headers["X-Session-Key"] = sk
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const tenantId = process.env.NEXT_PUBLIC_TENANT_ID
    if (tenantId) headers["X-Tenant-Id"] = tenantId
  }
  return headers
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as {
      message?: string | string[]
    }
    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message
    throw new Error(message || `API error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase()
  const headers: Record<string, string> = {
    ...authHeaders(method !== "GET" && method !== "HEAD"),
    ...(options.headers as Record<string, string> | undefined),
  }
  if (method === "GET" || method === "HEAD") delete headers["Content-Type"]

  const res = await fetch(`${resolveApiBase()}${path}`, {
    ...options,
    headers,
    credentials: "include",
  })
  return parseResponse<T>(res)
}

/** Multipart — do not set Content-Type (browser sets boundary) */
async function requestFormData<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" | "PUT" = "PATCH",
): Promise<T> {
  const headers = authHeaders(false)
  const res = await fetch(`${resolveApiBase()}${path}`, {
    method,
    headers,
    body: formData,
    credentials: "include",
  })
  return parseResponse<T>(res)
}

export type TenantBranding = {
  id: string
  name: string
  slug: string
  domain?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
}

export type Warehouse = {
  id: string
  name: string
  code?: string | null
  city?: string | null
  address?: string | null
  country?: string | null
  isDefault?: boolean
  isActive?: boolean
}

export type ProductStockRow = {
  id: string
  productId: string
  warehouseId: string
  quantity: number
  reserved?: number
  warehouse?: Warehouse
}

export const api = {
  products: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{ items: unknown[]; nextCursor?: string; hasMore?: boolean }>(
      `/products${q}`,
    )
  },
  getProductStocks: (productId: string) =>
    request<ProductStockRow[]>(`/products/${productId}/stocks`),
  categories: () => request<unknown[]>("/categories"),
  shops: () => request<unknown[]>("/shops"),

  notifications: {
    list: (unreadOnly?: boolean) =>
      request<
        {
          id: string
          type: string
          title: string
          message: string
          link?: string | null
          isRead: boolean
          createdAt: string
          data?: unknown
        }[]
      >(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),
    unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
    markAsRead: (id: string) =>
      request<{ ok: boolean }>(`/notifications/${id}/read`, {
        method: "POST",
      }),
    markAllAsRead: () =>
      request<{ ok: boolean }>("/notifications/read-all", {
        method: "POST",
      }),
  },

  tax: {
    listRates: () =>
      request<
        {
          id: string
          name: string
          code?: string | null
          rate: string | number
          country: string
          isDefault: boolean
        }[]
      >("/tax/rates"),
    createRate: (data: {
      name: string
      code?: string
      rate: number
      country: string
      isDefault?: boolean
    }) =>
      request("/tax/rates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    calculate: (data: {
      items: Array<{
        productId: string
        quantity: number
        priceCents: number
      }>
      country?: string
    }) =>
      request<{
        items: Array<{
          productId: string
          subtotalCents: number
          taxCents: number
          taxRate: number
          taxName?: string | null
        }>
        subtotalCents: number
        taxCents: number
        totalCents: number
      }>("/tax/calculate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  shipping: {
    listMethods: () =>
      request<
        {
          id: string
          name: string
          code?: string | null
          description?: string | null
          isActive?: boolean
          rates?: unknown[]
        }[]
      >("/shipping/methods"),
    createMethod: (data: {
      name: string
      code?: string
      description?: string
    }) =>
      request("/shipping/methods", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listZones: () =>
      request<
        {
          id: string
          name: string
          countries: string[]
          regions: string[]
        }[]
      >("/shipping/zones"),
    createZone: (data: {
      name: string
      countries: string[]
      regions?: string[]
    }) =>
      request("/shipping/zones", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createRate: (data: {
      shippingMethodId: string
      shippingZoneId: string
      warehouseId?: string
      minWeightKg?: number
      maxWeightKg?: number
      priceCents: number
      pricePerKgCents?: number
      estimatedDaysMin?: number
      estimatedDaysMax?: number
    }) =>
      request("/shipping/rates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    calculate: (data: {
      country: string
      region?: string
      weightKg: number
      warehouseId?: string
      merchantId?: string
    }) =>
      request<
        {
          id: string
          methodId?: string
          methodName: string
          methodCode?: string | null
          zoneName: string
          warehouseName?: string | null
          priceCents: number
          estimatedDaysMin?: number | null
          estimatedDaysMax?: number | null
        }[]
      >("/shipping/calculate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  warehouses: {
    list: () => request<Warehouse[]>("/warehouses"),
    create: (data: {
      name: string
      code?: string
      city?: string
      address?: string
      country?: string
      isDefault?: boolean
    }) =>
      request<Warehouse>("/warehouses", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: Partial<{
        name: string
        code: string
        city: string
        address: string
        country: string
        isDefault: boolean
        isActive: boolean
      }>,
    ) =>
      request<Warehouse>(`/warehouses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateStock: (data: {
      productId: string
      warehouseId: string
      quantity: number
    }) =>
      request<ProductStockRow>("/warehouses/stock", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  tenant: {
    current: () => request<TenantBranding | null>("/tenants/current"),
    me: () => request<TenantBranding | null>("/tenants/me"),
    bySlug: (slug: string) =>
      request<TenantBranding | null>(
        `/tenants/by-slug/${encodeURIComponent(slug)}`,
      ),
    updateBranding: (formData: FormData) =>
      requestFormData<TenantBranding>("/tenants/current/branding", formData, "PATCH"),
    updateBrandingById: (tenantId: string, formData: FormData) =>
      requestFormData<TenantBranding>(
        `/admin/tenants/${tenantId}/branding`,
        formData,
        "PATCH",
      ),
    createInvite: (data: { email: string; role: string }) =>
      request<{
        id: string
        email: string
        role: string
        token: string
        expiresAt: string
      }>("/tenants/invites", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listInvites: () =>
      request<
        {
          id: string
          email: string
          role: string
          expiresAt: string
          acceptedAt: string | null
          createdAt: string
          token: string
        }[]
      >("/tenants/invites"),
    acceptInvite: (data: {
      token: string
      password: string
      firstName?: string
      lastName?: string
    }) =>
      request<{ user: { id: string; email: string }; tenant: { name: string } }>(
        "/tenants/invites/accept",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    previewInvite: (token: string) =>
      request<{
        valid: boolean
        email?: string
        role?: string
        tenantName?: string
        tenantLogo?: string | null
      }>(`/tenants/invites/preview/${encodeURIComponent(token)}`),
  },
  /** Alias used by branding page samples */
  tenants: {
    current: () => request<TenantBranding | null>("/tenants/me"),
    updateBranding: (formData: FormData) =>
      requestFormData<TenantBranding>("/tenants/current/branding", formData, "PATCH"),
    acceptInvite: (data: {
      token: string
      password: string
      firstName?: string
      lastName?: string
    }) =>
      request("/tenants/invites/accept", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createInvite: (data: { email: string; role: string }) =>
      request("/tenants/invites", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listInvites: () => request("/tenants/invites"),
  },
  product: (id: string) =>
    request<{
      id: string
      name: string
      slug?: string | null
      description?: string | null
      sku?: string | null
      priceCents: number
      currency?: string | null
      stock: number
      /** Available = quantity - reserved (when multi-warehouse stocks exist) */
      availableStock?: number
      imageUrl?: string | null
      category?: { id?: string; name: string; slug?: string }
      shop?: { id?: string; name: string }
      stocks?: Array<{
        warehouseId: string
        quantity: number
        reserved: number
        warehouse?: { id: string; name: string; code?: string | null }
      }>
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
    taxCountry?: string
    shipping?: {
      rateId: string
      methodId?: string
      priceCents: number
      daysMin?: number
      daysMax?: number
    }
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
        shippingPriceCents?: number
      }>
      message?: string
    }>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (email: string, password: string, totpCode?: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(totpCode ? { totpCode } : {}),
      }),
    }),

  /** Stage 6/20: complete MFA with tempToken from login */
  mfaVerify: (tempToken: string, code: string) =>
    request<LoginResponse>("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ tempToken, code }),
    }),

  mfaSetup: (tempToken: string) =>
    request<{
      secret?: string
      otpauthUrl?: string
      qrCodeDataUrl?: string
      message?: string
    }>("/auth/mfa/setup", {
      method: "POST",
      body: JSON.stringify({ tempToken }),
    }),

  mfaEnable: (tempToken: string, code: string) =>
    request<{ ok?: boolean; message?: string }>("/auth/mfa/enable", {
      method: "POST",
      body: JSON.stringify({ tempToken, code }),
    }),

  registerCustomer: (body: {
    email?: string
    phone?: string
    password: string
    name: string
  }) =>
    request<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  registerMerchant: (body: {
    email: string
    phone?: string
    password: string
    name: string
    shopName: string
    shopSlug?: string
  }) =>
    request<LoginResponse>("/auth/register/merchant", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<AuthUser>("/auth/me"),

  updateMe: (body: { name?: string; phone?: string; company?: string }) =>
    request<AuthUser>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  orders: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: OrderSummary[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/orders${q}`)
  },

  /** Stage 14: Buyer cabinet */
  buyerDashboard: () =>
    request<{
      stats: {
        activeOrders: number
        pendingRfqs: number
        wishlistCount: number
        rfqsWithOffers: number
        unreadNotifications: number
      }
      recentOrders: OrderSummary[]
      recentRfqs: Array<{
        id: string
        number: string
        title: string
        status: string
        createdAt: string
        deadline?: string | null
        _count?: { offers: number }
      }>
    }>("/buyer/dashboard"),

  buyerOrders: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<{
      items: OrderSummary[]
      filter: string
      total: number
    }>(`/buyer/orders${q}`)
  },

  buyerRfqs: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<{
      items: RfqSummary[]
      filter: string
      total: number
    }>(`/buyer/rfqs${q}`)
  },

  /** Stage 15: Merchant cabinet */
  merchantDashboard: () =>
    request<{
      shop: {
        id: string
        name: string
        slug: string
        status: string
        verified: boolean
      } | null
      stats: {
        gmvCents: number
        revenueCents: number
        commissionCents: number
        ordersCount: number
        pendingOrders: number
        completedOrders: number
        productsCount: number
        activeProducts: number
        availableBalanceCents: number
        pendingPayoutsCents: number
        openOffers: number
        awardedOffers: number
        kycPending: number
        kycApproved: number
        conversionRate: number
      }
      recentOrders: OrderSummary[]
      recentOffers: Array<{
        id: string
        status: string
        totalCents: number
        currency?: string
        createdAt: string
        rfq: {
          id: string
          number: string
          title: string
          status: string
          deadline?: string | null
        }
      }>
    }>("/merchant/dashboard"),

  merchantOrders: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<{
      items: OrderSummary[]
      filter: string
      total: number
      shopId: string
    }>(`/merchant/orders${q}`)
  },

  merchantRfqs: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<{
      items: Array<
        RfqSummary & {
          myOffer?: {
            id: string
            status: string
            totalCents: number
            currency?: string
          } | null
          matchScore?: number
        }
      >
      filter: string
      total: number
    }>(`/merchant/rfqs${q}`)
  },

  merchantKyc: () =>
    request<{
      shop: {
        id: string
        name: string
        status: string
        verified: boolean
        kycNotes?: string | null
        rejectionReason?: string | null
      }
      documents: Array<{
        id: string
        docType: string
        fileName: string
        status: string
        createdAt: string
        downloadPath?: string
      }>
      summary: {
        pending: number
        approved: number
        rejected: number
        verified: boolean
        shopStatus: string
      }
    }>("/merchant/kyc"),

  order: (id: string) => request<OrderDetail>(`/orders/${id}`),

  paymentIntent: (orderId: string, paymentToken?: string) =>
    request<{
      clientSecret?: string
      paymentIntentId?: string
      amountCents?: number
      currency?: string
      devMode?: boolean
      mode?: string
      message?: string
    }>(`/orders/${orderId}/payment-intent`, {
      method: "POST",
      body: JSON.stringify(paymentToken ? { paymentToken } : {}),
    }),

  paymentsConfig: () =>
    request<{
      provider?: string
      dev?: boolean
      publishableKey?: string | null
    }>("/payments/config"),

  /** Spec: POST /orders/:id/pay-dev — local DEV payment, same ledger as webhook */
  payDev: (orderId: string, paymentToken?: string) =>
    request<{ id?: string; status?: string; orderNumber?: string }>(
      `/orders/${orderId}/pay-dev`,
      {
        method: "POST",
        body: JSON.stringify(paymentToken ? { paymentToken } : {}),
      },
    ),

  devConfirmPayment: (orderId: string, paymentToken?: string) =>
    request<{ ok?: boolean; status?: string }>("/payments/dev-confirm", {
      method: "POST",
      body: JSON.stringify({ orderId, paymentToken }),
    }),

  wishlist: () => request<WishlistItem[]>("/wishlist"),

  addToWishlist: (productId: string) =>
    request<WishlistItem>("/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),

  removeFromWishlist: (productId: string) =>
    request<{ ok: boolean }>(`/wishlist/${productId}`, {
      method: "DELETE",
    }),

  rfqs: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: RfqSummary[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/rfq${q}`)
  },

  rfq: (id: string) => request<RfqDetail>(`/rfq/${id}`),

  createRfq: (body: {
    title: string
    description?: string
    deadline?: string
    items: Array<{
      name: string
      quantity: number
      unit?: string
      specs?: string
    }>
  }) =>
    request<RfqDetail>("/rfq", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  awardRfqOffer: (rfqId: string, offerId: string) =>
    request<RfqDetail>(`/rfq/${rfqId}/award/${offerId}`, {
      method: "POST",
    }),

  postRfqMessage: (rfqId: string, body: string) =>
    request<unknown>(`/rfq/${rfqId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  createRfqOffer: (
    rfqId: string,
    body: {
      message?: string
      validUntil?: string
      items: Array<{
        rfqItemId: string
        unitPriceCents: number
        quantity: number
        note?: string
      }>
    },
  ) =>
    request<unknown>(`/rfq/${rfqId}/offers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Merchant
  merchantBalance: () =>
    request<{
      availableCents: number
      pendingCents?: number
      currency?: string
      shopId?: string
    }>("/merchant/balance"),

  payouts: () =>
    request<
      Array<{
        id: string
        amountCents: number
        status: string
        note?: string | null
        createdAt: string
        shop?: { id: string; name: string }
      }>
    >("/payouts"),

  requestPayout: (amountCents: number, note?: string) =>
    request<unknown>("/payouts", {
      method: "POST",
      body: JSON.stringify({ amountCents, note }),
    }),

  connectStatus: () =>
    request<{
      connected?: boolean
      chargesEnabled?: boolean
      payoutsEnabled?: boolean
      detailsSubmitted?: boolean
      accountId?: string | null
      status?: string
    }>("/connect/status"),

  connectOnboard: () =>
    request<{ url?: string }>("/connect/onboard", { method: "POST" }),

  createProduct: (body: Record<string, unknown>) =>
    request<ProductRow>("/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateProduct: (id: string, body: Record<string, unknown>) =>
    request<ProductRow>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteProduct: (id: string) =>
    request<unknown>(`/products/${id}`, { method: "DELETE" }),

  updateOrderStatus: (id: string, status: string, reason?: string) =>
    request<OrderDetail>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),

  // Admin
  adminDashboard: () =>
    request<{
      customers: number
      merchants: number
      products: number
      orders: number
      pendingShops: number
      openDisputes: number
      gmvCents: number
      today: { orders: number; gmvCents: number }
    }>("/admin/dashboard"),

  adminUsers: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: AdminUser[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/admin/users${q}`)
  },

  adminUpdateUserStatus: (id: string, status: string) =>
    request<AdminUser>(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminUpdateUserRole: (id: string, role: string) =>
    request<AdminUser>(`/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  adminShops: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: AdminShop[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/admin/shops${q}`)
  },

  adminUpdateShopStatus: (id: string, status: string) =>
    request<AdminShop>(`/admin/shops/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminOrders: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: OrderSummary[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/admin/orders${q}`)
  },

  adminDisputes: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: AdminDispute[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/admin/disputes${q}`)
  },

  adminResolveDispute: (id: string, resolution: string, note?: string) =>
    request<AdminDispute>(`/admin/disputes/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolution, note }),
    }),

  adminPayouts: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: AdminPayout[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/admin/payouts${q}`)
  },

  adminProcessPayout: (id: string, status: string, adminNote?: string) =>
    request<AdminPayout>(`/admin/payouts/${id}/process`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminNote }),
    }),

  adminAudit: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{
      items: AdminAudit[]
      nextCursor?: string | null
      hasMore?: boolean
    }>(`/admin/audit${q}`)
  },

  createCategory: (body: { name: string; slug?: string }) =>
    request<{ id: string; name: string }>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  kycPending: () =>
    request<
      Array<{
        id: string
        fileName?: string
        docType?: string
        status?: string
        createdAt?: string
        shop?: { id: string; name: string }
      }>
    >("/kyc/pending"),

  reviewKyc: (id: string, status: "APPROVED" | "REJECTED", notes?: string) =>
    request<unknown>(`/kyc/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),

  /** multipart upload — do not set JSON Content-Type */
  uploadProductImage: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append("file", file)
    const headers: Record<string, string> = {}
    if (typeof window !== "undefined") {
      const token = getAccessToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`${resolveApiBase()}/products/upload-image`, {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(err.message || `Upload failed ${res.status}`)
    }
    return res.json() as Promise<{ url: string }>
  },
}

export type ProductRow = {
  id: string
  name: string
  slug?: string | null
  priceCents: number
  currency?: string | null
  stock: number
  status?: string
  sku?: string | null
  imageUrl?: string | null
  categoryId?: string | null
  shopId?: string
  category?: { id?: string; name: string; slug?: string }
  shop?: { id?: string; name: string }
}

export type AuthUser = {
  id: string
  email: string
  name?: string | null
  phone?: string | null
  company?: string | null
  role: string
  shopId?: string | null
  status?: string
  shop?: { id: string; name: string; slug?: string; status?: string } | null
}

/** Login / register / MFA verify response (Stage 6 + 20) */
export type LoginResponse = {
  accessToken?: string
  refreshToken?: string
  user?: AuthUser
  mfaRequired?: boolean
  mfaEnrollmentRequired?: boolean
  requires2fa?: boolean
  tempToken?: string
  partialToken?: string
  message?: string
}

export type OrderItemRow = {
  id: string
  productId?: string | null
  productName?: string
  name?: string
  quantity: number
  unitPriceCents: number
  lineTotalCents?: number
  totalCents?: number
}

export type OrderSummary = {
  id: string
  orderNumber: string
  status: string
  totalCents: number
  currency?: string
  createdAt: string
  shop?: { id: string; name: string } | null
  items?: OrderItemRow[]
}

export type OrderDetail = Omit<OrderSummary, "items"> & {
  customerName?: string | null
  customerEmail?: string | null
  comment?: string | null
  paymentToken?: string | null
  subtotalCents?: number
  taxCents?: number
  shippingPriceCents?: number | null
  shippingDaysMin?: number | null
  shippingDaysMax?: number | null
  shippingRateId?: string | null
  shippingMethod?: {
    id: string
    name: string
    code?: string | null
    description?: string | null
  } | null
  items: OrderItemRow[]
  statusHistory?: Array<{
    id: string
    status?: string
    toStatus?: string
    fromStatus?: string | null
    reason?: string | null
    createdAt: string
  }>
  payments?: Array<{
    id: string
    status: string
    amountCents: number
    provider?: string
  }>
}

export type WishlistItem = {
  id: string
  productId: string
  createdAt?: string
  product: {
    id: string
    name: string
    priceCents: number
    stock: number
    imageUrl?: string | null
    shop?: { id: string; name: string } | null
    category?: { id: string; name: string } | null
  }
}

export type RfqSummary = {
  id: string
  number: string
  title: string
  status: string
  deadline?: string | null
  createdAt: string
  itemsCount?: number
  _count?: { offers?: number; matches?: number; messages?: number }
}

export type RfqDetail = RfqSummary & {
  description?: string | null
  items: Array<{
    id: string
    name: string
    quantity: number
    unit?: string | null
    specs?: string | null
  }>
  offers?: Array<{
    id: string
    shopId: string
    status?: string
    message?: string | null
    totalCents?: number
    shop?: { id: string; name: string }
    items?: Array<{
      id: string
      rfqItemId: string
      unitPriceCents: number
      quantity: number
    }>
  }>
  messages?: Array<{
    id: string
    body: string
    createdAt: string
    author?: { id: string; name?: string | null; role?: string }
  }>
}

export type AdminUser = {
  id: string
  email: string
  name?: string | null
  role: string
  status: string
  createdAt?: string
  shop?: { id: string; name: string; status?: string } | null
  _count?: { orders?: number }
}

export type AdminShop = {
  id: string
  name: string
  slug?: string
  status: string
  verified?: boolean
  createdAt?: string
  owner?: { id: string; email: string; name?: string | null } | null
  _count?: { products?: number; orders?: number }
}

export type AdminDispute = {
  id: string
  status: string
  reason?: string | null
  resolution?: string | null
  createdAt: string
  order?: { id: string; orderNumber: string } | null
  orderId?: string
}

export type AdminPayout = {
  id: string
  amountCents: number
  status: string
  note?: string | null
  adminNote?: string | null
  createdAt: string
  shop?: { id: string; name: string } | null
}

export type AdminAudit = {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  createdAt: string
  actorId?: string | null
  meta?: string | null
  actor?: { id: string; email?: string; name?: string | null } | null
}

/** Read JWT: zustand persist `mplace-auth` first, then sessionStorage fallback */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("mplace-auth")
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { accessToken?: string | null }
      }
      if (parsed?.state?.accessToken) return parsed.state.accessToken
    }
  } catch {
    /* ignore */
  }
  return sessionStorage.getItem(TOKEN_KEY)
}

export function saveAuthTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken)
  // Keep zustand persist in sync (login also calls setAuth)
  try {
    const raw = localStorage.getItem("mplace-auth")
    const prev = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    prev.state = { ...(prev.state || {}), accessToken }
    localStorage.setItem("mplace-auth", JSON.stringify(prev))
  } catch {
    /* ignore */
  }
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  try {
    const raw = localStorage.getItem("mplace-auth")
    if (raw) {
      const prev = JSON.parse(raw)
      prev.state = { ...(prev.state || {}), accessToken: null, user: null }
      localStorage.setItem("mplace-auth", JSON.stringify(prev))
    }
  } catch {
    /* ignore */
  }
}

export { resolveApiBase }
