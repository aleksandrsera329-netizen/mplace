"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy path — redirect to merchants */
export default function AdminShopsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/merchants")
  }, [router])
  return (
    <div className="text-muted-foreground">Перенаправление на Продавцы…</div>
  )
}
