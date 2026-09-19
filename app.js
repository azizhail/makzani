const app = document.getElementById('app');
const STORAGE_KEY = 'makhzani-products';
const SALES_KEY = 'makhzani-sales';
const PURCHASES_KEY = 'makhzani-purchases';
const EXPENSES_KEY = 'makhzani-expenses';
const CASHFLOW_KEY = 'makhzani-cashflow';
const CUSTOMERS_KEY = 'makhzani-customers';
const SUPPLIERS_KEY = 'makhzani-suppliers';
const SESSION_KEY = 'makhzani-session';
const CREDENTIALS_KEY = 'makhzani-credentials';
const DEFAULT_CREDENTIALS = { username: '', password: '' };
const SUPABASE_READY = Boolean(window.makhzaniSupabase);
let credentials = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || 'null') || DEFAULT_CREDENTIALS;
let currentView = 'dashboard';

let products = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || [
  { id: 1, name: 'قهوة عربية فاخرة', sku: 'COF-001', category: 'مشروبات', price: 48, stock: 18, threshold: 10 },
  { id: 2, name: 'أكواب ورقية 8 أونصة', sku: 'CUP-008', category: 'مستلزمات', price: 22, stock: 6, threshold: 10 },
  { id: 3, name: 'تمر سكري فاخر', sku: 'DAT-014', category: 'مواد غذائية', price: 35, stock: 42, threshold: 12 }
];
let sales = JSON.parse(localStorage.getItem(SALES_KEY) || 'null') || [];
let purchases = JSON.parse(localStorage.getItem(PURCHASES_KEY) || 'null') || [];
let expenses = JSON.parse(localStorage.getItem(EXPENSES_KEY) || 'null') || [];
let cashFlow = JSON.parse(localStorage.getItem(CASHFLOW_KEY) || 'null') || [];
let customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || 'null') || [
  { id: 1, name: 'سارة علي', phone: '966500123456', city: 'الرياض', totalOrders: 3 },
  { id: 2, name: 'أحمد محمد', phone: '966500987654', city: 'جدة', totalOrders: 5 }
];
let suppliers = JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || 'null') || [
  { id: 1, name: 'شركة النخيل', phone: '966500111222', category: 'مواد غذائية', balance: 12000 },
  { id: 2, name: 'مؤسسة الندى', phone: '966500444555', category: 'مشروبات', balance: 9800 }
];
let editingId = null;

async function loadCloudDataIfAvailable() {
  if (!SUPABASE_READY || !window.makhzaniSupabase) return;

  try {
    const { data: { session } } = await window.makhzaniSupabase.auth.getSession();
    if (!session) return;

    const cloudData = await window.loadShopData();
    if (cloudData.products?.length) products = cloudData.products.map(item => ({ ...item, id: Number(item.id) || item.id }));
    if (cloudData.sales?.length) sales = cloudData.sales.map(item => ({ ...item, id: Number(item.id) || item.id }));
    if (cloudData.purchases?.length) purchases = cloudData.purchases.map(item => ({ ...item, id: Number(item.id) || item.id }));
    if (cloudData.expenses?.length) expenses = cloudData.expenses.map(item => ({ ...item, id: Number(item.id) || item.id }));
    if (cloudData.cash_flow?.length) cashFlow = cloudData.cash_flow.map(item => ({ ...item, id: Number(item.id) || item.id }));
    if (cloudData.customers?.length) customers = cloudData.customers.map(item => ({ ...item, id: Number(item.id) || item.id }));
    if (cloudData.suppliers?.length) suppliers = cloudData.suppliers.map(item => ({ ...item, id: Number(item.id) || item.id }));
  } catch (error) {
    console.warn('Cloud sync unavailable. Falling back to local data.', error);
  }
}

async function persistCloudTable(tableName, rows) {
  if (!SUPABASE_READY || !window.makhzaniSupabase) return;
  try {
    const { data: { session } } = await window.makhzaniSupabase.auth.getSession();
    if (!session) return;
    const shopId = await window.getCurrentShopId();
    if (!shopId) return;
    const mappedRows = rows.map(row => ({ ...row, shop_id: shopId, id: row.id ?? crypto.randomUUID?.() ?? Date.now() }));
    const { error } = await window.makhzaniSupabase.from(tableName).upsert(mappedRows, { onConflict: 'id' });
    if (error) console.error(`Supabase write failed for ${tableName}:`, error);
  } catch (error) {
    console.warn('Supabase persistence failed. Local data remains available.', error);
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  persistCloudTable('products', products);
}
function saveSales() {
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  persistCloudTable('sales', sales);
}
function savePurchases() {
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
  persistCloudTable('purchases', purchases);
}
function saveExpenses() {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  persistCloudTable('expenses', expenses);
}
function saveCashFlow() {
  localStorage.setItem(CASHFLOW_KEY, JSON.stringify(cashFlow));
  persistCloudTable('cash_flow', cashFlow);
}
function saveCustomers() {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  persistCloudTable('customers', customers);
}
function saveSuppliers() {
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
  persistCloudTable('suppliers', suppliers);
}
function saveCredentials() { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); }
function money(value) { return `${Number(value).toFixed(2)} ر.س`; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char])); }
function isLow(product) { return Number(product.stock) <= Number(product.threshold); }
function formatDateTime(value) { return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function getSalesSummary() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todaySales = sales.filter(sale => new Date(sale.date) >= todayStart);
  const monthSales = sales.filter(sale => new Date(sale.date) >= monthStart);
  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const monthRevenue = monthSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const salesCount = sales.length;
  const receivables = sales.filter(sale => Number(sale.total) > Number(sale.paid || 0)).reduce((sum, sale) => sum + (Number(sale.total) - Number(sale.paid || 0)), 0);

  const productMap = new Map();
  sales.forEach(sale => {
    const prev = productMap.get(sale.productName) || { name: sale.productName, qty: 0, revenue: 0 };
    prev.qty += Number(sale.quantity);
    prev.revenue += Number(sale.total);
    productMap.set(sale.productName, prev);
  });

  const totalCost = purchases.reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const totalCashIn = cashFlow.filter(item => item.type === 'إيداع').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalCashOut = cashFlow.filter(item => item.type === 'سحب').reduce((sum, item) => sum + Number(item.amount), 0);
  const netCash = totalCashIn - totalCashOut;
  const profit = totalRevenue - totalCost - totalExpenses;
  const topProduct = [...productMap.values()].sort((a, b) => b.qty - a.qty)[0];

  return { totalRevenue, todayRevenue, monthRevenue, salesCount, totalCost, totalExpenses, totalCashIn, totalCashOut, netCash, profit, topProduct, receivables };
}

