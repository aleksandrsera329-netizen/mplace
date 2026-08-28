import { HomeShell } from "./home-view"
import { loadCatalog } from "@/lib/server-catalog"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const { products, categories, shops } = await loadCatalog()
  return (
    <HomeShell products={products} categories={categories} shops={shops} />
  )
}
