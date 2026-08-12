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

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
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
        title: "Успешно",
        description: "Товар обновлён",
        type: "success",
      })
      router.push("/merchant/products")
    } catch (e) {
      toast({
        title: "Ошибка",
        description:
          e instanceof Error ? e.message : "Ошибка обновления товара",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Загрузка…</div>
  }

  if (!product) {
    return <div>Товар не найден</div>
  }

  return (
    <div className="space-y-8">
      <Link
        href="/merchant/products"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к товарам
      </Link>

      <h1 className="text-3xl font-bold">Редактирование товара</h1>

      <ProductForm
        initialData={product}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <ProductStockManager productId={id} />
    </div>
  )
}
