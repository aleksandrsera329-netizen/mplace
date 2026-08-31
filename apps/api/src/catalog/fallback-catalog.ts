/** Public catalog when Postgres is unreachable (Neon suspend / network). */

export const FALLBACK_CATEGORIES = [
  { id: 'drilling-equipment', name: 'Буровое оборудование', slug: 'drilling-equipment', parent: null, _count: { products: 2 } },
  { id: 'pipeline-valves', name: 'Трубопроводы и арматура', slug: 'pipeline-valves', parent: null, _count: { products: 3 } },
  { id: 'ppe-hse', name: 'СИЗ и HSE', slug: 'ppe-hse', parent: null, _count: { products: 4 } },
  { id: 'pumps-compressors', name: 'Насосы и компрессоры', slug: 'pumps-compressors', parent: null, _count: { products: 1 } },
  { id: 'instrumentation', name: 'КИПиА', slug: 'instrumentation', parent: null, _count: { products: 1 } },
  { id: 'chemicals-fluids', name: 'Химия и жидкости', slug: 'chemicals-fluids', parent: null, _count: { products: 1 } },
];

export const FALLBACK_SHOPS = [
  { id: 'drilltech-supply', name: 'DrillTech Supply', slug: 'drilltech-supply', status: 'ACTIVE' },
  { id: 'fieldsafe-ppe', name: 'FieldSafe PPE', slug: 'fieldsafe-ppe', status: 'ACTIVE' },
  { id: 'pipe-valve-co', name: 'Pipe & Valve Co', slug: 'pipe-valve-co', status: 'ACTIVE' },
];

const img = {
  bit: '/assets/img/photos/drill-bit.jpg',
  motor: '/assets/img/photos/mud-motor.jpg',
  gate: '/assets/img/photos/gate-valve.jpg',
  ball: '/assets/img/photos/ball-valve.jpg',
  flange: '/assets/img/photos/flange.jpg',
  coverall: '/assets/img/photos/coverall-fr.jpg',
  h2s: '/assets/img/photos/respirator.jpg',
  pump: '/assets/img/photos/pump.jpg',
  tx: '/assets/img/photos/transmitter.jpg',
  chem: '/assets/img/photos/chemicals.jpg',
  gloves: '/assets/img/photos/gloves.jpg',
  harness: '/assets/img/photos/harness.jpg',
};

