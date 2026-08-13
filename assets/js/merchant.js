/* Mplace Merchant SPA */
(function () {
  const user = JSON.parse(sessionStorage.getItem('mplace_user') || 'null');
  const role = String(user?.role || '').toUpperCase();
  if (!user || role !== 'MERCHANT' || !sessionStorage.getItem('mplace_token')) {
    location.href = '../login.html?next=/merchant.html';
    return;
  }

  const D = window.MPLACE || {};
  const I = window.MplaceI18n;
  const shop = user.shop || 'Big Shop';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /** Stage 21 XSS — escape untrusted strings before innerHTML templates */
  function esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (I) {
    I.mountSwitcher('#localeMount');
    window.addEventListener('mplace:locale', () => {
      I.applyDocument();
      route();
    });
  }

  const myProducts = (D.products || []).filter(p => p.shop === shop);
  const myOrders = (D.orders || []).filter(o => o.shop === shop);

  function fmtMoney(n) {
    if (I) return I.formatMoneyUSD(n);
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtCents(c) {
    if (I) return I.formatMoney(c);
    return '$' + (Number(c || 0) / 100).toFixed(2);
  }
  function statusClass(s) {
    return 'status status-' + String(s || '').toLowerCase();
  }
  function toast(msg, type = 'success') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    setTimeout(() => el.classList.remove('show'), 2200);
  }
  function header(title, crumbs) {
    const home = I ? I.t('admin.home') : 'Home';
    return `<div class="content-header">
      <div><h1>${title}</h1>
      <div class="breadcrumb"><a href="#dashboard">${home}</a> / <span>${crumbs || title}</span></div></div>
    </div>`;
  }
  function box(title, body, type = 'primary') {
    return `<div class="box box-${type}">
      <div class="box-header"><span class="box-title">${title}</span></div>
      <div class="box-body ${body.includes('data-table') ? 'no-pad' : ''}">${body}</div>
    </div>`;
  }
  function table(headers, rows) {
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function MENU() {
    const t = (k, f) => (I ? I.t(k) : f);
    return [
    { label: t('merchant.dashboard', 'DASHBOARD'), icon: '📊', page: 'dashboard' },
    {
      label: t('merchant.catalog', 'CATALOG'), icon: '📦', children: [
        { label: t('merchant.products', 'Products'), page: 'products' },
        { label: t('merchant.inventory', 'Inventory'), page: 'inventory' }
      ]
    },
    {
      label: t('merchant.orders', 'ORDERS'), icon: '🛒', children: [
        { label: t('merchant.orders', 'Orders'), page: 'orders' },
      ]
    },
    { label: t('merchant.payouts', 'PAYOUTS'), icon: '💰', page: 'payouts' },
    { label: t('merchant.messages', 'MESSAGES'), icon: '✉️', page: 'messages' },
    { label: t('merchant.shop', 'SHOP'), icon: '🏪', page: 'shop' },
    { label: t('merchant.account', 'ACCOUNT'), icon: '👤', page: 'account' }
  ];
  }

  const pages = {
    dashboard() {
      const revenue = myOrders.reduce((a, o) => a + o.total, 0);
      const bars = [50, 70, 40, 85, 60, 95, 55].map((h, i) => {
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return `<div class="chart-bar" style="height:${h}%" data-label="${labels[i]}"></div>`;
      }).join('');
      return header('Merchant Dashboard') + `
        <div class="stat-row">
          <div class="stat-card bg-primary-g"><h4>PRODUCTS</h4><div class="num">${myProducts.length || 12}</div><div class="sub">In your catalog</div><div class="stat-icon">📦</div></div>
          <div class="stat-card bg-info-g"><h4>ORDERS</h4><div class="num">${myOrders.length || 8}</div><div class="sub">Shop: ${shop}</div><div class="stat-icon">🛒</div></div>
          <div class="stat-card bg-success-g"><h4>REVENUE</h4><div class="num">${fmtMoney(revenue || 13590)}</div><div class="sub">Lifetime sales</div><div class="stat-icon">💵</div></div>
          <div class="stat-card bg-danger-g"><h4>PENDING</h4><div class="num">${myOrders.filter(o => o.status === 'Pending' || o.status === 'Processing').length}</div><div class="sub">Need action</div><div class="stat-icon">⏳</div></div>
        </div>
        <div class="grid-2">
          ${box('SALES THIS WEEK', `<div class="chart-area">${bars}</div>`)}
          ${box('RECENT ORDERS', table(['Order', 'Customer', 'Total', 'Status'],
            (myOrders.length ? myOrders : D.orders.slice(0, 5)).map(o =>
              `<tr><td>#${esc(o.id)}</td><td>${esc(o.customer)}</td><td>${esc(fmtMoney(o.total))}</td><td><span class="${esc(statusClass(o.status))}">${esc(o.status)}</span></td></tr>`
            ).join('')), 'info')}
        </div>
        ${box('YOUR PRODUCTS', table(['Name', 'Price', 'Stock', 'Sold', 'Status'],
          (myProducts.length ? myProducts : D.products.slice(0, 5)).map(p =>
            `<tr><td>${esc(String(p.name || '').slice(0, 40))}</td><td>${esc(fmtMoney(p.price))}</td><td>${esc(p.stock)}</td><td>${esc(p.sold)}</td><td><span class="${esc(statusClass(p.status))}">${esc(p.status)}</span></td></tr>`
          ).join('')), 'success')}`;
    },

    async products() {
      try {
        const list = window.MplaceApi ? await MplaceApi.products() : (myProducts.length ? myProducts : D.products.slice(0, 6));
        return header('Products', 'Catalog / Products') +
          `<div class="toolbar"><input class="form-control search-input" data-search placeholder="Search…" />
            <button class="btn btn-success btn-sm" id="mAddProduct">+ Add Product</button>
            <span class="text-muted" style="font-size:12px">API live</span></div>` +
          box('My Products', table(['#', 'Name', 'Price', 'Stock', 'Sold', 'Status', 'Action'],
            list.map(p => `<tr>
              <td title="${esc(p.id)}">${esc(String(p.id).slice(0, 8))}</td>
              <td>${esc(p.name)}</td>
              <td>${esc(fmtCents(p.priceCents != null ? p.priceCents : Math.round((p.price || 0) * 100)))}</td>
              <td>${esc(p.stock ?? 0)}</td><td>${esc(p.soldCount ?? p.sold ?? 0)}</td>
              <td><span class="${esc(statusClass(p.status))}">${esc(p.status)}</span></td>
              <td><button class="btn btn-primary btn-xs" onclick="MerchantApp.toast('OK')">Edit</button></td>
            </tr>`).join('') || `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:16px">${I ? I.t('admin.noProducts') : 'No products'}</td></tr>`));
      } catch (e) {
        return header(I ? I.t('merchant.products') : 'Products') + box(I ? I.t('admin.apiError') : 'API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    inventory() {
      const list = myProducts.length ? myProducts : D.products.slice(0, 6);
      return header('Inventory', 'Catalog / Inventory') +
        box('Stock Levels', table(['Product', 'SKU/GTIN', 'Stock', 'Status'],
          list.map(p => `<tr>
            <td>${esc(String(p.name || '').slice(0, 36))}</td><td class="text-muted">${esc(p.gtin)}</td><td>${esc(p.stock)}</td>
            <td>${p.stock < 30 ? '<span class="status status-pending">Low</span>' : '<span class="status status-active">OK</span>'}</td>
          </tr>`).join('')));
    },

    async orders() {
      try {
        const list = window.MplaceApi ? await MplaceApi.orders() : [];
        const rows = list.map(o => `<tr>
          <td><strong>${esc(o.orderNumber)}</strong></td>
          <td>${esc(o.customer?.name || o.customerName || o.customerEmail || '—')}</td>
          <td>${esc(o.items?.length || 0)}</td>
          <td>${esc(fmtCents(o.totalCents || 0))}</td>
          <td><span class="${esc(statusClass(o.status))}">${esc(o.status)}</span></td>
          <td>${esc(new Date(o.createdAt).toLocaleString())}</td>
          <td>
            <select class="form-control" style="width:auto;padding:2px 6px;font-size:11px" data-m-order="${esc(o.id)}">
              ${['PAID','PROCESSING','SHIPPED','COMPLETED','CANCELLED'].map(s =>
                `<option value="${esc(s)}" ${s === o.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:16px" class="text-muted">${I ? I.t('merchant.noOrders') : 'No orders'}</td></tr>`;
        const tr = (k) => (I ? I.t(k) : k);
        return header(tr('merchant.orders')) +
          box(tr('merchant.shopOrders'), table([
            tr('admin.col.order'),
            tr('admin.col.customer'),
            tr('admin.col.items'),
            tr('admin.col.total'),
            tr('admin.col.status'),
            tr('admin.col.date'),
            tr('admin.col.update'),
          ], rows));
      } catch (e) {
        return header(I ? I.t('merchant.orders') : 'Orders') + box(I ? I.t('admin.apiError') : 'API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    cancellations() {
      return header('Cancellations') +
        box('Cancelled', table(['Order', 'Customer', 'Total', 'Date'],
          D.orders.filter(o => o.status === 'Cancelled').map(o =>
            `<tr><td>#${esc(o.id)}</td><td>${esc(o.customer)}</td><td>${esc(fmtMoney(o.total))}</td><td>${esc(o.date)}</td></tr>`
          ).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px" class="text-muted">No cancellations</td></tr>'));
    },

    async payouts() {
      try {
        const [bal, list] = await Promise.all([
          window.MplaceApi.balance(),
          window.MplaceApi.payouts(),
        ]);
        const rows = list.map(p => `<tr>
          <td>${new Date(p.createdAt).toLocaleString()}</td>
          <td>${fmtCents(p.amountCents)}</td>
          <td>${p.method}</td>
          <td><span class="${statusClass(p.status)}">${p.status}</span></td>
        </tr>`).join('') || '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px">Нет заявок</td></tr>';
        return header('Payouts') +
          `<div class="info-row">
            <div class="info-box"><div class="info-box-icon bg-green">💵</div><div class="info-box-content"><div class="info-box-text">Available</div><div class="info-box-number">${fmtCents(bal.availableCents)}</div></div></div>
            <div class="info-box"><div class="info-box-icon bg-aqua">⏳</div><div class="info-box-content"><div class="info-box-text">Pending</div><div class="info-box-number">${fmtCents(bal.pendingPayoutCents)}</div></div></div>
            <div class="info-box"><div class="info-box-icon bg-blue">📤</div><div class="info-box-content"><div class="info-box-text">Earned</div><div class="info-box-number">${fmtCents(bal.earnedCents)}</div></div></div>
          </div>` +
          box('History (API)', table(['Date', 'Amount', 'Method', 'Status'], rows)) +
          `<button class="btn btn-primary" id="mRequestPayout">Request Payout</button>`;
      } catch (e) {
        return header('Payouts') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },

    messages() {
      return header('Messages') +
        box('Inbox', table(['From', 'Subject', 'Date'],
          [['Customer: Jhon Doe', 'Question about product', 'Today'], ['Admin', 'Shop verification note', 'Yesterday']].map(r =>
            `<tr><td>${r[0]}</td><td><a href="#">${r[1]}</a></td><td>${r[2]}</td></tr>`
          ).join('')));
    },

    disputes() {
      return header('Disputes') +
        box('Open disputes', table(['Order', 'Customer', 'Status', 'Action'],
          `<tr><td>#1003</td><td>Jhon Mack</td><td><span class="status status-pending">Open</span></td>
           <td><button class="btn btn-primary btn-xs" onclick="MerchantApp.toast('Reply sent (demo)')">Respond</button></td></tr>`));
    },

    shop() {
      return header('Shop settings') +
        box('Shop profile', `
          <div class="form-row">
            <div class="form-group"><label>Shop name</label><input class="form-control" value="${shop}" /></div>
            <div class="form-group"><label>Slug</label><input class="form-control" value="big-shop" /></div>
          </div>
          <div class="form-group"><label>Description</label><textarea class="form-control" rows="3">Welcome to ${shop} — quality products, fast shipping.</textarea></div>
          <div class="form-row">
            <div class="form-group"><label>Support email</label><input class="form-control" value="${user.email}" /></div>
            <div class="form-group"><label>Phone</label><input class="form-control" value="+1 555 0100" /></div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" onclick="MerchantApp.toast('Shop saved (demo)')">Save</button>
          </div>`);
    },

    shipping() {
      return header('Shipping') +
        box('Shipping methods', table(['Method', 'Rate', 'ETA', 'Active'],
          [['Flat rate', '$5.00', '3–5 days', 'Yes'], ['Express', '$15.00', '1–2 days', 'Yes'], ['Free over $100', '$0', '5–7 days', 'Yes']].map(r =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`
          ).join('')));
    },

    reports() {
      return header('Reports') +
        `<div class="stat-row">
          <div class="stat-card bg-success-g"><h4>THIS MONTH</h4><div class="num">${fmtMoney(3200)}</div></div>
          <div class="stat-card bg-primary-g"><h4>ORDERS</h4><div class="num">18</div></div>
          <div class="stat-card bg-info-g"><h4>AVG ORDER</h4><div class="num">${fmtMoney(178)}</div></div>
          <div class="stat-card bg-warning" style="background:linear-gradient(135deg,#f39c12,#e67e22)"><h4>CONVERSION</h4><div class="num">3.1%</div></div>
        </div>` +
        box('Sales report', '<div class="chart-line">📈 Merchant sales analytics (demo)</div>');
    },

    account() {
      return header('Account') +
        box('Profile', `
          <div class="form-row">
            <div class="form-group"><label>Name</label><input class="form-control" value="${user.name}" /></div>
            <div class="form-group"><label>Email</label><input class="form-control" value="${user.email}" readonly /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>New password</label><input class="form-control" type="password" placeholder="Leave blank to keep" /></div>
            <div class="form-group"><label>Confirm password</label><input class="form-control" type="password" /></div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" onclick="MerchantApp.toast('Profile updated (demo)')">Update</button>
          </div>`);
    }
  };

  function renderMenu(active) {
    $('#sidebarMenu').innerHTML = MENU().map(item => {
      if (item.children) {
        const open = item.children.some(c => c.page === active);
        return `<li class="treeview ${open ? 'open' : ''}">
          <a href="javascript:void(0)" class="tree-toggle"><span class="icon">${item.icon}</span> ${item.label}<span class="arrow">▶</span></a>
          <ul class="treeview-menu">
            ${item.children.map(c => `<li class="${c.page === active ? 'active' : ''}"><a href="#${c.page}">${c.label}</a></li>`).join('')}
          </ul>
        </li>`;
      }
      return `<li class="${item.page === active ? 'active' : ''}"><a href="#${item.page}"><span class="icon">${item.icon}</span> ${item.label}</a></li>`;
    }).join('');
  }

  async function route() {
    const page = location.hash.replace('#', '') || 'dashboard';
    const fn = pages[page] || pages.dashboard;
    $('#content').innerHTML = `<div class="page-placeholder"><p>${I ? I.t('common.loading') : 'Loading…'}</p></div>`;
    renderMenu(page);
    try {
      $('#content').innerHTML = await fn();
    } catch (e) {
      const msg = (typeof escapeHtml === 'function' ? escapeHtml : String)(e.message || e);
      $('#content').innerHTML = header(page) + box('Error', `<p class="text-danger">${msg}</p>`);
    }
    $$('[data-search]').forEach(input => {
      input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        $$('#content .data-table tbody tr').forEach(tr => {
          tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    });
    const addBtn = document.getElementById('mAddProduct');
    if (addBtn && window.MplaceApi) {
      addBtn.onclick = async () => {
        const name = prompt('Product name');
        if (!name) return;
        const price = Number(prompt('Price', '9.99') || '9.99');
        try {
          await MplaceApi.createProduct({ name, price, stock: 10, status: 'ACTIVE' });
          toast('Product created');
          route();
        } catch (ex) {
          toast(ex.message || 'Failed', 'error');
        }
      };
    }
    document.querySelectorAll('[data-m-order]').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await MplaceApi.updateOrderStatus(sel.dataset.mOrder, sel.value);
          toast('Status updated');
          route();
        } catch (ex) {
          toast(ex.message || 'Failed', 'error');
          route();
        }
      });
    });
    const payBtn = document.getElementById('mRequestPayout');
    if (payBtn && window.MplaceApi) {
      payBtn.onclick = async () => {
        const raw = prompt('Amount in USD (e.g. 10.00)');
        if (!raw) return;
        const amountCents = Math.round(Number(raw) * 100);
        try {
          await MplaceApi.requestPayout(amountCents);
          toast('Payout requested');
          route();
        } catch (ex) {
          toast(ex.message || 'Failed', 'error');
        }
      };
    }
  }

  $('#userName').textContent = user.name;
  $('#shopName').textContent = shop;
  const fs = document.getElementById('footerShop');
  if (fs) fs.textContent = shop;
  $('#userAvatar').textContent = user.name.charAt(0);
  $('#logoutBtn').addEventListener('click', e => {
    e.preventDefault();
    if (window.MplaceApi) MplaceApi.clearSession();
    else {
      sessionStorage.removeItem('mplace_user');
      sessionStorage.removeItem('mplace_token');
    }
    location.href = '../login.html';
  });
  $('#toggleSidebar').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#sidebarMenu').addEventListener('click', e => {
    const t = e.target.closest('.tree-toggle');
    if (t) {
      e.preventDefault();
      t.closest('.treeview').classList.toggle('open');
    }
  });

  window.MerchantApp = { toast };
  window.addEventListener('hashchange', route);
  route();
})();
