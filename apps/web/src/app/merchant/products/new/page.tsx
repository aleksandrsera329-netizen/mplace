"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import {
  ProductForm,
  type ProductFormPayload,
} from "@/components/merchant/product-form"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { useI18n } from "@/i18n/store"

export default function NewProductPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: ProductFormPayload) => {
    setIsSubmitting(true)
    try {
      await api.createProduct({
        name: data.name,
        sku: data.sku,
        description: data.description,
        price: data.price,
        stock: data.stock,
        categoryId: data.categoryId,
        status: data.status,
      })
      toast({
        title: t("common.success"),
        description: t("merchant.productCreated"),
        type: "success",
      })
      router.push("/merchant/products")
    } catch (e) {
      toast({
        title: t("common.error"),
        description:
          e instanceof Error ? e.message : t("merchant.productCreateError"),
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <Link
        href="/merchant/products"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Link>

      <h1 className="mb-8 text-3xl font-bold">{t("merchant.products.add")}</h1>

      <ProductForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
