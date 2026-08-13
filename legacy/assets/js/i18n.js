/* Mplace i18n: EN / RU / AR + multi-currency */
(function (global) {
  const LANG_KEY = 'mplace_lang';
  const CUR_KEY = 'mplace_currency';

  const LANGS = {
    en: { code: 'en', name: 'English', dir: 'ltr', native: 'English' },
    ru: { code: 'ru', name: 'Русский', dir: 'ltr', native: 'Русский' },
    ar: { code: 'ar', name: 'العربية', dir: 'rtl', native: 'العربية' },
  };

  /** Base currency of API prices is USD cents */
  const CURRENCIES = {
    USD: { code: 'USD', symbol: '$', name: { en: 'US Dollar', ru: 'Доллар США', ar: 'دولار أمريكي' }, rate: 1, locale: 'en-US' },
    EUR: { code: 'EUR', symbol: '€', name: { en: 'Euro', ru: 'Евро', ar: 'يورو' }, rate: 0.92, locale: 'de-DE' },
    RUB: { code: 'RUB', symbol: '₽', name: { en: 'Russian Ruble', ru: 'Российский рубль', ar: 'روبل روسي' }, rate: 92, locale: 'ru-RU' },
    SAR: { code: 'SAR', symbol: 'ر.س', name: { en: 'Saudi Riyal', ru: 'Сауд. риял', ar: 'ريال سعودي' }, rate: 3.75, locale: 'ar-SA' },
    AED: { code: 'AED', symbol: 'د.إ', name: { en: 'UAE Dirham', ru: 'Дирхам ОАЭ', ar: 'درهم إماراتي' }, rate: 3.67, locale: 'ar-AE' },
  };

  const dict = {
    en: {
      'app.name': 'Mplace Energy',
      'app.tagline': 'Oil & Gas B2B Marketplace',
      'nav.products': 'EQUIPMENT',
      'nav.vendors': 'SUPPLIERS',
      'nav.categories': 'CATEGORIES',
      'nav.checkout': 'CHECKOUT',
      'nav.login': 'LOGIN',
      'nav.account': 'Account',
      'nav.admin': 'Admin',
      'nav.sell': 'Supply',
      'nav.sellOn': 'on Mplace Energy',
      'nav.cart': 'RFQ / Cart',
      'nav.orders': 'My orders',
      'nav.storefront': 'Catalog',
      'nav.continueShopping': '← Back to catalog',
      'hello.signIn': 'Hello, Sign in',
      'hello.user': 'Hello, {name}',
      'search.placeholder': 'Search valves, pumps, PPE, drilling…',
      'search.all': 'All',
      'search.title': 'Search',
      'search.category': 'Categories',
      'search.allCategories': 'All categories',
      'search.vendors': 'Suppliers',
      'search.allVendors': 'All suppliers',
      'search.stock': 'Availability',
      'search.inStockOnly': 'In stock only',
      'search.sort': 'Sort',
      'search.sortDefault': 'Default',
      'search.sortPriceAsc': 'Price ↑',
      'search.sortPriceDesc': 'Price ↓',
      'search.sortName': 'Name',
      'search.sortStock': 'Stock',
      'search.apply': 'Apply',
      'search.filters': 'Filters',
      'hero.title': 'Oil & Gas Procurement Marketplace',
      'hero.sub': 'B2B platform for drilling, pipeline, PPE, pumps and field equipment — multi-vendor, multi-currency',
      'hero.cta': 'Browse Catalog',
      'flash.banner': '🛢️ Oil & Gas B2B · RU / EN / AR · Multi-currency · Demo payment (no cards stored)',
      'section.categories': 'Industry categories',
      'section.products': 'Equipment & materials',
      'section.vendors': 'Verified suppliers',
      'product.soldBy': 'Sold by {shop}',
      'product.stock': 'stock {n}',
      'product.addToCart': 'Add to order',
      'product.added': '✓ Added',
      'product.similar': 'Similar products',
      'cart.title': 'Your order list',
      'cart.empty': 'Order list is empty',
      'cart.total': 'Total',
      'cart.checkout': 'Proceed to checkout',
      'cart.pageTitle': 'Order & procurement checkout',
      'cart.items': 'Line items',
      'cart.checkoutBox': 'Checkout',
      'cart.name': 'Buyer name',
      'cart.email': 'Work email',
      'cart.namePh': 'Procurement contact',
      'cart.emailPh': 'buyer@company.com',
      'cart.subtotal': 'Subtotal',
      'cart.payHint': 'Demo payment: no card data stored. Platform fee 10%. For real RFQ use supplier contacts.',
      'cart.payBtn': 'Place procurement order (demo)',
      'cart.processing': 'Processing…',
      'cart.success': '✓ Payment successful (mock)',
      'cart.ordersCreated': '{n} order(s) created:',
      'cart.backStore': 'Back to store',
      'cart.emptyShop': 'Cart is empty. Shop now',
      'cart.shopNow': 'Shop now',
      'login.title': 'Login',
      'login.email': 'Email',
      'login.password': 'Password',
      'login.remember': 'Remember Me',
      'login.submit': 'Login',
      'login.signing': 'Signing in…',
      'login.adminHint': 'ADMIN',
      'login.merchantHint': 'MERCHANT',
      'login.username': 'Username',
      'login.passwordLabel': 'Password',
      'login.storeFront': '← Store front',
      'login.registerMerchant': 'Register as merchant',
      'login.errorCreds': 'These credentials do not match our records.',
      'login.errorApi': 'API offline. Start: cd apps/api && npm run start:dev (port 3000)',
      'lang.label': 'Language',
      'currency.label': 'Currency',
      'api.ok': 'API OK',
      'api.off': 'API OFF',
      'api.loading': 'API …',
      'footer.copy': '© 2026 Mplace Energy — Oil & Gas B2B Marketplace',
      'admin.dashboard': 'DASHBOARD',
      'admin.catalog': 'CATALOG',
      'admin.orders': 'ORDERS',
      'admin.admin': 'ADMIN',
      'admin.vendors': 'VENDORS',
      'admin.wallet': 'WALLET',
      'admin.support': 'SUPPORT DESK',
      'admin.appearance': 'APPEARANCE',
      'admin.promotions': 'PROMOTIONS',
      'admin.plugins': 'PLUGINS',
      'admin.settings': 'SETTINGS',
      'admin.utilities': 'UTILITIES',
      'admin.reports': 'REPORTS',
      'admin.products': 'Products',
      'admin.categories': 'Categories',
      'admin.customers': 'Customers',
      'admin.merchants': 'Merchants',
      'admin.shops': 'Shops',
      'admin.welcome': 'Welcome',
      'admin.administrator': 'Administrator',
      'admin.logout': 'Logout',
      'admin.messages': 'Messages',
      'admin.tickets': 'Tickets',
      'admin.account': 'Account',
      'admin.liveApi': 'Live API · NestJS engine',
      'admin.loading': 'Loading…',
      'admin.customersCard': 'CUSTOMERS',
      'admin.merchantsCard': 'MERCHANTS',
      'admin.ordersCard': 'ORDERS',
      'admin.todayTotal': "TODAY'S TOTAL",
      'admin.fromApi': 'From API',
      'admin.pendingVerif': 'Pending Verifications',
      'admin.pendingApprovals': 'Pending Approvals',
      'admin.disputes': 'Appealed Disputes',
      'admin.needAction': 'Need action',
      'admin.shopsPending': 'Shops pending approval',
      'admin.openAppealed': 'Open / appealed',
      'admin.searchProducts': 'Search products…',
      'admin.addProduct': 'Add Product',
      'admin.export': 'Export',
      'admin.apiLive': 'API live',
      'admin.allProducts': 'All Products',
      'admin.noProducts': 'No products',
      'admin.noOrders': 'No orders',
      'admin.noCustomers': 'No customers',
      'admin.noMerchants': 'No merchants',
      'admin.noShops': 'No shops',
      'admin.noCategories': 'No categories',
      'admin.orderList': 'Order List',
      'admin.customerList': 'Customer List (API)',
      'admin.merchantList': 'Merchant List (API)',
      'admin.shopList': 'Shop List (API)',
      'admin.searchOrders': 'Search orders…',
      'admin.searchCustomers': 'Search customers…',
      'admin.searchMerchants': 'Search merchants…',
      'admin.searchShops': 'Search shops…',
      'admin.searchCategories': 'Search…',
      'admin.addCategory': 'Add Category',
      'admin.categoriesApi': 'Categories (API)',
      'admin.col.order': 'Order #',
      'admin.col.customer': 'Customer',
      'admin.col.shop': 'Shop',
      'admin.col.items': 'Items',
      'admin.col.total': 'Total',
      'admin.col.status': 'Status',
      'admin.col.date': 'Date',
      'admin.col.update': 'Update',
      'admin.col.name': 'Name',
      'admin.col.email': 'Email',
      'admin.col.orders': 'Orders',
      'admin.col.joined': 'Joined',
      'admin.col.products': 'Products',
      'admin.col.verify': 'Verify',
      'admin.col.slug': 'Slug',
      'admin.col.setStatus': 'Set status',
      'admin.col.parent': 'Parent',
      'admin.col.price': 'Price',
      'admin.col.stock': 'Stock',
      'admin.col.sold': 'Sold',
      'admin.col.action': 'Action',
      'admin.col.category': 'Category',
      'admin.home': 'Home',
      'admin.dashboardTitle': 'Dashboard',
      'admin.productsTitle': 'Products',
      'admin.ordersTitle': 'Orders',
      'admin.apiError': 'API error',
      'admin.verified': 'Verified',
      'admin.unverified': 'Unverified',
      'admin.view': 'View',
      'admin.edit': 'Edit',
      'admin.del': 'Del',
      'admin.save': 'Save',
      'admin.cancel': 'Cancel',
      'admin.form': 'Form',
      'merchant.dashboard': 'DASHBOARD',
      'merchant.catalog': 'CATALOG',
      'merchant.orders': 'ORDERS',
      'merchant.payouts': 'PAYOUTS',
      'merchant.messages': 'MESSAGES',
      'merchant.disputes': 'DISPUTES',
      'merchant.shop': 'SHOP',
      'merchant.reports': 'REPORTS',
      'merchant.account': 'ACCOUNT',
      'merchant.products': 'Products',
      'merchant.inventory': 'Inventory',
      'merchant.panel': 'Merchant Panel',
      'merchant.myProducts': 'My Products (API)',
      'merchant.shopOrders': 'Shop Orders (API)',
      'merchant.addProduct': 'Add Product',
      'merchant.noOrders': 'No orders yet',
      'common.loading': 'Loading…',
      'common.error': 'Error',
      'common.general': 'General',
      'common.root': 'Root',
    },
    ru: {
      'app.name': 'Mplace Energy',
      'app.tagline': 'B2B-площадка нефтегаза',
      'nav.products': 'ОБОРУДОВАНИЕ',
      'nav.vendors': 'ПОСТАВЩИКИ',
      'nav.categories': 'КАТЕГОРИИ',
      'nav.checkout': 'ОФОРМЛЕНИЕ',
      'nav.login': 'ВХОД',
      'nav.account': 'Аккаунт',
      'nav.admin': 'Админ',
      'nav.sell': 'Поставлять',
      'nav.sellOn': 'на Mplace Energy',
      'nav.cart': 'Заявка',
      'nav.orders': 'Мои заявки',
      'nav.storefront': 'Каталог',
      'nav.continueShopping': '← В каталог',
      'hello.signIn': 'Здравствуйте, войдите',
      'hello.user': 'Здравствуйте, {name}',
      'search.placeholder': 'Поиск: арматура, насосы, СИЗ, бурение…',
      'search.all': 'Все',
      'search.title': 'Поиск',
      'search.category': 'Категории',
      'search.allCategories': 'Все категории',
      'search.vendors': 'Поставщики',
      'search.allVendors': 'Все поставщики',
      'search.stock': 'Наличие',
      'search.inStockOnly': 'Только в наличии',
      'search.sort': 'Сортировка',
      'search.sortDefault': 'По умолчанию',
      'search.sortPriceAsc': 'Цена ↑',
      'search.sortPriceDesc': 'Цена ↓',
      'search.sortName': 'Название',
      'search.sortStock': 'Остаток',
      'search.apply': 'Применить',
      'search.filters': 'Фильтры',
      'hero.title': 'Закупки для нефтегазовой отрасли',
      'hero.sub': 'B2B-маркетплейс: буровое оборудование, трубопроводы, СИЗ, насосы и комплектующие — несколько поставщиков, мультивалюта',
      'hero.cta': 'Открыть каталог',
      'flash.banner': '🛢️ Нефтегаз B2B · RU / EN / AR · Мультивалюта · Демо-оплата (карты не хранятся)',
      'section.categories': 'Отраслевые категории',
      'section.products': 'Оборудование и материалы',
      'section.vendors': 'Проверенные поставщики',
      'product.soldBy': 'Продавец: {shop}',
      'product.stock': 'остаток {n}',
      'product.addToCart': 'В заявку',
      'product.added': '✓ Добавлено',
      'product.similar': 'Похожие товары',
      'cart.title': 'Ваша заявка',
      'cart.empty': 'Заявка пуста',
      'cart.total': 'Итого',
      'cart.checkout': 'К оформлению',
      'cart.pageTitle': 'Заявка на закупку',
      'cart.items': 'Позиции',
      'cart.checkoutBox': 'Оформление',
      'cart.name': 'Контакт закупщика',
      'cart.email': 'Рабочий email',
      'cart.namePh': 'ФИО / отдел закупок',
      'cart.emailPh': 'zakupki@company.ru',
      'cart.subtotal': 'Сумма',
      'cart.payHint': 'Демо-оплата: карты не сохраняются. Комиссия площадки 10%. Для реального RFQ — связь с поставщиком.',
      'cart.payBtn': 'Оформить закупку (демо)',
      'cart.processing': 'Обработка…',
      'cart.success': '✓ Оплата прошла (тест)',
      'cart.ordersCreated': 'Создано заказов: {n}',
      'cart.backStore': 'В магазин',
      'cart.emptyShop': 'Корзина пуста. Перейти в каталог',
      'cart.shopNow': 'В каталог',
      'login.title': 'Вход',
      'login.email': 'Email',
      'login.password': 'Пароль',
      'login.remember': 'Запомнить меня',
      'login.submit': 'Войти',
      'login.signing': 'Вход…',
      'login.adminHint': 'АДМИН',
      'login.merchantHint': 'ПРОДАВЕЦ',
      'login.username': 'Логин',
      'login.passwordLabel': 'Пароль',
      'login.storeFront': '← На витрину',
      'login.registerMerchant': 'Регистрация продавца',
      'login.errorCreds': 'Неверный email или пароль.',
      'login.errorApi': 'API недоступен. Запустите: cd apps/api && npm run start:dev',
      'lang.label': 'Язык',
      'currency.label': 'Валюта',
      'api.ok': 'API ОК',
      'api.off': 'API ВЫКЛ',
      'api.loading': 'API …',
      'footer.copy': '© 2026 Mplace Energy — нефтегазовая B2B-площадка',
      'admin.dashboard': 'ПАНЕЛЬ',
      'admin.catalog': 'КАТАЛОГ',
      'admin.orders': 'ЗАКАЗЫ',
      'admin.admin': 'АДМИН',
      'admin.vendors': 'ПРОДАВЦЫ',
      'admin.wallet': 'КОШЕЛЁК',
      'admin.support': 'ПОДДЕРЖКА',
      'admin.appearance': 'ОФОРМЛЕНИЕ',
      'admin.promotions': 'АКЦИИ',
      'admin.plugins': 'ПЛАГИНЫ',
      'admin.settings': 'НАСТРОЙКИ',
      'admin.utilities': 'УТИЛИТЫ',
      'admin.reports': 'ОТЧЁТЫ',
      'admin.products': 'Товары',
      'admin.categories': 'Категории',
      'admin.customers': 'Клиенты',
      'admin.merchants': 'Продавцы',
      'admin.shops': 'Магазины',
      'admin.welcome': 'Добро пожаловать',
      'admin.administrator': 'Администратор',
      'admin.logout': 'Выход',
      'admin.messages': 'Сообщения',
      'admin.tickets': 'Тикеты',
      'admin.account': 'Аккаунт',
      'admin.liveApi': 'Live API · NestJS',
      'admin.loading': 'Загрузка…',
      'admin.customersCard': 'КЛИЕНТЫ',
      'admin.merchantsCard': 'ПРОДАВЦЫ',
      'admin.ordersCard': 'ЗАКАЗЫ',
      'admin.todayTotal': 'СЕГОДНЯ',
      'admin.fromApi': 'Из API',
      'admin.pendingVerif': 'Ожидают проверки',
      'admin.pendingApprovals': 'Ожидают одобрения',
      'admin.disputes': 'Споры',
      'admin.needAction': 'Требуют действия',
      'admin.shopsPending': 'Магазины на модерации',
      'admin.openAppealed': 'Открытые / апелляции',
      'admin.searchProducts': 'Поиск товаров…',
      'admin.addProduct': 'Добавить товар',
      'admin.export': 'Экспорт',
      'admin.apiLive': 'API онлайн',
      'admin.allProducts': 'Все товары',
      'admin.noProducts': 'Нет товаров',
      'admin.noOrders': 'Нет заказов',
      'admin.noCustomers': 'Нет клиентов',
      'admin.noMerchants': 'Нет продавцов',
      'admin.noShops': 'Нет магазинов',
      'admin.noCategories': 'Нет категорий',
      'admin.orderList': 'Список заказов',
      'admin.customerList': 'Клиенты (API)',
      'admin.merchantList': 'Продавцы (API)',
      'admin.shopList': 'Магазины (API)',
      'admin.searchOrders': 'Поиск заказов…',
      'admin.searchCustomers': 'Поиск клиентов…',
      'admin.searchMerchants': 'Поиск продавцов…',
      'admin.searchShops': 'Поиск магазинов…',
      'admin.searchCategories': 'Поиск…',
      'admin.addCategory': 'Добавить категорию',
      'admin.categoriesApi': 'Категории (API)',
      'admin.col.order': '№ заказа',
      'admin.col.customer': 'Клиент',
      'admin.col.shop': 'Магазин',
      'admin.col.items': 'Позиции',
      'admin.col.total': 'Сумма',
      'admin.col.status': 'Статус',
      'admin.col.date': 'Дата',
      'admin.col.update': 'Изменить',
      'admin.col.name': 'Имя',
      'admin.col.email': 'Email',
      'admin.col.orders': 'Заказы',
      'admin.col.joined': 'Регистрация',
      'admin.col.products': 'Товары',
      'admin.col.verify': 'Проверка',
      'admin.col.slug': 'Slug',
      'admin.col.setStatus': 'Статус',
      'admin.col.parent': 'Родитель',
      'admin.col.price': 'Цена',
      'admin.col.stock': 'Склад',
      'admin.col.sold': 'Продано',
      'admin.col.action': 'Действия',
      'admin.col.category': 'Категория',
      'admin.home': 'Главная',
      'admin.dashboardTitle': 'Панель',
      'admin.productsTitle': 'Товары',
      'admin.ordersTitle': 'Заказы',
      'admin.apiError': 'Ошибка API',
      'admin.verified': 'Проверен',
      'admin.unverified': 'Не проверен',
      'admin.view': 'Смотр.',
      'admin.edit': 'Изм.',
      'admin.del': 'Удал.',
      'admin.save': 'Сохранить',
      'admin.cancel': 'Отмена',
      'admin.form': 'Форма',
      'merchant.dashboard': 'ПАНЕЛЬ',
      'merchant.catalog': 'КАТАЛОГ',
      'merchant.orders': 'ЗАКАЗЫ',
      'merchant.payouts': 'ВЫПЛАТЫ',
      'merchant.messages': 'СООБЩЕНИЯ',
      'merchant.disputes': 'СПОРЫ',
      'merchant.shop': 'МАГАЗИН',
      'merchant.reports': 'ОТЧЁТЫ',
      'merchant.account': 'АККАУНТ',
      'merchant.products': 'Товары',
      'merchant.inventory': 'Склад',
      'merchant.panel': 'Кабинет продавца',
      'merchant.myProducts': 'Мои товары (API)',
      'merchant.shopOrders': 'Заказы магазина (API)',
      'merchant.addProduct': 'Добавить товар',
      'merchant.noOrders': 'Заказов пока нет',
      'common.loading': 'Загрузка…',
      'common.error': 'Ошибка',
      'common.general': 'Общее',
      'common.root': 'Корень',
    },
    ar: {
      'app.name': 'Mplace Energy',
      'app.tagline': 'سوق B2B للنفط والغاز',
      'nav.products': 'المعدات',
      'nav.vendors': 'الموردون',
      'nav.categories': 'الفئات',
      'nav.checkout': 'الدفع',
      'nav.login': 'تسجيل الدخول',
      'nav.account': 'الحساب',
      'nav.admin': 'المشرف',
      'nav.sell': 'ورّد',
      'nav.sellOn': 'على Mplace Energy',
      'nav.cart': 'طلب شراء',
      'nav.orders': 'طلباتي',
      'nav.storefront': 'الكتالوج',
      'nav.continueShopping': '← العودة للكتالوج',
      'hello.signIn': 'مرحباً، سجّل الدخول',
      'hello.user': 'مرحباً، {name}',
      'search.placeholder': 'بحث: صمامات، مضخات، وقاية، حفر…',
      'search.all': 'الكل',
      'search.title': 'بحث',
      'search.category': 'الفئات',
      'search.allCategories': 'كل الفئات',
      'search.vendors': 'الموردون',
      'search.allVendors': 'كل الموردين',
      'search.stock': 'التوفر',
      'search.inStockOnly': 'المتوفر فقط',
      'search.sort': 'ترتيب',
      'search.sortDefault': 'افتراضي',
      'search.sortPriceAsc': 'السعر ↑',
      'search.sortPriceDesc': 'السعر ↓',
      'search.sortName': 'الاسم',
      'search.sortStock': 'المخزون',
      'search.apply': 'تطبيق',
      'search.filters': 'تصفية',
      'hero.title': 'سوق مشتريات النفط والغاز',
      'hero.sub': 'منصة B2B لمعدات الحفر وخطوط الأنابيب والسلامة والمضخات — متعدد الموردين والعملات',
      'hero.cta': 'تصفح الكتالوج',
      'flash.banner': '🛢️ نفط وغاز B2B · RU / EN / AR · عملات متعددة · دفع تجريبي',
      'section.categories': 'فئات الصناعة',
      'section.products': 'المعدات والمواد',
      'section.vendors': 'موردون موثوقون',
      'product.soldBy': 'المورد: {shop}',
      'product.stock': 'المخزون {n}',
      'product.addToCart': 'أضف للطلب',
      'product.added': '✓ تمت الإضافة',
      'product.similar': 'منتجات مشابهة',
      'cart.title': 'قائمة الطلب',
      'cart.empty': 'القائمة فارغة',
      'cart.total': 'الإجمالي',
      'cart.checkout': 'إتمام الطلب',
      'cart.pageTitle': 'طلب المشتريات',
      'cart.items': 'البنود',
      'cart.checkoutBox': 'الدفع',
      'cart.name': 'اسم المشتري',
      'cart.email': 'البريد الوظيفي',
      'cart.namePh': 'مسؤول المشتريات',
      'cart.emailPh': 'buyer@company.com',
      'cart.subtotal': 'المجموع',
      'cart.payHint': 'دفع تجريبي: لا تُحفظ البطاقات. عمولة المنصة 10٪.',
      'cart.payBtn': 'تأكيد طلب المشتريات (تجريبي)',
      'cart.processing': 'جاري المعالجة…',
      'cart.success': '✓ تم الدفع (تجريبي)',
      'cart.ordersCreated': 'تم إنشاء {n} طلب/طلبات:',
      'cart.backStore': 'العودة للمتجر',
      'cart.emptyShop': 'السلة فارغة. تسوق الآن',
      'cart.shopNow': 'تسوق الآن',
      'login.title': 'تسجيل الدخول',
      'login.email': 'البريد الإلكتروني',
      'login.password': 'كلمة المرور',
      'login.remember': 'تذكرني',
      'login.submit': 'دخول',
      'login.signing': 'جاري الدخول…',
      'login.adminHint': 'المشرف',
      'login.merchantHint': 'التاجر',
      'login.username': 'اسم المستخدم',
      'login.passwordLabel': 'كلمة المرور',
      'login.storeFront': '← المتجر',
      'login.registerMerchant': 'تسجيل كتاجر',
      'login.errorCreds': 'بيانات الدخول غير صحيحة.',
      'login.errorApi': 'واجهة API متوقفة. شغّل: cd apps/api && npm run start:dev',
      'lang.label': 'اللغة',
      'currency.label': 'العملة',
      'api.ok': 'API جاهز',
      'api.off': 'API متوقف',
      'api.loading': 'API …',
      'footer.copy': '© 2026 Mplace Energy — سوق النفط والغاز B2B',
      'admin.dashboard': 'لوحة التحكم',
      'admin.catalog': 'الكتالوج',
      'admin.orders': 'الطلبات',
      'admin.admin': 'الإدارة',
      'admin.vendors': 'البائعون',
      'admin.wallet': 'المحفظة',
      'admin.support': 'الدعم',
      'admin.appearance': 'المظهر',
      'admin.promotions': 'العروض',
      'admin.plugins': 'الإضافات',
      'admin.settings': 'الإعدادات',
      'admin.utilities': 'الأدوات',
      'admin.reports': 'التقارير',
      'admin.products': 'المنتجات',
      'admin.categories': 'الفئات',
      'admin.customers': 'العملاء',
      'admin.merchants': 'التجار',
      'admin.shops': 'المتاجر',
      'admin.welcome': 'مرحباً',
      'admin.administrator': 'مشرف',
      'admin.logout': 'خروج',
      'admin.messages': 'الرسائل',
      'admin.tickets': 'التذاكر',
      'admin.account': 'الحساب',
      'admin.liveApi': 'API مباشر · NestJS',
      'admin.loading': 'جاري التحميل…',
      'admin.customersCard': 'العملاء',
      'admin.merchantsCard': 'التجار',
      'admin.ordersCard': 'الطلبات',
      'admin.todayTotal': 'إجمالي اليوم',
      'admin.fromApi': 'من API',
      'admin.pendingVerif': 'بانتظار التحقق',
      'admin.pendingApprovals': 'بانتظار الموافقة',
      'admin.disputes': 'النزاعات',
      'admin.needAction': 'تحتاج إجراء',
      'admin.shopsPending': 'متاجر بانتظار الموافقة',
      'admin.openAppealed': 'مفتوحة / مستأنفة',
      'admin.searchProducts': 'بحث المنتجات…',
      'admin.addProduct': 'إضافة منتج',
      'admin.export': 'تصدير',
      'admin.apiLive': 'API متصل',
      'admin.allProducts': 'كل المنتجات',
      'admin.noProducts': 'لا منتجات',
      'admin.noOrders': 'لا طلبات',
      'admin.noCustomers': 'لا عملاء',
      'admin.noMerchants': 'لا تجار',
      'admin.noShops': 'لا متاجر',
      'admin.noCategories': 'لا فئات',
      'admin.orderList': 'قائمة الطلبات',
      'admin.customerList': 'العملاء (API)',
      'admin.merchantList': 'التجار (API)',
      'admin.shopList': 'المتاجر (API)',
      'admin.searchOrders': 'بحث الطلبات…',
      'admin.searchCustomers': 'بحث العملاء…',
      'admin.searchMerchants': 'بحث التجار…',
      'admin.searchShops': 'بحث المتاجر…',
      'admin.searchCategories': 'بحث…',
      'admin.addCategory': 'إضافة فئة',
      'admin.categoriesApi': 'الفئات (API)',
      'admin.col.order': 'رقم الطلب',
      'admin.col.customer': 'العميل',
      'admin.col.shop': 'المتجر',
      'admin.col.items': 'العناصر',
      'admin.col.total': 'المجموع',
      'admin.col.status': 'الحالة',
      'admin.col.date': 'التاريخ',
      'admin.col.update': 'تحديث',
      'admin.col.name': 'الاسم',
      'admin.col.email': 'البريد',
      'admin.col.orders': 'الطلبات',
      'admin.col.joined': 'الانضمام',
      'admin.col.products': 'المنتجات',
      'admin.col.verify': 'التحقق',
      'admin.col.slug': 'Slug',
      'admin.col.setStatus': 'تعيين الحالة',
      'admin.col.parent': 'الأصل',
      'admin.col.price': 'السعر',
      'admin.col.stock': 'المخزون',
      'admin.col.sold': 'المباع',
      'admin.col.action': 'إجراء',
      'admin.col.category': 'الفئة',
      'admin.home': 'الرئيسية',
      'admin.dashboardTitle': 'لوحة التحكم',
      'admin.productsTitle': 'المنتجات',
      'admin.ordersTitle': 'الطلبات',
      'admin.apiError': 'خطأ API',
      'admin.verified': 'موثّق',
      'admin.unverified': 'غير موثّق',
      'admin.view': 'عرض',
      'admin.edit': 'تعديل',
      'admin.del': 'حذف',
      'admin.save': 'حفظ',
      'admin.cancel': 'إلغاء',
      'admin.form': 'نموذج',
      'merchant.dashboard': 'لوحة التحكم',
      'merchant.catalog': 'الكتالوج',
      'merchant.orders': 'الطلبات',
      'merchant.payouts': 'المدفوعات',
      'merchant.messages': 'الرسائل',
      'merchant.disputes': 'النزاعات',
      'merchant.shop': 'المتجر',
      'merchant.reports': 'التقارير',
      'merchant.account': 'الحساب',
      'merchant.products': 'المنتجات',
      'merchant.inventory': 'المخزون',
      'merchant.panel': 'لوحة التاجر',
      'merchant.myProducts': 'منتجاتي (API)',
      'merchant.shopOrders': 'طلبات المتجر (API)',
      'merchant.addProduct': 'إضافة منتج',
      'merchant.noOrders': 'لا طلبات بعد',
      'common.loading': 'جاري التحميل…',
      'common.error': 'خطأ',
      'common.general': 'عام',
      'common.root': 'جذر',
    },
  };

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS[saved]) return saved;
    return 'ru';
  }

  function getCurrency() {
    const saved = localStorage.getItem(CUR_KEY);
    if (saved && CURRENCIES[saved]) return saved;
    return 'RUB';
  }

  function setLang(code) {
    if (!LANGS[code]) return;
    localStorage.setItem(LANG_KEY, code);
    applyDocument();
    global.dispatchEvent(new CustomEvent('mplace:locale', { detail: { lang: code, currency: getCurrency() } }));
  }

  function setCurrency(code) {
    if (!CURRENCIES[code]) return;
    localStorage.setItem(CUR_KEY, code);
    applyDocument();
    global.dispatchEvent(new CustomEvent('mplace:locale', { detail: { lang: getLang(), currency: code } }));
  }

  function t(key, vars) {
    const lang = getLang();
    let s = (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return s;
  }

  /** centsUSD → display string in selected currency */
  function formatMoney(centsUSD) {
    const cur = CURRENCIES[getCurrency()] || CURRENCIES.USD;
    const amount = (Number(centsUSD || 0) / 100) * cur.rate;
    try {
      return new Intl.NumberFormat(cur.locale, {
        style: 'currency',
        currency: cur.code,
        maximumFractionDigits: cur.code === 'RUB' || cur.code === 'JPY' ? 0 : 2,
      }).format(amount);
    } catch {
      return cur.symbol + amount.toFixed(2);
    }
  }

  /** major USD units */
  function formatMoneyUSD(amountUSD) {
    return formatMoney(Math.round(Number(amountUSD || 0) * 100));
  }

  function applyDocument() {
    const lang = getLang();
    const meta = LANGS[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    document.body && document.body.setAttribute('dir', meta.dir);
    document.body && document.body.classList.toggle('rtl', meta.dir === 'rtl');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });

    // sync switchers
    document.querySelectorAll('[data-lang-select]').forEach((sel) => {
      sel.value = lang;
    });
    document.querySelectorAll('[data-currency-select]').forEach((sel) => {
      sel.value = getCurrency();
    });
  }

  function switcherHTML(opts) {
    const o = opts || {};
    const showCur = o.currency !== false;
    const lang = getLang();
    const cur = getCurrency();
    const langOpts = Object.values(LANGS)
      .map((l) => `<option value="${l.code}" ${l.code === lang ? 'selected' : ''}>${l.native}</option>`)
      .join('');
    const curOpts = Object.values(CURRENCIES)
      .map((c) => {
        const label = c.code + ' ' + c.symbol;
        return `<option value="${c.code}" ${c.code === cur ? 'selected' : ''}>${label}</option>`;
      })
      .join('');
    return `<div class="locale-switcher ${o.className || ''}">
      <label class="locale-item">
        <span class="locale-label" data-i18n="lang.label">${t('lang.label')}</span>
        <select data-lang-select class="locale-select">${langOpts}</select>
      </label>
      ${showCur ? `<label class="locale-item">
        <span class="locale-label" data-i18n="currency.label">${t('currency.label')}</span>
        <select data-currency-select class="locale-select">${curOpts}</select>
      </label>` : ''}
    </div>`;
  }

  function bindSwitchers(root) {
    const el = root || document;
    el.querySelectorAll('[data-lang-select]').forEach((sel) => {
      if (sel._mplaceBound) return;
      sel._mplaceBound = true;
      sel.addEventListener('change', () => setLang(sel.value));
    });
    el.querySelectorAll('[data-currency-select]').forEach((sel) => {
      if (sel._mplaceBound) return;
      sel._mplaceBound = true;
      sel.addEventListener('change', () => setCurrency(sel.value));
    });
  }

  function mountSwitcher(container, opts) {
    if (!container) return;
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    container.innerHTML = switcherHTML(opts);
    bindSwitchers(container);
    applyDocument();
  }

  // init early
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDocument();
      bindSwitchers();
    });
  } else {
    applyDocument();
    bindSwitchers();
  }

  global.MplaceI18n = {
    LANGS,
    CURRENCIES,
    t,
    getLang,
    setLang,
    getCurrency,
    setCurrency,
    formatMoney,
    formatMoneyUSD,
    applyDocument,
    switcherHTML,
    mountSwitcher,
    bindSwitchers,
  };
})(window);