function getMonthlySalesReport() {
  const map = new Map();
  sales.forEach(sale => {
    const date = new Date(sale.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(date);
    if (!map.has(key)) map.set(key, { key, label, total: 0, count: 0 });
    map.get(key).total += Number(sale.total);
    map.get(key).count += 1;
  });
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function renderLogin() {
  app.innerHTML = `<section class="login-shell">
    <div class="login-art">
      <div class="brand"><span class="brand-mark">م</span><span>مخزني</span></div>
      <div class="login-copy">
        <p class="eyebrow" style="color:#bce5ca">إدارة مبيعات أهدأ</p>
        <h1>كل صنف في مكانه الصحيح.</h1>
        <p>تابع منتجاتك، أسعارك، وكميات المخزون من لوحة واحدة واضحة وسريعة.</p>
        <div class="login-points"><span><b>✓</b> تنبيه فوري عند انخفاض المخزون</span><span><b>✓</b> بياناتك محفوظة على جهازك</span></div>
      </div>
    </div>
    <div class="login-panel"><form class="login-card" id="login-form">
      <h2>تسجيل الدخول</h2><p class="lead">أدخل بيانات الحساب للوصول إلى لوحة المبيعات</p>
      <div class="field"><label for="username">البريد الإلكتروني</label><input id="username" type="email" autocomplete="email" required placeholder="name@example.com" /></div>
      <div class="field"><label for="password">الرقم السري</label><input id="password" type="password" autocomplete="current-password" required placeholder="اكتب الرقم السري" /></div>
      <div class="error" id="login-error"></div><button class="primary" type="submit">دخول إلى لوحة التحكم</button>
      <button class="ghost" id="request-invite" type="button">طلب دعوة لاستخدام التطبيق</button>
    </form></div>
  </section>`;
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const error = document.getElementById('login-error');
    if (!window.makhzaniSupabase) {
      error.textContent = 'تعذر الاتصال بخدمة تسجيل الدخول.';
      return;
    }
    const { data, error: authError } = await window.makhzaniSupabase.auth.signInWithPassword({ email: username, password });
    if (authError) {
      error.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      return;
    }
    localStorage.setItem(SESSION_KEY, data.user.email);
    await loadCloudDataIfAvailable();
    renderDashboard();
  });
  document.getElementById('request-invite').addEventListener('click', () => openInviteRequestModal());
}

function openInviteRequestModal() {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>طلب دعوة</h2><button class="close" id="close-invite-request" type="button">×</button></div>
    <form id="invite-request-form">
      <div class="field"><label for="request-name">اسمك</label><input id="request-name" required /></div>
      <div class="field"><label for="request-shop">اسم المتجر</label><input id="request-shop" required /></div>
      <div class="field"><label for="request-email">بريدك الإلكتروني</label><input id="request-email" type="email" required /></div>
      <div class="error" id="invite-request-error"></div>
      <div class="modal-actions"><button class="ghost" id="cancel-invite-request" type="button">إلغاء</button><button class="primary" type="submit">إرسال الطلب</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelector('#close-invite-request').addEventListener('click', close);
  wrapper.querySelector('#cancel-invite-request').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });
  wrapper.querySelector('#invite-request-form').addEventListener('submit', async event => {
    event.preventDefault();
    const error = wrapper.querySelector('#invite-request-error');
    const button = wrapper.querySelector('button[type="submit"]');
    button.disabled = true;
    const result = await window.requestShopInvite?.({
      name: wrapper.querySelector('#request-name').value.trim(),
      shopName: wrapper.querySelector('#request-shop').value.trim(),
      email: wrapper.querySelector('#request-email').value.trim()
    });
    if (!result?.ok) {
      error.textContent = result?.message || 'تعذر إرسال الطلب. حاول مرة أخرى.';
      button.disabled = false;
      return;
    }
    wrapper.querySelector('form').innerHTML = '<p class="lead">تم إرسال طلبك. سيصلك رابط الدعوة بعد موافقة الإدارة.</p><div class="modal-actions"><button class="primary" type="button" id="done-invite-request">إغلاق</button></div>';
    wrapper.querySelector('#done-invite-request').addEventListener('click', close);
  });
}

