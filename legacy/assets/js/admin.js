/* Mplace Admin SPA */
(function () {
  const user = JSON.parse(sessionStorage.getItem('mplace_user') || 'null');
  const role = String(user?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  if (!user || !isAdmin || !sessionStorage.getItem('mplace_token')) {
    location.href = '../login.html?email=superadmin@demo.com';
    return;
  }

  const D = window.MPLACE || {};
  const Api = window.MplaceApi;
  const I = window.MplaceI18n;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let cache = { products: null, categories: null, shops: null };

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

  function MENU() {
    return [
    { id: 'dashboard', label: I ? I.t('admin.dashboard') : 'DASHBOARD', icon: '📊', page: 'dashboard' },
    {
      id: 'catalog', label: I ? I.t('admin.catalog') : 'CATALOG', icon: '📦', children: [
        { id: 'categories', label: I ? I.t('admin.categories') : 'Categories', page: 'categories' },
        { id: 'products', label: I ? I.t('admin.products') : 'Products', page: 'products' },
      ]
    },
    {
      id: 'orders', label: I ? I.t('admin.orders') : 'ORDERS', icon: '🛒', children: [
        { id: 'order-list', label: I ? I.t('admin.orders') : 'Orders', page: 'orders' },
      ]
    },
    {
      id: 'admin-users', label: I ? I.t('admin.admin') : 'ADMIN', icon: '👤', children: [
        { id: 'customers', label: I ? I.t('admin.customers') : 'Customers', page: 'customers' },
      ]
    },
    {
      id: 'vendors', label: I ? I.t('admin.vendors') : 'VENDORS', icon: '🏪', children: [
        { id: 'merchants', label: I ? I.t('admin.merchants') : 'Merchants', page: 'merchants' },
        { id: 'shops', label: I ? I.t('admin.shops') : 'Shops', page: 'shops' }
      ]
    },
    {
      id: 'wallet', label: I ? I.t('admin.wallet') : 'WALLET', icon: '💰', children: [
        { id: 'payouts', label: 'Payouts', page: 'payouts' },
        { id: 'ledger', label: 'Ledger', page: 'ledger' },
      ]
    },
    {
      id: 'support', label: I ? I.t('admin.support') : 'SUPPORT', icon: '🎧', children: [
        { id: 'tickets', label: I ? I.t('admin.tickets') : 'Tickets', page: 'tickets' },
        { id: 'disputes', label: 'Disputes', page: 'disputes' },
        { id: 'refunds', label: 'Refunds', page: 'refunds' },
        { id: 'audit', label: 'Audit', page: 'audit' },
      ]
    },
    {
      id: 'reports', label: I ? I.t('admin.reports') : 'REPORTS', icon: '📈', children: [
        { id: 'report-kpi', label: 'Summary', page: 'reportKpi' },
      ]
    }
  ];
  }

  function fmtMoney(n) {
    if (I) return I.formatMoneyUSD(n);
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtCents(c) {
    if (I) return I.formatMoney(c);
    return '$' + (Number(c || 0) / 100).toFixed(2);
  }
  function statusClass(s) {
    const k = String(s || '').toLowerCase().replace(/_/g, '-');
    const map = {
      'pending-payment': 'pending',
      paid: 'shipped',
      processing: 'processing',
      shipped: 'shipped',
      completed: 'completed',
      cancelled: 'cancelled',
      active: 'active',
      draft: 'draft',
      pending: 'pending',
      suspended: 'cancelled',
      rejected: 'cancelled',
    };
    return 'status status-' + (map[k] || k);
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
      <div>
        <h1>${title}</h1>
        <div class="breadcrumb"><a href="#dashboard">${home}</a> / <span>${crumbs || title}</span></div>
      </div>
    </div>`;
  }
  function toolbar(placeholder, extra = '') {
    return `<div class="toolbar">
      <input class="form-control search-input" type="search" placeholder="${placeholder}" data-table-search />
      ${extra}
    </div>`;
  }
  function box(title, body, tools = '', type = 'primary') {
    return `<div class="box box-${type}">
      <div class="box-header"><span class="box-title">${title}</span><div class="box-tools">${tools}</div></div>
      <div class="box-body ${body.includes('data-table') ? 'no-pad' : ''}">${body}</div>
    </div>`;
  }
  function table(headers, rowsHtml) {
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>`;
  }
  function emptyPage(title, icon, desc) {
    return header(title) + box(title, `<div class="page-placeholder">
      <div class="big-icon">${icon}</div>
      <p><strong>${title}</strong></p>
      <p>${desc || 'Demo page — UI clone of Mplace admin section.'}</p>
      <button class="btn btn-primary btn-sm" onclick="AdminApp.toast('Saved (demo)')">Create New</button>
    </div>`);
  }
  function actions(id) {
    return `<div class="actions">
      <button class="btn btn-info btn-xs" data-act="view" data-id="${id}">${I ? I.t('admin.view') : 'View'}</button>
      <button class="btn btn-primary btn-xs" data-act="edit" data-id="${id}">${I ? I.t('admin.edit') : 'Edit'}</button>
      <button class="btn btn-danger btn-xs" data-act="del" data-id="${id}">${I ? I.t('admin.del') : 'Del'}</button>
    </div>`;
  }

  function renderDashboard(s) {
      const bars = [40, 65, 45, 80, 55, 90, 70].map((h, i) => {
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return `<div class="chart-bar" style="height:${h}%" data-label="${labels[i]}"></div>`;
      }).join('');

      const tt = I || { t: (k) => k };
      return header(tt.t('admin.dashboardTitle')) + `
        <div class="stat-row">
          <div class="stat-card bg-danger-g"><h4>${tt.t('admin.customersCard')}</h4><div class="num">${s.customers}</div><div class="sub">${tt.t('admin.fromApi')}</div><div class="stat-icon">👥</div></div>
          <div class="stat-card bg-info-g"><h4>${tt.t('admin.merchantsCard')}</h4><div class="num">${s.merchants}</div><div class="sub">${tt.t('admin.fromApi')}</div><div class="stat-icon">🏪</div></div>
          <div class="stat-card bg-primary-g"><h4>${tt.t('admin.ordersCard')}</h4><div class="num">${s.orders}</div><div class="sub">${tt.t('admin.fromApi')}</div><div class="stat-icon">🛒</div></div>
          <div class="stat-card bg-success-g"><h4>${tt.t('admin.todayTotal')}</h4><div class="num">${fmtCents(s.todayTotalCents || Math.round((Number(s.todayTotal) || 0) * 100))}</div><div class="sub">${tt.t('admin.fromApi')}</div><div class="stat-icon">💵</div></div>
        </div>
        <div class="info-row">
          <div class="info-box"><div class="info-box-icon bg-yellow">⏳</div><div class="info-box-content"><div class="info-box-text">${tt.t('admin.pendingVerif')}</div><div class="info-box-number">${s.pendingVerifications ?? 0}</div><div class="info-box-sub">${tt.t('admin.shopsPending')}</div></div></div>
          <div class="info-box"><div class="info-box-icon bg-aqua">✅</div><div class="info-box-content"><div class="info-box-text">${tt.t('admin.pendingApprovals')}</div><div class="info-box-number">${s.pendingApprovals ?? 0}</div><div class="info-box-sub">${tt.t('admin.needAction')}</div></div></div>
          <div class="info-box"><div class="info-box-icon bg-red">⚠️</div><div class="info-box-content"><div class="info-box-text">${tt.t('admin.disputes')}</div><div class="info-box-number">${s.appealedDisputes ?? 0}</div><div class="info-box-sub">${tt.t('admin.openAppealed')}</div></div></div>
        </div>
        <div class="grid-2">
          ${box('SALES GRAPH', `<div class="chart-area">${bars}</div>
            <div class="toolbar" style="margin-top:20px;margin-bottom:0">
              <button class="btn btn-default btn-sm">This Week</button>
              <button class="btn btn-primary btn-sm">This Month</button>
              <button class="btn btn-default btn-sm">This Year</button>
            </div>`, '', 'primary')}
          ${box('VISITORS GRAPH', `<div class="chart-line">📈 Page views · Unique visits (demo chart)</div>`, '', 'info')}
        </div>
        <div class="grid-2">
          ${box('OPEN TICKETS', table(['Subject', 'Priority', 'Last update'],
            (D.tickets || []).map(t => `<tr>
              <td><div class="text-muted" style="font-size:11px">${t.type}</div><a href="#tickets">${t.subject}</a></td>
              <td><span class="status status-${t.priority.toLowerCase()}">${t.priority}</span></td>
              <td>${t.updated}</td>
            </tr>`).join('')), `<a class="btn btn-default btn-xs" href="#tickets">View all</a>`, 'warning')}
          ${box('TOP CUSTOMERS', table(['Name', 'Orders', 'Revenue'],
            (D.customers || []).slice(0, 5).map(c => `<tr>
              <td><span class="thumb">👤</span>${c.name}</td>
              <td>${c.orders}</td>
              <td>${fmtMoney(c.revenue)}</td>
            </tr>`).join('')), '', 'success')}
        </div>
        <div class="grid-2">
          ${box('TOP VENDORS', table(['Name', 'Orders', 'Revenue'],
            (D.merchants || []).map(m => `<tr>
              <td><span class="thumb">🏪</span>${m.shop}</td>
              <td>${m.products}</td>
              <td>${fmtMoney(m.revenue)}</td>
            </tr>`).join('')), '', 'info')}
          ${box('LATEST FROM API', `<p class="text-muted">Stats above load from <code>GET /api/admin/stats</code>. Products: <a href="#products">Catalog → Products</a>.</p>`, '', 'primary')}
        </div>
      `;
  }

  function renderProducts(list) {
      const rows = (list || []).map(p => `<tr>
        <td title="${esc(p.id)}">${esc(String(p.id).slice(0, 8))}</td>
        <td><span class="thumb">📦</span>${esc(p.name)}</td>
        <td>${esc(p.shop?.name || p.shop || '—')}</td>
        <td>${esc(p.category?.name || p.category || '—')}</td>
        <td>${esc(fmtCents(p.priceCents != null ? p.priceCents : Math.round((p.price || 0) * 100)))}</td>
        <td>${esc(p.stock ?? 0)}</td>
        <td>${esc(p.soldCount ?? p.sold ?? 0)}</td>
        <td><span class="${esc(statusClass(p.status))}">${esc(p.status)}</span></td>
        <td>${actions(p.id)}</td>
      </tr>`).join('') || `<tr><td colspan="9" class="text-muted" style="text-align:center;padding:20px">${I ? I.t('admin.noProducts') : 'No products'}</td></tr>`;
      const tt = I || { t: (k) => k };
      return header(tt.t('admin.productsTitle'), tt.t('admin.catalog') + ' / ' + tt.t('admin.products')) +
        toolbar(tt.t('admin.searchProducts'), `<button class="btn btn-success btn-sm" data-open-modal="product">+ ${tt.t('admin.addProduct')}</button>
          <span class="text-muted" style="font-size:12px">${tt.t('admin.apiLive')}</span>`) +
        box(tt.t('admin.allProducts'), table(['#', tt.t('admin.col.name'), tt.t('admin.col.shop'), tt.t('admin.col.category'), tt.t('admin.col.price'), tt.t('admin.col.stock'), tt.t('admin.col.sold'), tt.t('admin.col.status'), tt.t('admin.col.action')], rows));
  }

  /* ---------- Pages ---------- */
  const pages = {
    async dashboard() {
      try {
        const s = await Api.adminStats();
        return renderDashboard({
          customers: s.customers,
          merchants: s.merchants,
          orders: s.orders,
          todayTotal: Number(s.todayTotal) || 0,
          todayTotalCents: s.todayTotalCents || 0,
          pendingVerifications: s.pendingVerifications,
          pendingApprovals: 0,
          appealedDisputes: s.appealedDisputes,
        });
      } catch (e) {
        return header('Dashboard') + box('API error', `<p class="text-danger">${esc(e.message)}</p><p>Is API running on ${esc(Api.getBase())}?</p>`);
      }
    },

    async products() {
      try {
        const list = await Api.products();
        cache.products = list;
        return renderProducts(list);
      } catch (e) {
        return header('Products') + box('API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    async categories() {
      try {
        const list = await Api.categories();
        cache.categories = list;
        const rows = list.map(c => `<tr>
          <td>${esc(String(c.id).slice(0, 8))}</td>
          <td>${esc(c.name)}</td>
          <td>${esc(c.parent?.name || 'Root')}</td>
          <td>${esc(c._count?.products ?? 0)}</td>
          <td>${actions(c.id)}</td>
        </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:16px" class="text-muted">No categories</td></tr>';
        return header('Categories', 'Catalog / Categories') +
          toolbar('Search…', `<button class="btn btn-success btn-sm" data-open-modal="category">+ Add Category</button>`) +
          box('Categories (API)', table(['#', 'Name', 'Parent', 'Products', 'Action'], rows));
      } catch (e) {
        return header('Categories') + box('API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    async orders() {
      try {
        const list = await Api.orders();
        const rows = list.map(o => `<tr>
          <td><strong>${esc(o.orderNumber)}</strong></td>
          <td>${esc(o.customer?.name || o.customerName || o.customerEmail || '—')}</td>
          <td>${esc(o.shop?.name || '—')}</td>
          <td>${esc(o.items?.length || o._count?.items || 0)}</td>
          <td>${esc(fmtCents(o.totalCents || 0))}</td>
          <td><span class="${esc(statusClass(o.status))}">${esc(o.status)}</span></td>
          <td>${esc(new Date(o.createdAt).toLocaleString())}</td>
          <td>
            <select class="form-control" style="width:auto;display:inline-block;padding:2px 6px;font-size:11px" data-order-status="${esc(o.id)}">
              ${['PENDING_PAYMENT','PAID','PROCESSING','SHIPPED','COMPLETED','CANCELLED'].map(s =>
                `<option value="${esc(s)}" ${s === o.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:16px" class="text-muted">No orders</td></tr>';
        return header('Orders', 'Orders / Orders') +
          toolbar('Search orders…', '<span class="text-muted" style="font-size:12px">API live</span>') +
          box('Order List', table(['Order #', 'Customer', 'Shop', 'Items', 'Total', 'Status', 'Date', 'Update'], rows));
      } catch (e) {
        return header('Orders') + box('API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    async customers() {
      try {
        const list = await Api.adminCustomers();
        const rows = list.map(c => `<tr>
          <td title="${esc(c.id)}">${esc(String(c.id).slice(0, 8))}</td>
          <td><span class="thumb">👤</span>${esc(c.name)}</td>
          <td>${esc(c.email)}</td>
          <td>${esc(c._count?.orders ?? 0)}</td>
          <td><span class="${esc(statusClass(c.status))}">${esc(c.status)}</span></td>
          <td>${esc(new Date(c.createdAt).toLocaleDateString())}</td>
        </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:16px" class="text-muted">No customers</td></tr>';
        return header('Customers', 'Admin / Customers') +
          toolbar('Search customers…') +
          box('Customer List (API)', table(['#', 'Name', 'Email', 'Orders', 'Status', 'Joined'], rows));
      } catch (e) {
        return header('Customers') + box('API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    async merchants() {
      try {
        const list = await Api.adminMerchants();
        const rows = list.map(m => `<tr>
          <td title="${esc(m.id)}">${esc(String(m.id).slice(0, 8))}</td>
          <td>${esc(m.name)}</td>
          <td>${esc(m.email)}</td>
          <td><strong>${esc(m.shop?.name || '—')}</strong></td>
          <td>${esc(m.shop?._count?.products ?? 0)}</td>
          <td>${esc(m.shop?._count?.orders ?? 0)}</td>
          <td>${m.shop?.verified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-warning">Unverified</span>'}</td>
          <td><span class="${esc(statusClass(m.shop?.status || m.status))}">${esc(m.shop?.status || m.status)}</span></td>
        </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:16px" class="text-muted">No merchants</td></tr>';
        return header('Merchants', 'Vendors / Merchants') +
          toolbar('Search merchants…') +
          box('Merchant List (API)', table(['#', 'Name', 'Email', 'Shop', 'Products', 'Orders', 'Verify', 'Status'], rows));
      } catch (e) {
        return header('Merchants') + box('API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    async shops() {
      try {
        const list = await Api.shops();
        const rows = list.map(s => `<tr>
          <td title="${esc(s.id)}">${esc(String(s.id).slice(0, 8))}</td>
          <td><span class="thumb">🏪</span>${esc(s.name)}</td>
          <td>${esc(s.slug)}</td>
          <td>${esc(s._count?.products ?? 0)}</td>
          <td>${esc(s._count?.orders ?? 0)}</td>
          <td><span class="${esc(statusClass(s.status))}">${esc(s.status)}</span></td>
          <td>
            <select class="form-control" style="width:auto;display:inline-block;padding:2px 6px;font-size:11px" data-shop-status="${esc(s.id)}">
              ${['PENDING','ACTIVE','SUSPENDED','REJECTED'].map(st =>
                `<option value="${esc(st)}" ${st === s.status ? 'selected' : ''}>${esc(st)}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:16px" class="text-muted">No shops</td></tr>';
        return header('Shops', 'Vendors / Shops') +
          toolbar('Search shops…') +
          box('Shop List (API)', table(['#', 'Name', 'Slug', 'Products', 'Orders', 'Status', 'Set status'], rows));
      } catch (e) {
        return header('Shops') + box('API error', `<p class="text-danger">${esc(e.message)}</p>`);
      }
    },

    categoryGroups() {
      return header('Category Groups', 'Catalog / Groups') +
        box('Groups', table(['#', 'Name', 'Sub-groups', 'Action'],
          ['Electronics', 'Fashion', 'Home', 'Sports'].map((n, i) =>
            `<tr><td>${i + 1}</td><td>${n}</td><td>${2 + i}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },

    categorySubGroups() {
      return header('Category Sub-groups', 'Catalog / Sub-groups') +
        box('Sub-groups', table(['#', 'Name', 'Group', 'Action'],
          ['Phones', 'Laptops', 'Men', 'Women', 'Furniture'].map((n, i) =>
            `<tr><td>${i + 1}</td><td>${n}</td><td>${['Electronics', 'Electronics', 'Fashion', 'Fashion', 'Home'][i]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },

    attributes() {
      return header('Attributes', 'Catalog / Attributes') +
        box('Product Attributes', table(['#', 'Name', 'Type', 'Values', 'Action'],
          [['Color', 'Select', 'Red, Blue, Green'], ['Size', 'Select', 'S, M, L, XL'], ['Material', 'Text', '—']].map((r, i) =>
            `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },

    manufacturers() {
      return header('Manufacturers', 'Catalog / Manufacturers') +
        box('Brands / Manufacturers', table(['#', 'Name', 'Country', 'Sold', 'Action'],
          D.brands.map((b, i) =>
            `<tr><td>${i + 1}</td><td>${b.name}</td><td>${b.country}</td><td>${b.sold}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },

    carts() {
      return header('Carts', 'Orders / Carts') +
        box('Abandoned / Active Carts', table(['#', 'Customer', 'Items', 'Total', 'Updated', 'Action'],
          [['Jhon Doe', 3, 129.5, '2h ago'], ['Sarah Lee', 1, 59, '1d ago'], ['Guest #441', 2, 88, '3d ago']].map((r, i) =>
            `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td><td>${fmtMoney(r[2])}</td><td>${r[3]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },

    cancellations() {
      const rows = D.orders.filter(o => o.status === 'Cancelled').map(o =>
        `<tr><td>#${o.id}</td><td>${o.customer}</td><td>${fmtMoney(o.total)}</td><td>${o.date}</td><td>${actions(o.id)}</td></tr>`
      ).join('') || '<tr><td colspan="5" class="text-muted" style="padding:20px;text-align:center">No cancellations</td></tr>';
      return header('Cancellations', 'Orders / Cancellations') +
        box('Cancelled Orders', table(['Order', 'Customer', 'Total', 'Date', 'Action'], rows));
    },

    users() {
      return header('Users', 'Admin / Users') +
        box('Admin Users', table(['#', 'Name', 'Email', 'Role', 'Status', 'Action'],
          `<tr><td>1</td><td>SuperAdmin</td><td>superadmin@demo.com</td><td>Super Admin</td><td><span class="status status-active">Active</span></td><td>${actions(1)}</td></tr>
           <tr><td>2</td><td>Support Agent</td><td>support@demo.com</td><td>Support</td><td><span class="status status-active">Active</span></td><td>${actions(2)}</td></tr>`));
    },

    async tickets() {
      try {
        const list = await Api.tickets();
        const rows = list.map(t => `<tr>
          <td>${String(t.id).slice(0, 8)}</td>
          <td>${t.type}</td>
          <td>${t.subject}</td>
          <td><span class="${statusClass(t.priority)}">${t.priority}</span></td>
          <td><span class="${statusClass(t.status)}">${t.status}</span></td>
          <td>${new Date(t.updatedAt).toLocaleString()}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:16px">Нет тикетов</td></tr>';
        return header('Tickets') + box('Tickets (API)', table(['#', 'Type', 'Subject', 'Priority', 'Status', 'Updated'], rows));
      } catch (e) {
        return header('Tickets') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },

    async disputes() {
      try {
        const list = await Api.disputes();
        const rows = list.map(d => `<tr>
          <td>${String(d.id).slice(0, 8)}</td>
          <td>${d.order?.orderNumber || d.orderId}</td>
          <td>${d.reason}</td>
          <td><span class="${statusClass(d.status)}">${d.status}</span></td>
          <td>${new Date(d.createdAt).toLocaleString()}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:16px">Нет споров</td></tr>';
        return header('Disputes') + box('Disputes (API)', table(['#', 'Order', 'Reason', 'Status', 'Date'], rows));
      } catch (e) {
        return header('Disputes') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },

    async refunds() {
      try {
        const list = await Api.refunds();
        const rows = list.map(r => `<tr>
          <td>${String(r.id).slice(0, 8)}</td>
          <td>${r.order?.orderNumber || r.orderId}</td>
          <td>${fmtCents(r.amountCents)}</td>
          <td>${r.reason || '—'}</td>
          <td><span class="${statusClass(r.status)}">${r.status}</span></td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:16px">Нет возвратов</td></tr>';
        return header('Refunds') + box('Refunds (API)', table(['#', 'Order', 'Amount', 'Reason', 'Status'], rows));
      } catch (e) {
        return header('Refunds') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },

    async audit() {
      try {
        const list = await Api.audit();
        const rows = list.map(a => `<tr>
          <td>${new Date(a.createdAt).toLocaleString()}</td>
          <td>${a.actor?.email || '—'}</td>
          <td>${a.action}</td>
          <td>${a.entityType || ''} ${a.entityId ? String(a.entityId).slice(0, 8) : ''}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px">Пусто</td></tr>';
        return header('Audit') + box('Audit log (API)', table(['When', 'Actor', 'Action', 'Entity'], rows));
      } catch (e) {
        return header('Audit') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },

    system() {
      return header('System settings', 'Settings / System') + `
        <div class="box box-primary">
          <div class="box-header"><span class="box-title">General Settings</span></div>
          <div class="box-body">
            <div class="tabs" id="settingsTabs">
              <div class="tab active" data-tab="general">General</div>
              <div class="tab" data-tab="mail">Mail</div>
              <div class="tab" data-tab="seo">SEO</div>
              <div class="tab" data-tab="social">Social</div>
            </div>
            <div class="tab-panel active" data-panel="general">
              <div class="form-row">
                <div class="form-group"><label>Marketplace name</label><input class="form-control" value="Mplace" /></div>
                <div class="form-group"><label>Default currency</label><select class="form-control"><option>USD ($)</option><option>EUR (€)</option><option>JPY (¥)</option></select></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>Timezone</label><select class="form-control"><option>UTC</option><option>America/New_York</option><option>Europe/Moscow</option></select></div>
                <div class="form-group"><label>Default language</label><select class="form-control"><option>English</option><option>Spanish</option><option>Persian</option></select></div>
              </div>
              <div class="form-group"><label>Support email</label><input class="form-control" value="support@mplace.local" /></div>
            </div>
            <div class="tab-panel" data-panel="mail">
              <div class="form-row">
                <div class="form-group"><label>Mail driver</label><select class="form-control"><option>SMTP</option><option>Mailgun</option><option>SES</option></select></div>
                <div class="form-group"><label>From address</label><input class="form-control" value="noreply@mplace.local" /></div>
              </div>
            </div>
            <div class="tab-panel" data-panel="seo">
              <div class="form-group"><label>Meta title</label><input class="form-control" value="Mplace Multi-Vendor Marketplace" /></div>
              <div class="form-group"><label>Meta description</label><textarea class="form-control" rows="3">Shop from multiple vendors on Mplace.</textarea></div>
            </div>
            <div class="tab-panel" data-panel="social">
              <div class="form-row">
                <div class="form-group"><label>Facebook</label><input class="form-control" placeholder="https://facebook.com/…" /></div>
                <div class="form-group"><label>Twitter / X</label><input class="form-control" placeholder="https://x.com/…" /></div>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" onclick="AdminApp.toast('Settings saved (demo)')">Save Changes</button>
              <button class="btn btn-default">Cancel</button>
            </div>
          </div>
        </div>`;
    },

    config() { return emptyPage('Configurations', '⚙️', 'System configuration options.'); },
    plans() {
      return header('Subscription Plans', 'Settings / Plans') +
        box('Merchant Plans', table(['Plan', 'Price/mo', 'Products', 'Commission', 'Action'],
          [['Free', 0, 50, '15%'], ['Starter', 29, 500, '10%'], ['Pro', 99, 'Unlimited', '5%']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${fmtMoney(r[1])}</td><td>${r[2]}</td><td>${r[3]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    roles() {
      return header('User roles', 'Settings / Roles') +
        box('Roles', table(['Role', 'Users', 'Permissions', 'Action'],
          [['Super Admin', 1, 'All'], ['Admin', 2, 'Most'], ['Support', 3, 'Tickets, Orders'], ['Merchant', 5, 'Shop only']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    countries() {
      return header('Business Area', 'Settings / Countries') +
        box('Countries', table(['Country', 'Code', 'Active', 'Action'],
          [['United States', 'US'], ['United Kingdom', 'GB'], ['Germany', 'DE'], ['Russia', 'RU'], ['India', 'IN']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td><span class="status status-active">Yes</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    currencies() {
      return header('Currencies', 'Settings / Currencies') +
        box('Currencies', table(['Code', 'Symbol', 'Exchange', 'Default', 'Action'],
          [['USD', '$', '1.00', 'Yes'], ['EUR', '€', '0.92', 'No'], ['JPY', '¥', '149.5', 'No'], ['INR', '₹', '83.2', 'No']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    languages() {
      return header('Languages', 'Settings / Languages') +
        box('Languages', table(['Language', 'Code', 'Active', 'Action'],
          [['English', 'en'], ['Spanish', 'es'], ['Persian', 'fa'], ['Bangla', 'bn']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td><span class="status status-active">Yes</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    themes() {
      return header('Themes', 'Appearance / Themes') +
        box('Installed Themes', table(['Theme', 'Version', 'Status', 'Action'],
          `<tr><td>Default Marketplace</td><td>3.2.0</td><td><span class="status status-active">Active</span></td><td><button class="btn btn-primary btn-xs">Customize</button></td></tr>
           <tr><td>Classic Store</td><td>2.1.0</td><td><span class="status status-inactive">Inactive</span></td><td><button class="btn btn-default btn-xs" onclick="AdminApp.toast('Theme activated (demo)')">Activate</button></td></tr>`));
    },
    banners() {
      return header('Banners', 'Appearance / Banners') +
        box('Banners', table(['#', 'Title', 'Position', 'Status', 'Action'],
          [['Hero Summer', 'Homepage', 'Active'], ['Flash Sale', 'Top bar', 'Active'], ['Vendor promo', 'Sidebar', 'Draft']].map((r, i) =>
            `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td><td><span class="${statusClass(r[2])}">${r[2]}</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    sliders() {
      return header('Sliders', 'Appearance / Sliders') +
        box('Homepage Sliders', table(['#', 'Title', 'Order', 'Status', 'Action'],
          [['Welcome Banner', 1], ['Featured Deals', 2], ['New Arrivals', 3]].map((r, i) =>
            `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td><td><span class="status status-active">Active</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    popups() { return emptyPage('Dynamic Popups', '💬', 'Configure popup promotions and notices.'); },
    customCss() {
      return header('Custom CSS', 'Appearance / Custom CSS') +
        box('Custom Stylesheet', `<textarea class="form-control" rows="12" style="font-family:monospace">/* Custom CSS for storefront */
.hero { /* your styles */ }
</textarea>
        <div class="form-actions"><button class="btn btn-primary" onclick="AdminApp.toast('CSS saved (demo)')">Save CSS</button></div>`);
    },
    promotions() {
      return header('Promotions', 'Promotions') +
        box('Coupons & Promos', table(['Code', 'Type', 'Value', 'Uses', 'Status', 'Action'],
          [['SAVE10', 'Percent', '10%', 120, 'Active'], ['FLAT20', 'Fixed', '$20', 45, 'Active'], ['WELCOME', 'Percent', '15%', 8, 'Expired']].map((r, i) =>
            `<tr><td><code>${r[0]}</code></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="${statusClass(r[4])}">${r[4]}</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    trending() { return emptyPage('Trending keywords', '🔥', 'Manage trending search keywords addon.'); },
    flashDeal() {
      return header('Flash Deal', 'Promotions / Flash Deal') +
        box('Active Flash Deals', table(['Title', 'Discount', 'Ends', 'Products', 'Action'],
          `<tr><td>Weekend Blitz</td><td>40%</td><td>2026-07-26</td><td>12</td><td>${actions(1)}</td></tr>
           <tr><td>Summer Clearance</td><td>25%</td><td>2026-07-30</td><td>34</td><td>${actions(2)}</td></tr>`));
    },
    plugins() {
      return header('Plugins', 'Plugins') +
        box('Installed Packages', table(['Package', 'Version', 'Status', 'Action'],
          [['Wallet Addon', '1.4.0', 'Active'], ['Affiliate Addon', '1.2.1', 'Active'], ['Inspector Addon', '1.0.3', 'Active'], ['Smart Forms', '2.0.0', 'Inactive']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td><span class="${statusClass(r[2])}">${r[2]}</span></td><td><button class="btn btn-default btn-xs" onclick="AdminApp.toast('Toggled (demo)')">Toggle</button></td></tr>`
          ).join('')));
    },
    async payouts() {
      try {
        const list = await Api.payouts();
        const rows = list.map(p => `<tr>
          <td>${String(p.id).slice(0, 8)}</td>
          <td>${p.shop?.name || p.shopId}</td>
          <td>${fmtCents(p.amountCents)}</td>
          <td>${p.method}</td>
          <td>${new Date(p.createdAt).toLocaleString()}</td>
          <td><span class="${statusClass(p.status)}">${p.status}</span></td>
          <td>
            ${p.status === 'PENDING' ? `
              <button class="btn btn-success btn-xs" data-payout="${p.id}" data-decision="APPROVED">Approve</button>
              <button class="btn btn-danger btn-xs" data-payout="${p.id}" data-decision="REJECTED">Reject</button>
              <button class="btn btn-primary btn-xs" data-payout="${p.id}" data-decision="PAID">Mark paid</button>
            ` : '—'}
          </td>
        </tr>`).join('') || '<tr><td colspan="7" class="text-muted" style="text-align:center;padding:16px">Нет заявок</td></tr>';
        return header('Payouts') + box('Payouts (API)', table(['#', 'Shop', 'Amount', 'Method', 'Date', 'Status', 'Action'], rows));
      } catch (e) {
        return header('Payouts') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },
    async ledger() {
      try {
        const list = await Api.ledger();
        const rows = list.map(e => `<tr>
          <td>${new Date(e.createdAt).toLocaleString()}</td>
          <td>${e.account}</td>
          <td>${e.entryType}</td>
          <td>${fmtCents(e.amountCents)}</td>
          <td>${e.description || '—'}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:16px">Пусто</td></tr>';
        return header('Ledger') + box('Ledger (API)', table(['When', 'Account', 'Type', 'Amount', 'Note'], rows));
      } catch (e) {
        return header('Ledger') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },
    rewards() { return emptyPage('Credit rewards', '🎁', 'Manage wallet credit rewards.'); },
    affiliateComm() { return emptyPage('Affiliate Commission', '🤝', 'Affiliate commission ledger.'); },
    bulkDeposits() { return emptyPage('Bulk Deposits', '📤', 'Bulk wallet deposit upload.'); },
    affiliates() { return emptyPage('Affiliates', '🤝', 'Affiliate program management.'); },
    inspectables() { return emptyPage('Inspectables', '🔍', 'Inspector addon list.'); },
    walletSettings() { return emptyPage('Wallet settings', '💰', 'Configure wallet addon.'); },
    commissions() {
      return header('Commissions', 'Settings / Commissions') +
        box('Dynamic Commissions', table(['Category', 'Rate', 'Min', 'Max', 'Action'],
          [['Default', '10%', '—', '—'], ['Electronics', '8%', '5%', '12%'], ['Fashion', '12%', '8%', '15%']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    emailTemplates() {
      return header('Email templates', 'Utilities / Email') +
        box('Templates', table(['Name', 'Subject', 'Action'],
          [['Order confirmation', 'Your order #{order_id}'], ['Welcome merchant', 'Welcome to Mplace'], ['Password reset', 'Reset your password']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    pdfTemplates() { return emptyPage('PDF templates', '📄', 'Invoice and packing slip templates.'); },
    pages() {
      return header('Pages', 'Utilities / Pages') +
        box('CMS Pages', table(['Title', 'Slug', 'Status', 'Action'],
          [['About Us', 'about', 'Active'], ['Terms', 'terms', 'Active'], ['Privacy', 'privacy', 'Active'], ['Contact', 'contact', 'Active']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>/${r[1]}</td><td><span class="${statusClass(r[2])}">${r[2]}</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    blogs() {
      return header('Blogs', 'Utilities / Blogs') +
        box('Blog posts', table(['Title', 'Author', 'Date', 'Status', 'Action'],
          [['How multi-vendor works', 'Admin', '2024-01-12', 'Published'], ['Seller tips', 'Admin', '2024-02-03', 'Draft']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><span class="${statusClass(r[3])}">${r[3]}</span></td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    faqs() {
      return header('Faqs', 'Utilities / Faqs') +
        box('FAQ entries', table(['Question', 'Category', 'Action'],
          [['How do I become a seller?', 'Selling'], ['How are commissions calculated?', 'Payments'], ['How to track my order?', 'Orders']].map((r, i) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${actions(i + 1)}</td></tr>`
          ).join('')));
    },
    reportPayouts() { return emptyPage('Payout Report', '📈', 'Payout analytics report.'); },
    async reportKpi() {
      try {
        const s = await Api.reportsSummary();
        return header('Reports') + `
          <div class="stat-row">
            <div class="stat-card bg-primary-g"><h4>GMV</h4><div class="num">${fmtCents(s.gmvCents)}</div><div class="sub">Paid orders</div></div>
            <div class="stat-card bg-success-g"><h4>Orders</h4><div class="num">${s.paidOrders}</div><div class="sub">Excl. pending/cancel</div></div>
            <div class="stat-card bg-info-g"><h4>Shops</h4><div class="num">${s.activeShops}</div><div class="sub">Active</div></div>
            <div class="stat-card bg-danger-g"><h4>Payouts</h4><div class="num">${s.pendingPayouts}</div><div class="sub">Pending</div></div>
          </div>
          ${box('Products', `<p>Active products: <strong>${s.activeProducts}</strong></p>`, '', 'primary')}`;
      } catch (e) {
        return header('Reports') + box('API', `<p class="text-danger">${e.message}</p>`);
      }
    },
    reportPayments() {
      return header('Sales · Payments', 'Reports / Sales') +
        box('Payment Methods', table(['Method', 'Transactions', 'Volume', 'Share'],
          [['Credit Card', 28, 18200, '45%'], ['PayPal', 12, 9400, '23%'], ['Wallet', 8, 6100, '15%'], ['COD', 15, 6900, '17%']].map(r =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${fmtMoney(r[2])}</td><td>${r[3]}</td></tr>`
          ).join('')));
    }
  };

  function renderMenu(activePage) {
    const nav = $('#sidebarMenu');
    nav.innerHTML = MENU().map(item => {
      if (item.children) {
        const open = item.children.some(c => c.page === activePage);
        const childActive = (c) => c.page === activePage ? 'active' : '';
        return `<li class="treeview ${open ? 'open' : ''}">
          <a href="javascript:void(0)" class="tree-toggle"><span class="icon">${item.icon}</span> ${item.label}<span class="arrow">▶</span></a>
          <ul class="treeview-menu">
            ${item.children.map(c => `<li class="${childActive(c)}"><a href="#${c.page}">${c.label}</a></li>`).join('')}
          </ul>
        </li>`;
      }
      const active = item.page === activePage ? 'active' : '';
      return `<li class="${active}"><a href="#${item.page}"><span class="icon">${item.icon}</span> ${item.label}</a></li>`;
    }).join('');
  }

  async function route() {
    const page = (location.hash.replace('#', '') || 'dashboard');
    const fn = pages[page] || (() => emptyPage(page, '📄', 'This section is available as a UI shell.'));
    $('#content').innerHTML = `<div class="page-placeholder"><p>${I ? I.t('admin.loading') : 'Loading…'}</p></div>`;
    renderMenu(page);
    try {
      const html = await fn();
      $('#content').innerHTML = html;
    } catch (e) {
      const msg = (typeof escapeHtml === 'function' ? escapeHtml : String)(e.message || e);
      $('#content').innerHTML = header(page) + box('Error', `<p class="text-danger">${msg}</p>`);
    }
    bindPageEvents();
    $('#content').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function bindPageEvents() {
    $$('[data-table-search]').forEach(input => {
      input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        const table = input.closest('.content')?.querySelector('.data-table tbody') || $('#content .data-table tbody');
        if (!table) return;
        $$('tr', table).forEach(tr => {
          tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    });

    $('#content').onclick = async (e) => {
      const btn = e.target.closest('[data-act]');
      if (btn) {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        if (act === 'del') {
          if (!confirm('Delete this item?')) return;
          const page = location.hash.replace('#', '') || 'dashboard';
          if (page === 'products' && Api) {
            try {
              await Api.deleteProduct(id);
              toast('Product deleted');
              route();
            } catch (ex) {
              toast(ex.message || 'Delete failed', 'error');
            }
          } else {
            btn.closest('tr')?.remove();
            toast('Deleted (local)');
          }
        } else if (act === 'edit') toast('Edit form (next iteration)');
        else toast('View details');
        return;
      }
      const open = e.target.closest('[data-open-modal]');
      if (open) openModal(open.dataset.openModal);
    };

    $$('#settingsTabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('#settingsTabs .tab').forEach(t => t.classList.remove('active'));
        $$('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $(`.tab-panel[data-panel="${tab.dataset.tab}"]`)?.classList.add('active');
      });
    });

    $$('[data-order-status]').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await Api.updateOrderStatus(sel.dataset.orderStatus, sel.value);
          toast('Order status updated');
          route();
        } catch (ex) {
          toast(ex.message || 'Failed', 'error');
          route();
        }
      });
    });

    $$('[data-shop-status]').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          const status = sel.value;
          let rejectionReason;
          if (status === 'REJECTED') {
            rejectionReason = prompt('Причина отклонения') || '';
            if (!rejectionReason) { route(); return; }
          }
          await Api.updateShopStatus(sel.dataset.shopStatus, status, rejectionReason);
          toast('Shop status updated');
          route();
        } catch (ex) {
          toast(ex.message || 'Failed', 'error');
          route();
        }
      });
    });

    $$('[data-payout]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Api.decidePayout(btn.dataset.payout, btn.dataset.decision);
          toast('Payout updated');
          route();
        } catch (ex) {
          toast(ex.message || 'Failed', 'error');
        }
      });
    });
  }

  async function openModal(type) {
    const titles = { product: 'Add Product', customer: 'Add Customer', category: 'Add Category' };
    let shopOptions = '<option value="">Loading shops…</option>';
    // Admin needs shopId — use first product's shop or seed shop from merchant product list
    try {
      const products = cache.products || (await Api.products());
      cache.products = products;
      const shops = {};
      products.forEach((p) => {
        if (p.shop?.id) shops[p.shop.id] = p.shop.name;
      });
      const entries = Object.entries(shops);
      shopOptions = entries.length
        ? entries.map(([id, name]) => `<option value="${id}">${name}</option>`).join('')
        : '<option value="">No shop — seed DB first</option>';
    } catch {
      shopOptions = '<option value="">API offline</option>';
    }

    const fields = {
      product: `
        <div class="form-row">
          <div class="form-group"><label>Name</label><input class="form-control" id="m_name" /></div>
          <div class="form-group"><label>Price</label><input class="form-control" type="number" id="m_price" step="0.01" value="9.99" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Shop</label><select class="form-control" id="m_shop">${shopOptions}</select></div>
          <div class="form-group"><label>Stock</label><input class="form-control" type="number" id="m_stock" value="10" /></div>
        </div>
        <div class="form-group"><label>Status</label>
          <select class="form-control" id="m_status"><option value="ACTIVE">ACTIVE</option><option value="DRAFT">DRAFT</option></select>
        </div>`,
      customer: `
        <div class="form-group"><label>Name</label><input class="form-control" id="m_name" /></div>
        <div class="form-group"><label>Email</label><input class="form-control" type="email" id="m_email" /></div>`,
      category: `
        <div class="form-group"><label>Name</label><input class="form-control" id="m_name" /></div>`
    };
    $('#modalTitle').textContent = titles[type] || 'Form';
    $('#modalBody').innerHTML = fields[type] || '<p>Demo form</p>';
    $('#modalOverlay').classList.add('show');
    $('#modalSave').onclick = async () => {
      try {
        if (type === 'product') {
          await Api.createProduct({
            name: $('#m_name').value,
            price: Number($('#m_price').value),
            stock: Number($('#m_stock').value),
            shopId: $('#m_shop').value,
            status: $('#m_status').value,
          });
          toast('Product created');
          $('#modalOverlay').classList.remove('show');
          location.hash = '#products';
          route();
          return;
        }
        if (type === 'category') {
          await fetch(Api.getBase() + '/categories', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + Api.getToken(),
            },
            body: JSON.stringify({ name: $('#m_name').value }),
          }).then(async (r) => {
            if (!r.ok) throw new Error((await r.json()).message || 'Failed');
          });
          toast('Category created');
          $('#modalOverlay').classList.remove('show');
          location.hash = '#categories';
          route();
          return;
        }
        toast((titles[type] || 'Item') + ' saved (demo)');
        $('#modalOverlay').classList.remove('show');
      } catch (ex) {
        toast(ex.message || 'Save failed', 'error');
      }
    };
  }

  // Init chrome
  $('#userName').textContent = user.name;
  $('#userAvatar').textContent = user.name.charAt(0);
  const modalCancel = $('#modalCancel');
  if (modalCancel) modalCancel.onclick = () => $('#modalOverlay').classList.remove('show');
  $('#logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (Api) Api.clearSession();
    else {
      sessionStorage.removeItem('mplace_user');
      sessionStorage.removeItem('mplace_token');
    }
    location.href = '../login.html';
  });
  $('#toggleSidebar').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });
  $('#sidebarMenu').addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-toggle');
    if (toggle) {
      e.preventDefault();
      toggle.closest('.treeview').classList.toggle('open');
    }
  });
  $('#modalClose').addEventListener('click', () => $('#modalOverlay').classList.remove('show'));
  $('#modalOverlay').addEventListener('click', (e) => {
    if (e.target === $('#modalOverlay')) $('#modalOverlay').classList.remove('show');
  });

  window.addEventListener('hashchange', route);
  window.AdminApp = { toast, route };
  route();
})();
