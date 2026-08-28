import { formatConvertedMoney } from "@/lib/money"
import { useCurrencyStore } from "@/store/currency"
import { useI18n } from "@/i18n/store"

/** Subscribe so prices/labels re-render when currency or language changes. */
export function useLivePrices() {
  const currency = useCurrencyStore((s) => s.currency)
  const locale = useI18n((s) => s.locale)
  return { currency, locale }
}

export function formatMoney(cents: number, currency = "RUB") {
  const display = useCurrencyStore.getState().currency
  const locale = useI18n.getState().locale
  return formatConvertedMoney(cents || 0, currency, display, locale)
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "—"
  const locale = useI18n.getState().locale
  const loc = locale === "ar" ? "ar" : locale === "en" ? "en-US" : "ru-RU"
  return new Intl.DateTimeFormat(loc, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function statusLabel(status: string) {
  const t = useI18n.getState().t
  const key = `status.${status}`
  const label = t(key)
  return label === key ? status : label
}

const PRODUCT_NAME_TO_SLUG: Record<string, string> = {
  'Mud Motor 6-3/4" 5:6': "mud-motor-6-75",
  'PDC Drill Bit 8-1/2"': "pdc-drill-bit-8-5",
  "Centrifugal Process Pump 4x3-10": "centrifugal-pump-4x3",
  "Drilling Fluid Additive Pack (1 t)": "drilling-fluid-pack-1t",
  "H2S Escape Respirator Kit": "h2s-escape-kit",
  "FR Coverall CAT2": "fr-coverall-cat2",
  "Chemical Gloves Class B": "chemical-gloves-class-b",
  "Safety Harness EN 361": "safety-harness-en361",
  "Pressure Transmitter 0–100 bar": "pt-0-100bar",
  "Pressure Transmitter 0-100 bar": "pt-0-100bar",
  'Weld Neck Flange 8" Sch 40': "wn-flange-8-sch40",
  'Ball Valve 4"': "ball-valve-4-fb",
  'Gate Valve 6"': "gate-valve-6-cl600",
}

function lookupProductSlug(input: {
  slug?: string | null
  sku?: string | null
  name?: string | null
}) {
  if (input.slug) return input.slug
  const sku = (input.sku || "").toUpperCase()
  const bySku: Record<string, string> = {
    "DTS-DRL-001": "mud-motor-6-75",
    "DTS-DRL-002": "pdc-drill-bit-8-5",
    "DTS-PMP-001": "centrifugal-pump-4x3",
    "DTS-CHM-001": "drilling-fluid-pack-1t",
    "FSP-PPE-001": "h2s-escape-kit",
    "FSP-PPE-002": "fr-coverall-cat2",
    "FSP-PPE-003": "chemical-gloves-class-b",
    "FSP-PPE-004": "safety-harness-en361",
    "PVC-INS-001": "pt-0-100bar",
    "PVC-VLV-001": "wn-flange-8-sch40",
    "PVC-VLV-002": "ball-valve-4-fb",
    "PVC-VLV-003": "gate-valve-6-cl600",
  }
  if (sku && bySku[sku]) return bySku[sku]
  if (input.name && PRODUCT_NAME_TO_SLUG[input.name]) {
    return PRODUCT_NAME_TO_SLUG[input.name]
  }
  return null
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function productLabel(
  product: {
    slug?: string | null
    sku?: string | null
    name?: string | null
    productName?: string | null
  },
  t?: TranslateFn,
) {
  const tr = t || useI18n.getState().t
  const name = product.name || product.productName || ""
  const slug = lookupProductSlug({
    slug: product.slug,
    sku: product.sku,
    name,
  })
  if (slug) {
    const key = `product.name.${slug}`
    const label = tr(key)
    if (label && label !== key) return label
  }
  return name || "—"
}

export function productDescription(
  product: {
    slug?: string | null
    sku?: string | null
    name?: string | null
    description?: string | null
  },
  t?: TranslateFn,
) {
  const tr = t || useI18n.getState().t
  const slug = lookupProductSlug(product)
  if (slug) {
    const key = `product.desc.${slug}`
    const label = tr(key)
    if (label && label !== key) return label
  }
  return product.description || ""
}

export function categoryLabel(
  cat: { slug?: string | null; name?: string | null },
  t?: TranslateFn,
) {
  const tr = t || useI18n.getState().t
  if (cat.slug) {
    const key = `category.${cat.slug}`
    const label = tr(key)
    if (label && label !== key) return label
  }
  return cat.name || "—"
}