export const FALLBACK_PRODUCTS = [
  { id: 'mud-motor-6-75', name: 'Mud Motor 6-3/4" 5:6', slug: 'mud-motor-6-75', sku: 'DTS-DRL-001', priceCents: 485_000_000, currency: 'RUB', stock: 3, status: 'ACTIVE', imageUrl: img.motor, categoryId: 'drilling-equipment', shopId: 'drilltech-supply', shop: FALLBACK_SHOPS[0], category: FALLBACK_CATEGORIES[0] },
  { id: 'pdc-drill-bit-8-5', name: 'PDC Drill Bit 8-1/2"', slug: 'pdc-drill-bit-8-5', sku: 'DTS-DRL-002', priceCents: 192_000_000, currency: 'RUB', stock: 5, status: 'ACTIVE', imageUrl: img.bit, categoryId: 'drilling-equipment', shopId: 'drilltech-supply', shop: FALLBACK_SHOPS[0], category: FALLBACK_CATEGORIES[0] },
  { id: 'centrifugal-pump-4x3', name: 'Centrifugal Process Pump 4x3-10', slug: 'centrifugal-pump-4x3', sku: 'DTS-PMP-001', priceCents: 143_520_000, currency: 'RUB', stock: 2, status: 'ACTIVE', imageUrl: img.pump, categoryId: 'pumps-compressors', shopId: 'drilltech-supply', shop: FALLBACK_SHOPS[0], category: FALLBACK_CATEGORIES[3] },
  { id: 'drilling-fluid-pack-1t', name: 'Drilling Fluid Additive Pack (1 t)', slug: 'drilling-fluid-pack-1t', sku: 'DTS-CHM-001', priceCents: 19_320_000, currency: 'RUB', stock: 20, status: 'ACTIVE', imageUrl: img.chem, categoryId: 'chemicals-fluids', shopId: 'drilltech-supply', shop: FALLBACK_SHOPS[0], category: FALLBACK_CATEGORIES[5] },
  { id: 'h2s-escape-kit', name: 'H2S Escape Respirator Kit', slug: 'h2s-escape-kit', sku: 'FSP-PPE-001', priceCents: 2_944_000, currency: 'RUB', stock: 40, status: 'ACTIVE', imageUrl: img.h2s, categoryId: 'ppe-hse', shopId: 'fieldsafe-ppe', shop: FALLBACK_SHOPS[1], category: FALLBACK_CATEGORIES[2] },
  { id: 'fr-coverall-cat2', name: 'FR Coverall CAT2', slug: 'fr-coverall-cat2', sku: 'FSP-PPE-002', priceCents: 1_738_800, currency: 'RUB', stock: 80, status: 'ACTIVE', imageUrl: img.coverall, categoryId: 'ppe-hse', shopId: 'fieldsafe-ppe', shop: FALLBACK_SHOPS[1], category: FALLBACK_CATEGORIES[2] },
  { id: 'chemical-gloves-class-b', name: 'Chemical Gloves Class B', slug: 'chemical-gloves-class-b', sku: 'FSP-PPE-003', priceCents: 490_000, currency: 'RUB', stock: 200, status: 'ACTIVE', imageUrl: img.gloves, categoryId: 'ppe-hse', shopId: 'fieldsafe-ppe', shop: FALLBACK_SHOPS[1], category: FALLBACK_CATEGORIES[2] },
  { id: 'safety-harness-en361', name: 'Safety Harness EN 361', slug: 'safety-harness-en361', sku: 'FSP-PPE-004', priceCents: 1_275_000, currency: 'RUB', stock: 35, status: 'ACTIVE', imageUrl: img.harness, categoryId: 'ppe-hse', shopId: 'fieldsafe-ppe', shop: FALLBACK_SHOPS[1], category: FALLBACK_CATEGORIES[2] },
  { id: 'pt-0-100bar', name: 'Pressure Transmitter 0–100 bar', slug: 'pt-0-100bar', sku: 'PVC-INS-001', priceCents: 8_050_000, currency: 'RUB', stock: 15, status: 'ACTIVE', imageUrl: img.tx, categoryId: 'instrumentation', shopId: 'pipe-valve-co', shop: FALLBACK_SHOPS[2], category: FALLBACK_CATEGORIES[4] },
  { id: 'wn-flange-8-sch40', name: 'Weld Neck Flange 8" Sch 40', slug: 'wn-flange-8-sch40', sku: 'PVC-VLV-001', priceCents: 4_620_000, currency: 'RUB', stock: 25, status: 'ACTIVE', imageUrl: img.flange, categoryId: 'pipeline-valves', shopId: 'pipe-valve-co', shop: FALLBACK_SHOPS[2], category: FALLBACK_CATEGORIES[1] },
  { id: 'ball-valve-4-fb', name: 'Ball Valve 4"', slug: 'ball-valve-4-fb', sku: 'PVC-VLV-002', priceCents: 6_380_000, currency: 'RUB', stock: 18, status: 'ACTIVE', imageUrl: img.ball, categoryId: 'pipeline-valves', shopId: 'pipe-valve-co', shop: FALLBACK_SHOPS[2], category: FALLBACK_CATEGORIES[1] },
  { id: 'gate-valve-6-cl600', name: 'Gate Valve 6"', slug: 'gate-valve-6-cl600', sku: 'PVC-VLV-003', priceCents: 9_140_000, currency: 'RUB', stock: 12, status: 'ACTIVE', imageUrl: img.gate, categoryId: 'pipeline-valves', shopId: 'pipe-valve-co', shop: FALLBACK_SHOPS[2], category: FALLBACK_CATEGORIES[1] },
];

export function fallbackProductList(limit = 20) {
  const items = FALLBACK_PRODUCTS.slice(0, Math.max(1, Math.min(limit, FALLBACK_PRODUCTS.length)));
  return { items, nextCursor: null as string | null, hasMore: false };
}

export function findFallbackProduct(id: string) {
  const key = (id || '').trim();
  return (
    FALLBACK_PRODUCTS.find((p) => p.id === key || p.slug === key || p.sku === key) ||
    null
  );
}

export function isTransientDbError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Can't reach database|P1001|P1017|P2024|Connection reset|ECONNRESET|ETIMEDOUT|ECONNREFUSED|the database system is starting|Server has closed|connect E|Connection terminated/i.test(
    msg,
  );
}