function renderDashboard() {
  const now = new Date();
  const lowCount = products.filter(isLow).length;
  const totalUnits = products.reduce((sum, product) => sum + Number(product.stock), 0);
  const summary = getSalesSummary();
  const topProductLabel = summary.topProduct ? `${summary.topProduct.name} (${summary.topProduct.qty} وحدة)` : 'لا توجد مبيعات';

  app.innerHTML = `<section class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">م</span><span>مخزني</span></div>
      <nav class="main-nav" aria-label="التنقل بين الأقسام">
        <button class="nav-btn ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">لوحة التحكم</button>
        <button class="nav-btn ${currentView === 'sales' ? 'active' : ''}" data-view="sales">المبيعات</button>
        <button class="nav-btn ${currentView === 'receivables' ? 'active' : ''}" data-view="receivables">الذمم</button>
        <button class="nav-btn ${currentView === 'purchases' ? 'active' : ''}" data-view="purchases">المشتريات</button>
        <button class="nav-btn ${currentView === 'expenses' ? 'active' : ''}" data-view="expenses">المصروفات</button>
        <button class="nav-btn ${currentView === 'cashflow' ? 'active' : ''}" data-view="cashflow">النقدية</button>
        <button class="nav-btn ${currentView === 'customers' ? 'active' : ''}" data-view="customers">العملاء</button>
        <button class="nav-btn ${currentView === 'suppliers' ? 'active' : ''}" data-view="suppliers">الموردين</button>
        <button class="nav-btn ${currentView === 'reports' ? 'active' : ''}" data-view="reports">التقارير</button>
      </nav>
      <div class="topbar-actions">
        <div class="user-chip"><span>مرحبًا، ${escapeHtml(localStorage.getItem(SESSION_KEY) || credentials.username)}</span><span class="avatar">م</span></div>
        <button class="ghost" id="account">الحساب</button>
        <button class="ghost" id="invoice-btn">الفاتورة</button>
        <button class="ghost" id="logout">خروج</button>
      </div>
    </header>
    <div class="content">
      ${currentView === 'dashboard' ? `
        <div class="page-heading">
          <div>
            <p class="eyebrow">لوحة التحكم</p>
            <h1>إدارة الأصناف والمخزون</h1>
            <p>أضف منتجاتك وتابع الكميات قبل نفادها.</p>
          </div>
          <div class="action-stack">
            <button class="add-button" id="add-product">+ إضافة صنف</button>
            <button class="secondary-button" id="new-purchase">+ تسجيل شراء</button>
            <button class="secondary-button" id="new-sale">+ تسجيل مبيع</button>
          </div>
        </div>
        ${lowCount ? `<div class="alert-box"><span class="alert-icon">!</span><p><strong>تنبيه المخزون:</strong> يوجد ${lowCount} ${lowCount === 1 ? 'صنف' : 'أصناف'} وصلت إلى حد التنبيه أو أقل. راجع الكميات الآن.</p></div>` : ''}
        <div class="stats">
          <div class="stat"><p>إجمالي الأصناف</p><strong>${products.length}</strong></div>
          <div class="stat"><p>إجمالي الوحدات</p><strong>${totalUnits}</strong></div>
          <div class="stat alert"><p>تحتاج متابعة</p><strong>${lowCount}</strong></div>
          <div class="stat"><p>صافي الربح</p><strong>${money(summary.profit)}</strong></div>
        </div>
        <section class="report-grid">
          <div class="report-card"><span>إجمالي المبيعات</span><strong>${money(summary.totalRevenue)}</strong><small>كل المبيعات المسجلة</small></div>
          <div class="report-card"><span>إجمالي المشتريات</span><strong>${money(summary.totalCost)}</strong><small>كل المشتريات</small></div>
          <div class="report-card"><span>إجمالي المصروفات</span><strong>${money(summary.totalExpenses)}</strong><small>كل النفقات</small></div>
          <div class="report-card"><span>صافي النقدية</span><strong>${money(summary.netCash)}</strong><small>إيداعات - مسحوبات</small></div>
        </section>
        <section class="table-section">
          <div class="table-head"><h2>قائمة الأصناف</h2><input class="search" id="search" placeholder="بحث بالاسم أو الرمز..." /></div>
          <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>التصنيف</th><th>السعر</th><th>الكمية الحالية</th><th>حد التنبيه</th><th>إجراء</th></tr></thead><tbody id="product-rows"></tbody></table></div>
        </section>
        <section class="table-section sales-panel">
          <div class="table-head"><h2>آخر المبيعات</h2><span class="sales-total">إجمالي المبيعات: ${money(summary.totalRevenue)}</span></div>
          <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th><th>الوقت</th></tr></thead><tbody id="sales-rows"></tbody></table></div>
        </section>
        <section class="table-section sales-panel">
          <div class="table-head"><h2>آخر المشتريات</h2><span class="sales-total">إجمالي المشتريات: ${money(summary.totalCost)}</span></div>
          <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>المورد</th><th>الكمية</th><th>الإجمالي</th><th>الوقت</th></tr></thead><tbody id="purchases-rows"></tbody></table></div>
        </section>
      ` : ''}
      ${currentView === 'sales' ? renderSalesView() : ''}
      ${currentView === 'receivables' ? renderReceivablesView() : ''}
      ${currentView === 'purchases' ? renderPurchasesView() : ''}
      ${currentView === 'expenses' ? renderExpensesView() : ''}
      ${currentView === 'cashflow' ? renderCashFlowView() : ''}
      ${currentView === 'customers' ? renderCustomersView() : ''}
      ${currentView === 'suppliers' ? renderSuppliersView() : ''}
      ${currentView === 'reports' ? renderReportsView() : ''}
    </div>
  </section>`;

  document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    if (window.makhzaniSupabase) window.makhzaniSupabase.auth.signOut();
    renderLogin();
  });
  document.getElementById('account').addEventListener('click', openAccountModal);
  document.getElementById('invoice-btn').addEventListener('click', openInvoiceModal);
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      currentView = button.dataset.view;
      renderDashboard();
    });
  });

  if (currentView === 'dashboard') {
    document.getElementById('add-product').addEventListener('click', () => openModal());
    document.getElementById('new-purchase').addEventListener('click', () => openPurchaseModal());
    document.getElementById('new-sale').addEventListener('click', () => openSaleModal());
    document.getElementById('search').addEventListener('input', event => renderRows(event.target.value));
    renderRows();
    renderSalesRows();
    renderPurchaseRows();
  }

  if (currentView === 'sales') {
    const addBtn = document.getElementById('add-sale');
    if (addBtn) addBtn.addEventListener('click', () => openSaleModal());
    const deleteButtons = document.querySelectorAll('[data-sale-delete]');
    deleteButtons.forEach(button => {
      button.addEventListener('click', () => deleteSale(Number(button.dataset.saleDelete)));
    });
  }

  if (currentView === 'receivables') {
    const payButtons = document.querySelectorAll('[data-receivable-pay]');
    payButtons.forEach(button => {
      button.addEventListener('click', () => payReceivable(Number(button.dataset.receivablePay)));
    });
  }

  if (currentView === 'purchases') {
    renderPurchaseRows(true);
    const addBtn = document.getElementById('add-purchase');
    if (addBtn) addBtn.addEventListener('click', () => openPurchaseModal());
  }

  if (currentView === 'expenses') {
    renderExpenseRows();
    const addBtn = document.getElementById('add-expense');
    if (addBtn) addBtn.addEventListener('click', () => openExpenseModal());
  }

  if (currentView === 'cashflow') {
    renderCashFlowRows();
    const addBtn = document.getElementById('add-cashflow');
    if (addBtn) addBtn.addEventListener('click', () => openCashFlowModal());
  }

  if (currentView === 'customers') {
    renderCustomerRows();
    const addBtn = document.getElementById('add-customer');
    if (addBtn) addBtn.addEventListener('click', () => openCustomerModal());
  }

  if (currentView === 'suppliers') {
    renderSupplierRows();
    const addBtn = document.getElementById('add-supplier');
    if (addBtn) addBtn.addEventListener('click', () => openSupplierModal());
  }

  if (currentView === 'reports') {
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.addEventListener('click', exportDataAsCsv);
    renderReportsContent();
  }
}

function renderDashboardView() {
  return '';
}

