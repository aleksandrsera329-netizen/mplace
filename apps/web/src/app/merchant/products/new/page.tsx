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

export default function NewProductPage() {
  const router = useRouter()
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
        title: "Успешно",
        description: "Товар создан",
        type: "success",
      })
      router.push("/merchant/products")
    } catch (e) {
      toast({
        title: "Ошибка",
        description:
          e instanceof Error ? e.message : "Ошибка создания товара",
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
        Назад к товарам
      </Link>

      <h1 className="mb-8 text-3xl font-bold">Новый товар</h1>

      <ProductForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
