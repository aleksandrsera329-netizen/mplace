"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Rates UI lives on /merchant/shipping — redirect for bookmark compatibility */
export default function MerchantShippingRatesPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/merchant/shipping")
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">
      Переход к управлению доставкой…
    </p>
  )
}