function renderSalesView() {
  const summary = getSalesSummary();
  const latestSales = sales.slice(0, 20);
  const salesRows = latestSales.length ? latestSales.map(sale => `
    <tr>
      <td><div class="product-name">${escapeHtml(sale.productName)}</div><div class="sku">${escapeHtml(sale.sku)}</div></td>
      <td>${sale.quantity}</td>
      <td>${money(sale.price)}</td>
      <td>${money(sale.total)}</td>
      <td>${sale.paid ? money(sale.paid) : '0.00 ر.س'}</td>
      <td>${sale.note ? escapeHtml(sale.note) : '—'}</td>
      <td>${formatDateTime(sale.date)}</td>
      <td><button class="action delete" data-sale-delete="${sale.id}">حذف</button></td>
    </tr>
  `).join('') : '<tr><td colspan="8"><div class="empty">لا توجد مبيعات مسجلة حتى الآن.</div></td></tr>';

  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">المبيعات</p>
          <h2>سجل المبيعات</h2>
        </div>
        <button class="add-button" id="add-sale">+ تسجيل مبيع</button>
      </div>
      <div class="report-grid report-grid-full">
        <div class="report-card"><span>إجمالي المبيعات</span><strong>${money(summary.totalRevenue)}</strong><small>كل الإيرادات</small></div>
        <div class="report-card"><span>إيراد اليوم</span><strong>${money(summary.todayRevenue)}</strong><small>مبيعات اليوم</small></div>
        <div class="report-card"><span>المبالغ المستحقة</span><strong>${money(summary.receivables)}</strong><small>مستحقات العملاء</small></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th>المدفوع</th><th>ملاحظات</th><th>التاريخ</th><th>إجراء</th></tr>
          </thead>
          <tbody id="sales-list-rows">${salesRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderReceivablesView() {
  const payableSales = sales.filter(sale => Number(sale.total) > Number(sale.paid || 0));
  const rows = payableSales.length ? payableSales.map(sale => {
    const due = Number(sale.total) - Number(sale.paid || 0);
    return `
      <tr>
        <td>${escapeHtml(sale.productName)}</td>
        <td>${sale.quantity}</td>
        <td>${money(sale.total)}</td>
        <td>${money(sale.paid || 0)}</td>
        <td>${money(due)}</td>
        <td>${formatDateTime(sale.date)}</td>
        <td><button class="action" data-receivable-pay="${sale.id}">تسديد</button></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="7"><div class="empty">لا توجد مديونيات حالياً.</div></td></tr>';

  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">الذمم</p>
          <h2>مستحقات العملاء</h2>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>التاريخ</th><th>إجراء</th></tr>
          </thead>
          <tbody id="receivables-rows">${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPurchasesView() {
  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">المشتريات</p>
          <h2>سجل المشتريات</h2>
        </div>
        <button class="add-button" id="add-purchase">+ تسجيل شراء</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>الصنف</th><th>المورد</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th><th>التاريخ</th></tr>
          </thead>
          <tbody id="purchase-rows"></tbody>
        </table>
      </div>
    </section>
  `;
}

function renderExpensesView() {
  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">المصروفات</p>
          <h2>سجل المصروفات والنفقات</h2>
        </div>
        <button class="add-button" id="add-expense">+ إضافة مصروف</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>التاريخ</th><th>إجراء</th></tr>
          </thead>
          <tbody id="expense-rows"></tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCashFlowView() {
  const summary = getSalesSummary();
  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">النقدية</p>
          <h2>إدارة النقدية داخل المحل</h2>
        </div>
        <button class="add-button" id="add-cashflow">+ إضافة حركة نقدية</button>
      </div>
      <div class="report-grid report-grid-full">
        <div class="report-card"><span>إيداعات</span><strong>${money(summary.totalCashIn)}</strong><small>إجمالي الإيداعات</small></div>
        <div class="report-card"><span>مسحوبات</span><strong>${money(summary.totalCashOut)}</strong><small>إجمالي المسحوبات</small></div>
        <div class="report-card"><span>صافي النقدية</span><strong>${money(summary.netCash)}</strong><small>الحالة الحالية</small></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>نوع الحركة</th><th>الوصف</th><th>المبلغ</th><th>التاريخ</th><th>إجراء</th></tr>
          </thead>
          <tbody id="cashflow-rows"></tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCustomersView() {
  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">العملاء</p>
          <h2>قاعدة العملاء</h2>
        </div>
        <button class="add-button" id="add-customer">+ إضافة عميل</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>الاسم</th><th>الهاتف</th><th>المدينة</th><th>عدد الطلبات</th><th>إجراء</th></tr>
          </thead>
          <tbody id="customer-rows"></tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSuppliersView() {
  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">الموردين</p>
          <h2>قاعدة الموردين</h2>
        </div>
        <button class="add-button" id="add-supplier">+ إضافة مورد</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>الاسم</th><th>التصنيف</th><th>الهاتف</th><th>الرصيد</th><th>إجراء</th></tr>
          </thead>
          <tbody id="supplier-rows"></tbody>
        </table>
      </div>
    </section>
  `;
}

function exportDataAsCsv() {
  const rows = [
    ['المنتجات', 'اسم', 'الرمز', 'التصنيف', 'السعر', 'الكمية', 'حد التنبيه'],
    ...products.map(product => [
      'المنتجات',
      product.name,
      product.sku,
      product.category,
      product.price,
      product.stock,
      product.threshold
    ]),
    ['المبيعات', 'المنتج', 'الرمز', 'الكمية', 'السعر', 'الإجمالي', 'المدفوع', 'ملاحظات', 'التاريخ'],
    ...sales.map(sale => [
      'المبيعات',
      sale.productName,
      sale.sku,
      sale.quantity,
      sale.price,
      sale.total,
      sale.paid || 0,
      sale.note || '',
      sale.date
    ]),
    ['المشتريات', 'المنتج', 'المورد', 'الكمية', 'السعر', 'الإجمالي', 'التاريخ'],
    ...purchases.map(purchase => [
      'المشتريات',
      purchase.productName,
      purchase.supplierName || '',
      purchase.quantity,
      purchase.price,
      purchase.total,
      purchase.date
    ]),
    ['المصروفات', 'النوع', 'الوصف', 'المبلغ', 'التاريخ'],
    ...expenses.map(expense => [
      'المصروفات',
      expense.type,
      expense.note,
      expense.amount,
      expense.date
    ]),
    ['النقدية', 'النوع', 'الوصف', 'المبلغ', 'التاريخ'],
    ...cashFlow.map(item => [
      'النقدية',
      item.type,
      item.note,
      item.amount,
      item.date
    ])
  ];

  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `makhzani-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderReportsView() {
  const monthlyReport = getMonthlySalesReport();
  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const totalCost = purchases.reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const summary = getSalesSummary();
  const monthlyRows = monthlyReport.length ? monthlyReport.map(item => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${item.count}</td>
      <td>${money(item.total)}</td>
    </tr>
  `).join('') : '<tr><td colspan="3" class="empty-cell">لا توجد مبيعات مسجلة</td></tr>';

  return `
    <section class="panel-section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">التقارير</p>
          <h2>تقارير المبيعات والمخزون</h2>
        </div>
        <button class="ghost" id="export-csv">تصدير CSV</button>
      </div>
      <div class="report-grid report-grid-full">
        <div class="report-card"><span>إجمالي الإيراد</span><strong>${money(totalRevenue)}</strong><small>كل المبيعات</small></div>
        <div class="report-card"><span>إجمالي المشتريات</span><strong>${money(totalCost)}</strong><small>كل المشتريات</small></div>
        <div class="report-card"><span>صافي الربح</span><strong>${money(summary.profit)}</strong><small>إجمالي الربح</small></div>
        <div class="report-card"><span>الأكثر مبيعًا</span><strong>${escapeHtml(summary.topProduct ? summary.topProduct.name : 'لا توجد')}</strong><small>${summary.topProduct ? `${summary.topProduct.qty} وحدة` : 'بلا مبيعات'}</small></div>
      </div>
      <div class="table-section sales-panel">
        <div class="table-head"><h2>المبيعات الشهرية</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الشهر</th><th>عدد المبيعات</th><th>الإيراد</th></tr></thead>
            <tbody>${monthlyRows}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderReportsContent() {
  // no-op: view already renders HTML template.
}

function renderCustomerRows() {
  const rows = document.getElementById('customer-rows');
  if (!rows) return;
  rows.innerHTML = customers.length ? customers.map(customer => `
    <tr>
      <td>${escapeHtml(customer.name)}</td>
      <td>${escapeHtml(customer.phone)}</td>
      <td>${escapeHtml(customer.city)}</td>
      <td>${customer.totalOrders}</td>
      <td><div class="row-actions"><button class="action" data-customer-edit="${customer.id}">تعديل</button><button class="action delete" data-customer-delete="${customer.id}">حذف</button></div></td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty">لا يوجد عملاء مسجلين.</div></td></tr>';

  rows.querySelectorAll('[data-customer-edit]').forEach(button => {
    button.addEventListener('click', () => openCustomerModal(Number(button.dataset.customerEdit)));
  });
  rows.querySelectorAll('[data-customer-delete]').forEach(button => {
    button.addEventListener('click', () => deleteCustomer(Number(button.dataset.customerDelete)));
  });
}

function renderSupplierRows() {
  const rows = document.getElementById('supplier-rows');
  if (!rows) return;
  rows.innerHTML = suppliers.length ? suppliers.map(supplier => `
    <tr>
      <td>${escapeHtml(supplier.name)}</td>
      <td>${escapeHtml(supplier.category)}</td>
      <td>${escapeHtml(supplier.phone)}</td>
      <td>${money(supplier.balance)}</td>
      <td><div class="row-actions"><button class="action" data-supplier-edit="${supplier.id}">تعديل</button><button class="action delete" data-supplier-delete="${supplier.id}">حذف</button></div></td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty">لا يوجد موردين مسجلين.</div></td></tr>';

  rows.querySelectorAll('[data-supplier-edit]').forEach(button => {
    button.addEventListener('click', () => openSupplierModal(Number(button.dataset.supplierEdit)));
  });
  rows.querySelectorAll('[data-supplier-delete]').forEach(button => {
    button.addEventListener('click', () => deleteSupplier(Number(button.dataset.supplierDelete)));
  });
}

function openAccountModal() {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><h2>إعدادات الحساب</h2><button class="close" id="close-account">×</button></div>
    <form id="account-form">
      <div class="field"><label for="account-username">اسم المستخدم</label><input id="account-username" required value="${escapeHtml(credentials.username)}" /></div>
      <div class="field"><label for="account-current-password">كلمة المرور الحالية</label><input id="account-current-password" type="password" required placeholder="أدخل كلمة المرور الحالية" /></div>
      <div class="field"><label for="account-new-password">كلمة المرور الجديدة</label><input id="account-new-password" type="password" minlength="4" required placeholder="أدخل كلمة المرور الجديدة" /></div>
      <div class="field"><label for="account-confirm-password">تأكيد كلمة المرور</label><input id="account-confirm-password" type="password" minlength="4" required placeholder="كرر كلمة المرور الجديدة" /></div>
      <div class="error" id="account-error"></div>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-account">إلغاء</button><button class="primary" type="submit">حفظ التغييرات</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);

  const close = () => wrapper.remove();
  wrapper.querySelector('#close-account').addEventListener('click', close);
  wrapper.querySelector('#cancel-account').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });

  wrapper.querySelector('#account-form').addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('account-error');
    const username = document.getElementById('account-username').value.trim();
    const currentPassword = document.getElementById('account-current-password').value;
    const newPassword = document.getElementById('account-new-password').value;
    const confirmPassword = document.getElementById('account-confirm-password').value;

    if (!username) { error.textContent = 'اسم المستخدم مطلوب.'; return; }
    if (currentPassword !== credentials.password) { error.textContent = 'كلمة المرور الحالية غير صحيحة.'; return; }
    if (newPassword.length < 4) { error.textContent = 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل.'; return; }
    if (newPassword !== confirmPassword) { error.textContent = 'تأكيد كلمة المرور غير متطابق.'; return; }

    credentials = { username, password: newPassword };
    saveCredentials();
    localStorage.setItem(SESSION_KEY, username);
    close();
    renderDashboard();
  });
}

function openCustomerModal(id = null) {
  const customer = id ? customers.find(item => item.id === id) : { name: '', phone: '', city: '', totalOrders: 0 };
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><h2>${id ? 'تعديل العميل' : 'إضافة عميل'}</h2><button class="close" id="close-customer">×</button></div>
    <form id="customer-form">
      <div class="field"><label for="customer-name">اسم العميل</label><input id="customer-name" required value="${escapeHtml(customer.name)}" /></div>
      <div class="field"><label for="customer-phone">الهاتف</label><input id="customer-phone" required value="${escapeHtml(customer.phone)}" /></div>
      <div class="field"><label for="customer-city">المدينة</label><input id="customer-city" required value="${escapeHtml(customer.city)}" /></div>
      <div class="field"><label for="customer-orders">عدد الطلبات</label><input id="customer-orders" type="number" min="0" value="${customer.totalOrders}" /></div>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-customer">إلغاء</button><button class="primary" type="submit">${id ? 'حفظ التعديل' : 'إضافة العميل'}</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelector('#close-customer').addEventListener('click', close);
  wrapper.querySelector('#cancel-customer').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });
  wrapper.querySelector('#customer-form').addEventListener('submit', event => {
    event.preventDefault();
    const item = {
      id: id || Date.now(),
      name: document.getElementById('customer-name').value.trim(),
      phone: document.getElementById('customer-phone').value.trim(),
      city: document.getElementById('customer-city').value.trim(),
      totalOrders: Number(document.getElementById('customer-orders').value || 0)
    };
    if (id) customers = customers.map(customer => customer.id === id ? item : customer);
    else customers.unshift(item);
    saveCustomers();
    close();
    renderDashboard();
  });
}

function openSupplierModal(id = null) {
  const supplier = id ? suppliers.find(item => item.id === id) : { name: '', phone: '', category: '', balance: 0 };
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><h2>${id ? 'تعديل المورد' : 'إضافة مورد'}</h2><button class="close" id="close-supplier">×</button></div>
    <form id="supplier-form">
      <div class="field"><label for="supplier-name">اسم المورد</label><input id="supplier-name" required value="${escapeHtml(supplier.name)}" /></div>
      <div class="field"><label for="supplier-category">التصنيف</label><input id="supplier-category" required value="${escapeHtml(supplier.category)}" /></div>
      <div class="field"><label for="supplier-phone">الهاتف</label><input id="supplier-phone" required value="${escapeHtml(supplier.phone)}" /></div>
      <div class="field"><label for="supplier-balance">الرصيد</label><input id="supplier-balance" type="number" min="0" value="${supplier.balance}" /></div>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-supplier">إلغاء</button><button class="primary" type="submit">${id ? 'حفظ التعديل' : 'إضافة المورد'}</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelector('#close-supplier').addEventListener('click', close);
  wrapper.querySelector('#cancel-supplier').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });
  wrapper.querySelector('#supplier-form').addEventListener('submit', event => {
    event.preventDefault();
    const item = {
      id: id || Date.now(),
      name: document.getElementById('supplier-name').value.trim(),
      category: document.getElementById('supplier-category').value.trim(),
      phone: document.getElementById('supplier-phone').value.trim(),
      balance: Number(document.getElementById('supplier-balance').value || 0)
    };
    if (id) suppliers = suppliers.map(supplier => supplier.id === id ? item : supplier);
    else suppliers.unshift(item);
    saveSuppliers();
    close();
    renderDashboard();
  });
}

function deleteCustomer(id) {
  const customer = customers.find(item => item.id === id);
  if (customer && confirm(`هل تريد حذف العميل "${customer.name}"؟`)) {
    customers = customers.filter(item => item.id !== id);
    saveCustomers();
    renderDashboard();
  }
}

function deleteSupplier(id) {
  const supplier = suppliers.find(item => item.id === id);
  if (supplier && confirm(`هل تريد حذف المورد "${supplier.name}"؟`)) {
    suppliers = suppliers.filter(item => item.id !== id);
    saveSuppliers();
    renderDashboard();
  }
}

function renderRows(query = '') {
  const rows = document.getElementById('product-rows');
  if (!rows) return;
  const filtered = products.filter(product => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase()));
  rows.innerHTML = filtered.length ? filtered.map(product => `<tr><td><div class="product-name">${escapeHtml(product.name)}</div><div class="sku">${escapeHtml(product.sku)}</div></td><td>${escapeHtml(product.category || 'عام')}</td><td class="price">${money(product.price)}</td><td><span class="stock ${isLow(product) ? 'low' : ''}">${product.stock} وحدة</span></td><td>${product.threshold} وحدة</td><td><div class="row-actions"><button class="action" data-edit="${product.id}">تعديل</button><button class="action delete" data-delete="${product.id}">حذف</button></div></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty">لا توجد أصناف مطابقة للبحث.</div></td></tr>';
  rows.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openModal(Number(button.dataset.edit))));
  rows.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteProduct(Number(button.dataset.delete))));
}

function renderSalesRows() {
  const rows = document.getElementById('sales-rows');
  if (!rows) return;
  const recentSales = sales.slice(0, 8);
  rows.innerHTML = recentSales.length ? recentSales.map(sale => `<tr><td><div class="product-name">${escapeHtml(sale.productName)}</div><div class="sku">${escapeHtml(sale.sku)}</div></td><td>${sale.quantity} وحدة</td><td class="price">${money(sale.total)}</td><td>${formatDateTime(sale.date)}</td></tr>`).join('') : '<tr><td colspan="4"><div class="empty">لا توجد مبيعات مسجلة حتى الآن.</div></td></tr>';
}

function renderPurchaseRows(isFullList = false) {
  const rows = document.getElementById('purchases-rows') || document.getElementById('purchase-rows');
  if (!rows) return;
  const recentPurchases = isFullList ? purchases.slice(0, 50) : purchases.slice(0, 8);
  rows.innerHTML = recentPurchases.length ? recentPurchases.map(purchase => `
    <tr>
      <td><div class="product-name">${escapeHtml(purchase.productName)}</div><div class="sku">${escapeHtml(purchase.sku)}</div></td>
      <td>${escapeHtml(purchase.supplierName || 'غير محدد')}</td>
      <td>${purchase.quantity} وحدة</td>
      <td class="price">${money(purchase.total)}</td>
      <td>${formatDateTime(purchase.date)}</td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty">لا توجد مشتريات مسجلة حتى الآن.</div></td></tr>';
}

function renderExpenseRows() {
  const rows = document.getElementById('expense-rows');
  if (!rows) return;
  rows.innerHTML = expenses.length ? expenses.map(expense => `
    <tr>
      <td>${escapeHtml(expense.type)}</td>
      <td>${escapeHtml(expense.note)}</td>
      <td class="price">${money(expense.amount)}</td>
      <td>${formatDateTime(expense.date)}</td>
      <td><button class="action delete" data-expense-delete="${expense.id}">حذف</button></td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty">لا توجد مصروفات مسجلة حتى الآن.</div></td></tr>';

  rows.querySelectorAll('[data-expense-delete]').forEach(button => {
    button.addEventListener('click', () => deleteExpense(Number(button.dataset.expenseDelete)));
  });
}

function renderCashFlowRows() {
  const rows = document.getElementById('cashflow-rows');
  if (!rows) return;
  rows.innerHTML = cashFlow.length ? cashFlow.map(item => `
    <tr>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.note)}</td>
      <td class="price">${money(item.amount)}</td>
      <td>${formatDateTime(item.date)}</td>
      <td><button class="action delete" data-cashflow-delete="${item.id}">حذف</button></td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty">لا توجد حركات نقدية مسجلة حتى الآن.</div></td></tr>';

  rows.querySelectorAll('[data-cashflow-delete]').forEach(button => {
    button.addEventListener('click', () => deleteCashFlow(Number(button.dataset.cashflowDelete)));
  });
}

function openPurchaseModal() {
  const supplierOptions = suppliers.length ? suppliers.map(supplier => `<option value="${supplier.id}">${escapeHtml(supplier.name)} — ${escapeHtml(supplier.category)}</option>`).join('') : '<option value="">لا توجد موردين</option>';
  const productOptions = products.length ? products.map(product => `<option value="${product.id}">${escapeHtml(product.name)} — ${product.stock} متبقي</option>`).join('') : '<option value="">لا توجد أصناف</option>';

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><h2>تسجيل شراء جديد</h2><button class="close" id="close-purchase">×</button></div>
    <form id="purchase-form">
      <div class="form-grid">
        <div class="field"><label for="purchase-product">الصنف</label><select id="purchase-product" required>${productOptions}</select></div>
        <div class="field"><label for="purchase-supplier">المورد</label><select id="purchase-supplier" required>${supplierOptions}</select></div>
        <div class="field"><label for="purchase-quantity">الكمية</label><input id="purchase-quantity" type="number" min="1" step="1" value="1" required /></div>
        <div class="field"><label for="purchase-price">سعر الوحدة (ر.س)</label><input id="purchase-price" type="number" min="0" step="0.01" value="0" required /></div>
      </div>
      <div class="error" id="purchase-error"></div>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-purchase">إلغاء</button><button class="primary" type="submit">تأكيد الشراء</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);

  const close = () => wrapper.remove();
  wrapper.querySelector('#close-purchase').addEventListener('click', close);
  wrapper.querySelector('#cancel-purchase').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });

  wrapper.querySelector('#purchase-form').addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('purchase-error');
    const productId = Number(document.getElementById('purchase-product').value);
    const supplierId = Number(document.getElementById('purchase-supplier').value);
    const quantity = Number(document.getElementById('purchase-quantity').value);
    const unitPrice = Number(document.getElementById('purchase-price').value);

    if (!products.length || !productId) { error.textContent = 'لا توجد أصناف متاحة للشراء.'; return; }
    if (!suppliers.length || !supplierId) { error.textContent = 'يجب اختيار مورد صالح.'; return; }
    if (!Number.isInteger(quantity) || quantity <= 0) { error.textContent = 'أدخل كمية صحيحة.'; return; }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) { error.textContent = 'أدخل سعر وحدة صحيح.'; return; }

    const product = products.find(item => item.id === productId);
    const supplier = suppliers.find(item => item.id === supplierId);
    if (!product || !supplier) { error.textContent = 'الصنف أو المورد غير موجود.'; return; }

    product.stock = Number(product.stock) + quantity;
    product.price = Number(product.price) || unitPrice;

    const purchase = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      supplierId: supplier.id,
      supplierName: supplier.name,
      quantity,
      price: unitPrice,
      total: unitPrice * quantity,
      date: new Date().toISOString()
    };

    purchases.unshift(purchase);
    supplier.balance = Number(supplier.balance) + purchase.total;
    saveProducts();
    savePurchases();
    saveSuppliers();
    close();
    renderDashboard();
  });
}

