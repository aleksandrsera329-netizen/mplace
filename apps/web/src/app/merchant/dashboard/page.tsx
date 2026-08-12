"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import MerchantHome from "../page"

/** Alias: /merchant/dashboard → same overview */
export default function MerchantDashboardAlias() {
  const router = useRouter()
  useEffect(() => {
    // Keep /merchant as canonical; optional redirect:
    // router.replace("/merchant")
  }, [router])
  return <MerchantHome />
}
