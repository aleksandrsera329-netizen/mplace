/** Server-side catalog load (Next → Nest on Render: INTERNAL_API_URL). */

export type CatalogProduct = {
  id: string
  name: string
  slug?: string | null
  sku?: string | null
  priceCents: number
  currency?: string | null
  stock: number
  imageUrl?: string | null
  categoryId?: string | null
  shopId?: string
  category?: { id?: string; name: string; slug?: string }
  shop?: { id?: string; name: string }
}

export type CatalogListItem = { id: string; name: string; slug?: string }

function asList(data: unknown): CatalogListItem[] {
  if (Array.isArray(data)) return data as CatalogListItem[]
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items
    if (Array.isArray(items)) return items as CatalogListItem[]
  }
  return []
}

function apiBase() {
  return (
    process.env.INTERNAL_API_URL ||
    (process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_API_URL
      : "http://127.0.0.1:3001/api")
  )
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`catalog ${path} ${res.status}`)
  return res.json()
}

export async function loadCatalog() {
  try {
    const [pJson, cJson, sJson] = await Promise.all([
      getJson("/products?limit=100"),
      getJson("/categories"),
      getJson("/shops"),
    ])
    const items = Array.isArray(pJson)
      ? pJson
      : Array.isArray((pJson as { items?: unknown }).items)
        ? (pJson as { items: CatalogProduct[] }).items
        : []
    return {
      products: items as CatalogProduct[],
      categories: asList(cJson),
      shops: asList(sJson),
    }
  } catch (e) {
    console.error("loadCatalog failed", e)
    return { products: [] as CatalogProduct[], categories: [], shops: [] }
  }
}