function openExpenseModal() {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><h2>إضافة مصروف جديد</h2><button class="close" id="close-expense">×</button></div>
    <form id="expense-form">
      <div class="form-grid">
        <div class="field"><label for="expense-type">نوع المصروف</label>
          <select id="expense-type" required>
            <option value="إيجار">إيجار</option>
            <option value="مشتريات">مشتريات</option>
            <option value="رواتب">رواتب</option>
            <option value="كهرباء">كهرباء</option>
            <option value="صيانة">صيانة</option>
            <option value="أخرى">أخرى</option>
          </select>
        </div>
        <div class="field"><label for="expense-amount">المبلغ (ر.س)</label><input id="expense-amount" type="number" min="0" step="0.01" value="0" required /></div>
        <div class="field full"><label for="expense-note">الوصف</label><input id="expense-note" maxlength="120" placeholder="مثل: فاتورة كهرباء شهرية" required /></div>
      </div>
      <div class="error" id="expense-error"></div>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-expense">إلغاء</button><button class="primary" type="submit">حفظ المصروف</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);

  const close = () => wrapper.remove();
  wrapper.querySelector('#close-expense').addEventListener('click', close);
  wrapper.querySelector('#cancel-expense').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });

  wrapper.querySelector('#expense-form').addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('expense-error');
    const type = document.getElementById('expense-type').value.trim();
    const amount = Number(document.getElementById('expense-amount').value);
    const note = document.getElementById('expense-note').value.trim();

    if (!type) { error.textContent = 'نوع المصروف مطلوب.'; return; }
    if (!Number.isFinite(amount) || amount <= 0) { error.textContent = 'أدخل مبلغًا صحيحًا أكبر من صفر.'; return; }
    if (!note) { error.textContent = 'أضف وصفًا للمصروف.'; return; }

    expenses.unshift({ id: Date.now(), type, note, amount, date: new Date().toISOString() });
    saveExpenses();
    close();
    renderDashboard();
  });
}

