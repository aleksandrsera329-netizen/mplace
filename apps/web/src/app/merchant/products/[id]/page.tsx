"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import {
  ProductForm,
  type ProductFormPayload,
} from "@/components/merchant/product-form"
import { ProductStockManager } from "@/components/merchant/product-stock-manager"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { useI18n } from "@/i18n/store"

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.product(id),
  })

  const handleSubmit = async (data: ProductFormPayload) => {
    setIsSubmitting(true)
    try {
      await api.updateProduct(id, {
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
        description: t("merchant.productUpdated"),
        type: "success",
      })
      router.push("/merchant/products")
    } catch (e) {
      toast({
        title: t("common.error"),
        description:
          e instanceof Error ? e.message : t("merchant.productUpdateError"),
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>
  }

  if (!product) {
    return <div>{t("product.notFound")}</div>
  }

  return (
    <div className="space-y-8">
      <Link
        href="/merchant/products"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Link>

      <h1 className="text-3xl font-bold">{t("merchant.products.edit")}</h1>

      <ProductForm
        initialData={product}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <ProductStockManager productId={id} />
    </div>
  )
}
