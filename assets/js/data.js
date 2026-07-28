/* Demo data for Mplace marketplace */
window.MPLACE = {
  users: {
    admin: { email: 'superadmin@demo.com', password: '123456', role: 'admin', name: 'SuperAdmin' },
    merchant: { email: 'merchant@demo.com', password: '123456', role: 'merchant', name: 'Merchant Demo', shop: 'Big Shop' }
  },
  stats: {
    customers: 23,
    customers30d: 0,
    merchants: 5,
    merchants30d: 0,
    orders: 43,
    todayTotal: 0,
    pendingVerifications: 0,
    pendingApprovals: 0,
    appealedDisputes: 3
  },
  products: [
    { id: 1, name: 'Quasi earum sint et sit autem.', sold: 41, gtin: 'JAN 2905414096640', price: 89.99, stock: 120, status: 'Active', shop: 'Big Shop', category: 'Electronics' },
    { id: 2, name: 'Amet ipsa laudantium magni repellat.', sold: 40, gtin: 'ISBN 3037849062415', price: 45.00, stock: 80, status: 'Active', shop: 'Amz Mart', category: 'Fashion' },
    { id: 3, name: 'Velit vero quae sit quos sunt.', sold: 30, gtin: 'ITF 3289461770890', price: 129.50, stock: 45, status: 'Active', shop: 'Lady Charm', category: 'Watches' },
    { id: 4, name: 'Aliquid in dolores odio quibusdam.', sold: 26, gtin: 'ITF 4752781506597', price: 34.99, stock: 200, status: 'Active', shop: 'COLOR FUSION', category: 'Home' },
    { id: 5, name: 'Nisi nesciunt voluptate qui non.', sold: 24, gtin: 'EAN 2388108308340', price: 59.00, stock: 60, status: 'Active', shop: 'Baby Blossoms', category: 'Kids' },
    { id: 6, name: 'Ut cum reprehenderit qui asperiores.', sold: 21, gtin: 'ITF 4339144166003', price: 199.00, stock: 15, status: 'Active', shop: 'Big Shop', category: 'Sports' },
    { id: 7, name: 'Confluence', sold: 0, gtin: 'EAN 4567890123456', price: 12.00, stock: 500, status: 'Active', shop: 'Amz Mart', category: 'Digital' },
    { id: 8, name: 'Paylocity', sold: 0, gtin: 'UPC 7890123456789', price: 29.00, stock: 100, status: 'Draft', shop: 'Big Shop', category: 'Digital' },
    { id: 9, name: 'Hub Spot Marketing', sold: 0, gtin: 'ITF 2567890123456', price: 99.00, stock: 50, status: 'Active', shop: 'Amz Mart', category: 'Software' },
    { id: 10, name: 'Freshping', sold: 0, gtin: 'JAN 3456789012345', price: 19.99, stock: 300, status: 'Active', shop: 'COLOR FUSION', category: 'Software' }
  ],
  orders: [
    { id: 1001, customer: 'McCullough', shop: 'Big Shop', total: 344.90, status: 'Completed', date: '2024-03-12', items: 3 },
    { id: 1002, customer: 'Jhon Doe', shop: 'Amz Mart', total: 182.70, status: 'Processing', date: '2024-03-14', items: 2 },
    { id: 1003, customer: 'Jhon Mack', shop: 'Lady Charm', total: 87.80, status: 'Shipped', date: '2024-03-15', items: 1 },
    { id: 1004, customer: 'Becky Flores', shop: 'COLOR FUSION', total: 219.20, status: 'Completed', date: '2024-03-16', items: 4 },
    { id: 1005, customer: 'jeffy', shop: 'Baby Blossoms', total: 195.30, status: 'Pending', date: '2024-03-18', items: 2 },
    { id: 1006, customer: 'Sarah Lee', shop: 'Big Shop', total: 450.00, status: 'Cancelled', date: '2024-03-19', items: 1 },
    { id: 1007, customer: 'Mike Ross', shop: 'Amz Mart', total: 67.50, status: 'Completed', date: '2024-03-20', items: 2 },
    { id: 1008, customer: 'Anna Kim', shop: 'Lady Charm', total: 312.00, status: 'Processing', date: '2024-03-21', items: 3 }
  ],
  customers: [
    { id: 1, name: 'McCullough', email: 'mccullough@demo.com', orders: 7, revenue: 3449.00, status: 'Active' },
    { id: 2, name: 'Jhon Doe', email: 'jhondoe@demo.com', orders: 6, revenue: 1827.00, status: 'Active' },
    { id: 3, name: 'Jhon Mack', email: 'jhonmack@demo.com', orders: 3, revenue: 878.00, status: 'Active' },
    { id: 4, name: 'Becky Flores', email: 'becky@demo.com', orders: 3, revenue: 2192.00, status: 'Active' },
    { id: 5, name: 'jeffy', email: 'jeffy@demo.com', orders: 3, revenue: 1953.00, status: 'Active' },
    { id: 6, name: 'Sarah Lee', email: 'sarah@demo.com', orders: 2, revenue: 540.00, status: 'Inactive' },
    { id: 7, name: 'Mike Ross', email: 'mike@demo.com', orders: 4, revenue: 980.00, status: 'Active' }
  ],
  merchants: [
    { id: 1, name: 'Merchant Demo', email: 'merchant@demo.com', shop: 'Big Shop', products: 31, revenue: 13590, status: 'Active', verified: true },
    { id: 2, name: 'Amz Owner', email: 'amz@demo.com', shop: 'Amz Mart', products: 26, revenue: 8104, status: 'Active', verified: true },
    { id: 3, name: 'Lady Seller', email: 'lady@demo.com', shop: 'Lady Charm', products: 27, revenue: 7003, status: 'Active', verified: true },
    { id: 4, name: 'Color Pro', email: 'color@demo.com', shop: 'COLOR FUSION', products: 19, revenue: 6167, status: 'Active', verified: false },
    { id: 5, name: 'Baby Seller', email: 'baby@demo.com', shop: 'Baby Blossoms', products: 21, revenue: 5810, status: 'Pending', verified: false }
  ],
  shops: [
    { id: 1, name: 'Big Shop', slug: 'big-shop', products: 31, orders: 45, rating: 4.8, status: 'Open' },
    { id: 2, name: 'Amz Mart', slug: 'amz-mart', products: 26, orders: 38, rating: 4.6, status: 'Open' },
    { id: 3, name: 'Lady Charm', slug: 'lady-charm', products: 27, orders: 40, rating: 4.7, status: 'Open' },
    { id: 4, name: 'COLOR FUSION', slug: 'color-fusion', products: 19, orders: 28, rating: 4.5, status: 'Open' },
    { id: 5, name: 'Baby Blossoms', slug: 'baby-blossoms', products: 21, orders: 32, rating: 4.9, status: 'Open' }
  ],
  categories: [
    { id: 1, name: 'Electronics', products: 109, parent: 'Root' },
    { id: 2, name: 'Fashion', products: 88, parent: 'Root' },
    { id: 3, name: 'Sports', products: 157, parent: 'Root' },
    { id: 4, name: 'Kids and Toy', products: 112, parent: 'Root' },
    { id: 5, name: 'Moms and Babies', products: 111, parent: 'Root' },
    { id: 6, name: 'Softwares', products: 136, parent: 'Root' },
    { id: 7, name: 'Home & Furniture', products: 64, parent: 'Root' },
    { id: 8, name: 'Jewelleries', products: 42, parent: 'Fashion' }
  ],
  tickets: [
    { id: 12, subject: 'Payment Method', type: 'General query', priority: 'High', updated: '3 years ago' },
    { id: 10, subject: 'Starter Support', type: 'General query', priority: 'High', updated: '3 years ago' },
    { id: 9, subject: 'Delivery boy', type: 'Merchant support', priority: 'High', updated: '3 years ago' },
    { id: 6, subject: 'How to payout', type: 'Merchant support', priority: 'High', updated: '3 years ago' },
    { id: 13, subject: 'Customer Info', type: 'General query', priority: 'Normal', updated: '3 years ago' }
  ],
  brands: [
    { name: 'Neela Calarie', sold: 94, country: 'Bahamas' },
    { name: 'Welch-Rowe', sold: 46, country: 'American Samoa' },
    { name: 'Schinner, Huel and Kunze', sold: 41, country: 'French Polynesia' },
    { name: 'Lemke-Klocko', sold: 40, country: 'Saint Martin' },
    { name: 'Nienow Group', sold: 39, country: 'Barbados' }
  ],
  featuredCategories: [
    { name: 'Jewelleries', icon: '💎' },
    { name: 'Watches', icon: '⌚' },
    { name: 'Shoes', icon: '👟' },
    { name: 'Furnitures', icon: '🛋️' },
    { name: 'Indoor Plants', icon: '🪴' },
    { name: 'Sports', icon: '⚽' },
    { name: 'Auto Parts', icon: '🔧' },
    { name: 'Sunglasses', icon: '🕶️' }
  ],
  storeProducts: [
    { name: 'Wireless Headphones Pro', price: 89.99, old: 129.99, shop: 'Big Shop', rating: 4.8 },
    { name: 'Classic Leather Watch', price: 149.00, old: 199.00, shop: 'Lady Charm', rating: 4.9 },
    { name: 'Running Shoes X200', price: 79.50, old: null, shop: 'Amz Mart', rating: 4.5 },
    { name: 'Modern Sofa Set', price: 599.00, old: 749.00, shop: 'COLOR FUSION', rating: 4.7 },
    { name: 'Indoor Monstera Plant', price: 34.99, old: null, shop: 'Baby Blossoms', rating: 4.6 },
    { name: 'Yoga Mat Premium', price: 29.00, old: 39.00, shop: 'Big Shop', rating: 4.4 },
    { name: 'Car Phone Mount', price: 19.99, old: null, shop: 'Amz Mart', rating: 4.3 },
    { name: 'Aviator Sunglasses', price: 59.00, old: 89.00, shop: 'Lady Charm', rating: 4.8 }
  ]
};