function openCashFlowModal() {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-head"><h2>إضافة حركة نقدية</h2><button class="close" id="close-cashflow">×</button></div>
    <form id="cashflow-form">
      <div class="form-grid">
        <div class="field"><label for="cashflow-type">نوع الحركة</label>
          <select id="cashflow-type" required>
            <option value="إيداع">إيداع</option>
            <option value="سحب">سحب</option>
          </select>
        </div>
        <div class="field"><label for="cashflow-amount">المبلغ (ر.س)</label><input id="cashflow-amount" type="number" min="0" step="0.01" value="0" required /></div>
        <div class="field full"><label for="cashflow-note">الوصف</label><input id="cashflow-note" maxlength="120" placeholder="مثل: إيداع يومي أو سحب للشراء" required /></div>
      </div>
      <div class="error" id="cashflow-error"></div>
      <div class="modal-actions"><button type="button" class="ghost" id="cancel-cashflow">إلغاء</button><button class="primary" type="submit">حفظ الحركة</button></div>
    </form>
  </div>`;
  document.body.appendChild(wrapper);

  const close = () => wrapper.remove();
  wrapper.querySelector('#close-cashflow').addEventListener('click', close);
  wrapper.querySelector('#cancel-cashflow').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });

  wrapper.querySelector('#cashflow-form').addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('cashflow-error');
    const type = document.getElementById('cashflow-type').value.trim();
    const amount = Number(document.getElementById('cashflow-amount').value);
    const note = document.getElementById('cashflow-note').value.trim();

    if (!type) { error.textContent = 'نوع الحركة مطلوب.'; return; }
    if (!Number.isFinite(amount) || amount <= 0) { error.textContent = 'أدخل مبلغًا صحيحًا أكبر من صفر.'; return; }
    if (!note) { error.textContent = 'أضف وصفًا للحركة.'; return; }

    cashFlow.unshift({ id: Date.now(), type, note, amount, date: new Date().toISOString() });
    saveCashFlow();
    close();
    renderDashboard();
  });
}

function openModal(id = null) {
  editingId = id;
  const product = id ? products.find(item => item.id === id) : { name: '', sku: '', category: '', price: '', stock: '', threshold: 5 };
  const wrapper = document.createElement('div'); wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal" role="dialog"><div class="modal-head"><h2>${id ? 'تعديل الصنف' : 'إضافة صنف جديد'}</h2><button class="close" id="close-modal">×</button></div><form id="product-form"><div class="form-grid"><div class="field full"><label for="product-name">اسم الصنف</label><input id="product-name" required value="${escapeHtml(product.name)}" placeholder="مثال: مياه معدنية" /></div><div class="field"><label for="product-sku">رمز الصنف</label><input id="product-sku" value="${escapeHtml(product.sku)}" placeholder="مثال: WAT-001" /></div><div class="field"><label for="product-category">التصنيف</label><input id="product-category" value="${escapeHtml(product.category)}" placeholder="مثال: مشروبات" /></div><div class="field"><label for="product-price">السعر (ر.س)</label><input id="product-price" type="number" min="0" step="0.01" required value="${product.price}" /></div><div class="field"><label for="product-stock">الكمية الحالية</label><input id="product-stock" type="number" min="0" step="1" required value="${product.stock}" /></div><div class="field full"><label for="product-threshold">التنبيه عند وصول الكمية إلى</label><input id="product-threshold" type="number" min="0" step="1" required value="${product.threshold}" /></div></div><div class="modal-actions"><button type="button" class="ghost" id="cancel-modal">إلغاء</button><button class="primary" type="submit">${id ? 'حفظ التعديل' : 'إضافة الصنف'}</button></div></form></div>`;
  document.body.appendChild(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelector('#close-modal').addEventListener('click', close); wrapper.querySelector('#cancel-modal').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });
  wrapper.querySelector('#product-form').addEventListener('submit', event => {
    event.preventDefault();
    const item = { id: editingId || Date.now(), name: document.getElementById('product-name').value.trim(), sku: document.getElementById('product-sku').value.trim() || 'بدون رمز', category: document.getElementById('product-category').value.trim() || 'عام', price: Number(document.getElementById('product-price').value), stock: Number(document.getElementById('product-stock').value), threshold: Number(document.getElementById('product-threshold').value) };
    if (editingId) products = products.map(product => product.id === editingId ? item : product); else products.unshift(item);
    saveProducts(); close(); renderDashboard();
  });
}

