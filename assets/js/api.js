/* Mplace API client */
(function (global) {
  function defaultApiBase() {
    // Same-origin when deployed (API serves frontend)
    if (typeof location !== 'undefined' && location.hostname && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
      return location.origin + '/api';
    }
    // Local split: UI :8080, API :3000
    return 'http://127.0.0.1:3000/api';
  }

  function getBase() {
    var stored = localStorage.getItem('mplace_api_base');
    // Ignore stale local overrides that break production (e.g. 127.0.0.1:3000)
    if (stored) {
      try {
        var u = new URL(stored, typeof location !== 'undefined' ? location.href : undefined);
        var host = (typeof location !== 'undefined' && location.hostname) || '';
        var isLocalPage = host === '127.0.0.1' || host === 'localhost';
        var isLocalApi =
          u.hostname === '127.0.0.1' ||
          u.hostname === 'localhost';
        if (!isLocalPage && isLocalApi) {
          localStorage.removeItem('mplace_api_base');
          stored = null;
        }
      } catch (e) {
        localStorage.removeItem('mplace_api_base');
        stored = null;
      }
    }
    return stored || defaultApiBase();
  }

  function getToken() {
    return sessionStorage.getItem('mplace_token') || '';
  }

  function getSessionKey() {
    let k = localStorage.getItem('mplace_session_key');
    if (!k) {
      k = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('mplace_session_key', k);
    }
    return k;
  }

  function setSession(token, user) {
    if (token) sessionStorage.setItem('mplace_token', token);
    if (user) sessionStorage.setItem('mplace_user', JSON.stringify(user));
  }

  function clearSession() {
    sessionStorage.removeItem('mplace_token');
    sessionStorage.removeItem('mplace_user');
  }

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem('mplace_user') || 'null');
    } catch {
      return null;
    }
  }

  async function request(path, options = {}) {
    const headers = Object.assign(
      { Accept: 'application/json', 'X-Session-Key': getSessionKey() },
      options.headers || {},
    );
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    // Guest order access token — header only (never query string)
    if (options.orderAccessToken) {
      headers['X-Order-Access-Token'] = options.orderAccessToken;
    }

    let res;
    try {
      const { orderAccessToken: _oat, headers: _h, body: rawBody, ...fetchOpts } =
        options;
      res = await fetch(getBase() + path, {
        ...fetchOpts,
        headers,
        body:
          rawBody && typeof rawBody !== 'string'
            ? JSON.stringify(rawBody)
            : rawBody,
      });
    } catch (e) {
      const err = new Error('API offline: ' + getBase());
      err.status = 0;
      throw err;
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      const msg =
        (data && (data.message || data.error)) ||
        res.statusText ||
        'Request failed';
      const err = new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  global.MplaceApi = {
    getBase,
    getToken,
    getUser,
    getSessionKey,
    setSession,
    clearSession,
    health: () => request('/health'),
    login: (email, password) =>
      request('/auth/login', { method: 'POST', body: { email, password } }),
    register: (body) =>
      request('/auth/register', { method: 'POST', body }),
    registerMerchant: (body) =>
      request('/auth/register/merchant', { method: 'POST', body }),
    me: () => request('/auth/me'),
    adminStats: () => request('/admin/stats'),
    adminCustomers: () => request('/admin/customers'),
    adminMerchants: () => request('/admin/merchants'),
    products: (status) =>
      request(
        '/products' + (status ? '?status=' + encodeURIComponent(status) : ''),
      ),
    product: (id) => request('/products/' + id),
    createProduct: (body) =>
      request('/products', { method: 'POST', body }),
    updateProduct: (id, body) =>
      request('/products/' + id, { method: 'PATCH', body }),
    deleteProduct: (id) =>
      request('/products/' + id, { method: 'DELETE' }),
    categories: () => request('/categories'),
    createCategory: (body) =>
      request('/categories', { method: 'POST', body }),
    shops: () => request('/shops'),
    shop: (id) => request('/shops/' + id),
    updateShopStatus: (id, status, rejectionReason) =>
      request('/shops/' + id + '/status', {
        method: 'PATCH',
        body: { status, rejectionReason },
      }),
    cart: () => request('/cart'),
    addToCart: (productId, quantity = 1) =>
      request('/cart/items', {
        method: 'POST',
        body: { productId, quantity },
      }),
    updateCartItem: (id, quantity) =>
      request('/cart/items/' + id, {
        method: 'PATCH',
        body: { quantity },
      }),
    clearCart: () => request('/cart', { method: 'DELETE' }),
    checkout: (body) =>
      request('/checkout', { method: 'POST', body: body || {} }),
    /** Create payment intent (Stripe clientSecret or dev mode). Token via body + header. */
    paymentIntent: (orderId, paymentToken, idempotencyKey) =>
      request('/orders/' + orderId + '/payment-intent', {
        method: 'POST',
        body: { paymentToken, idempotencyKey },
        orderAccessToken: paymentToken,
      }),
    orders: () => request('/orders'),
    order: (id, paymentToken) =>
      request('/orders/' + id, {
        orderAccessToken: paymentToken,
      }),
    updateOrderStatus: (id, status, reason) =>
      request('/orders/' + id + '/status', {
        method: 'PATCH',
        body: { status, reason },
      }),
    balance: () => request('/merchant/balance'),
    payouts: () => request('/payouts'),
    requestPayout: (amountCents, note) =>
      request('/payouts', {
        method: 'POST',
        body: { amountCents, note },
      }),
    decidePayout: (id, decision, adminNote) =>
      request('/payouts/' + id, {
        method: 'PATCH',
        body: { decision, adminNote },
      }),
    ledger: (shopId) =>
      request('/ledger' + (shopId ? '?shopId=' + encodeURIComponent(shopId) : '')),
    reportsSummary: () => request('/admin/reports/summary'),
    tickets: () => request('/tickets'),
    createTicket: (body) =>
      request('/tickets', { method: 'POST', body }),
    disputes: () => request('/disputes'),
    createDispute: (orderId, reason) =>
      request('/disputes', { method: 'POST', body: { orderId, reason } }),
    refunds: () => request('/refunds'),
    createRefund: (orderId, amountCents, reason) =>
      request('/refunds', {
        method: 'POST',
        body: { orderId, amountCents, reason },
      }),
    audit: () => request('/admin/audit'),
  };
})(window);