function deleteProduct(id) {
  const product = products.find(item => item.id === id);
  if (product && confirm(`هل تريد حذف صنف "${product.name}"؟`)) {
    products = products.filter(item => item.id !== id);
    saveProducts();
    renderDashboard();
  }
}

function deleteExpense(id) {
  const expense = expenses.find(item => item.id === id);
  if (expense && confirm(`هل تريد حذف المصروف "${expense.note}"؟`)) {
    expenses = expenses.filter(item => item.id !== id);
    saveExpenses();
    renderDashboard();
  }
}

function deleteCashFlow(id) {
  const item = cashFlow.find(entry => entry.id === id);
  if (item && confirm(`هل تريد حذف الحركة النقدية "${item.note}"؟`)) {
    cashFlow = cashFlow.filter(entry => entry.id !== id);
    saveCashFlow();
    renderDashboard();
  }
}

function openInvoiceModal() {
  const summary = getSalesSummary();
  const recent = sales.slice(0, 5);
  const rows = recent.length ? recent.map(sale => `
    <tr>
      <td>${escapeHtml(sale.productName)}</td>
      <td>${sale.quantity}</td>
      <td>${money(sale.price)}</td>
      <td>${money(sale.total)}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="empty-cell">لا توجد مبيعات</td></tr>';

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';
  wrapper.innerHTML = `<div class="modal invoice-modal" role="dialog">
    <div class="modal-head">
      <h2>الفاتورة المجمعة</h2>
      <button class="close" id="close-invoice">×</button>
    </div>
    <div class="invoice-box">
      <div class="invoice-meta">
        <div><span>اسم المتجر</span><strong>مخزني</strong></div>
        <div><span>التاريخ</span><strong>${formatDateTime(new Date().toISOString())}</strong></div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="invoice-total">
        <div><span>إجمالي المبيعات</span><strong>${money(summary.totalRevenue)}</strong></div>
        <div><span>إيراد اليوم</span><strong>${money(summary.todayRevenue)}</strong></div>
      </div>
    </div>
    <div class="modal-actions">
      <button type="button" class="ghost" id="cancel-invoice">إغلاق</button>
      <button type="button" class="primary" id="print-invoice">طباعة</button>
    </div>
  </div>`;

  document.body.appendChild(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelector('#close-invoice').addEventListener('click', close);
  wrapper.querySelector('#cancel-invoice').addEventListener('click', close);
  wrapper.querySelector('#print-invoice').addEventListener('click', () => window.print());
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });
}

function openSaleModal() {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-backdrop';

  const options = products.length ? products.map(product => `<option value="${product.id}">${escapeHtml(product.name)} — ${product.stock} متبقي</option>`).join('') : '<option value="">لا توجد أصناف</option>';

  wrapper.innerHTML = `<div class="modal" role="dialog"><div class="modal-head"><h2>تسجيل مبيع جديد</h2><button class="close" id="close-sale">×</button></div><form id="sale-form"><div class="field"><label for="sale-product">الصنف</label><select id="sale-product" required>${options}</select></div><div class="form-grid"><div class="field"><label for="sale-quantity">الكمية</label><input id="sale-quantity" type="number" min="1" step="1" value="1" required /></div><div class="field"><label for="sale-price">سعر الوحدة (ر.س)</label><input id="sale-price" type="number" min="0" step="0.01" value="0" required /></div><div class="field full"><label for="sale-paid">المبلغ المدفوع</label><input id="sale-paid" type="number" min="0" step="0.01" value="0" /></div><div class="field full"><label for="sale-note">ملاحظات</label><input id="sale-note" placeholder="اسم العميل أو ملاحظات البيع" /></div></div><div class="error" id="sale-error"></div><div class="modal-actions"><button type="button" class="ghost" id="cancel-sale">إلغاء</button><button class="primary" type="submit">تأكيد البيع</button></div></form></div>`;
  document.body.appendChild(wrapper);

  const close = () => wrapper.remove();
  wrapper.querySelector('#close-sale').addEventListener('click', close);
  wrapper.querySelector('#cancel-sale').addEventListener('click', close);
  wrapper.addEventListener('click', event => { if (event.target === wrapper) close(); });

  wrapper.querySelector('#sale-form').addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('sale-error');
    const saleProductId = Number(document.getElementById('sale-product').value);
    const quantity = Number(document.getElementById('sale-quantity').value);
    const unitPrice = Number(document.getElementById('sale-price').value);
    const paid = Number(document.getElementById('sale-paid').value || 0);
    const note = document.getElementById('sale-note').value.trim();

    if (!products.length || !saleProductId) {
      error.textContent = 'لا توجد أصناف متاحة للبيع.';
      return;
    }

    const product = products.find(item => item.id === saleProductId);
    if (!product) { error.textContent = 'الصنف غير موجود.'; return; }
    if (!Number.isInteger(quantity) || quantity <= 0) { error.textContent = 'أدخل كمية صحيحة.'; return; }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) { error.textContent = 'أدخل سعر وحدة صحيح.'; return; }
    if (quantity > Number(product.stock)) { error.textContent = 'الكمية المطلوبة أكبر من المخزون المتاح.'; return; }
    if (!Number.isFinite(paid) || paid < 0) { error.textContent = 'أدخل مبلغ مدفوع صحيح.'; return; }

    product.stock = Number(product.stock) - quantity;
    const total = unitPrice * quantity;
    const sale = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity,
      price: unitPrice,
      total,
      paid,
      note,
      date: new Date().toISOString()
    };

    sales.unshift(sale);
    saveProducts();
    saveSales();
    close();
    renderDashboard();
  });
}

function deleteSale(id) {
  const sale = sales.find(item => item.id === id);
  if (sale && confirm(`هل تريد حذف البيع الخاص بـ "${sale.productName}"؟`)) {
    const product = products.find(item => item.id === sale.productId);
    if (product) {
      product.stock = Number(product.stock) + Number(sale.quantity || 0);
    }
    sales = sales.filter(item => item.id !== id);
    saveProducts();
    saveSales();
    renderDashboard();
  }
}

function payReceivable(id) {
  const sale = sales.find(item => item.id === id);
  if (!sale) return;
  const due = Number(sale.total) - Number(sale.paid || 0);
  if (due <= 0) return;
  const rawValue = prompt(`المبلغ المتبقي: ${money(due)}\nأدخل المبلغ الذي سيتم تسديده:`, money(due)) || '';
  const amount = Number(rawValue.replace(/[^0-9.]/g, '')) || 0;
  if (!Number.isFinite(amount) || amount <= 0) return;
  const accepted = Math.min(amount, due);
  sale.paid = Number(sale.paid || 0) + accepted;
  cashFlow.unshift({ id: Date.now(), type: 'إيداع', note: `تسديد مبيع: ${sale.productName}`, amount: accepted, date: new Date().toISOString() });
  saveSales();
  saveCashFlow();
  renderDashboard();
}

if (window.makhzaniSupabase) {
  window.makhzaniSupabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      renderLogin();
      return;
    }
    localStorage.setItem(SESSION_KEY, session.user.email);
    await loadCloudDataIfAvailable();
    renderDashboard();
  });
} else {
  renderLogin();
}
