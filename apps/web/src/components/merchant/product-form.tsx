"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useI18n } from "@/i18n/store"
import { categoryLabel } from "@/lib/format"

const schema = z.object({
  name: z.string().min(2),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  categoryId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
})

type FormData = z.infer<typeof schema>

export type ProductFormPayload = {
  name: string
  sku?: string
  description?: string
  /** major units for CreateProductDto.price */
  price: number
  priceCents: number
  stock: number
  categoryId?: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
}

interface ProductFormProps {
  initialData?: {
    name?: string
    sku?: string | null
    description?: string | null
    priceCents?: number
    stock?: number
    categoryId?: string | null
    category?: { id?: string }
    status?: string
  }
  onSubmit: (data: ProductFormPayload) => Promise<void>
  isSubmitting?: boolean
}

function asCategories(data: unknown): { id: string; name: string }[] {
  if (Array.isArray(data)) return data as { id: string; name: string }[]
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items
    if (Array.isArray(items)) return items as { id: string; name: string }[]
  }
  return []
}

export function ProductForm({
  initialData,
  onSubmit,
  isSubmitting,
}: ProductFormProps) {
  const { t } = useI18n()
  const { data: categoriesRaw } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories(),
  })
  const categories = useMemo(() => asCategories(categoriesRaw), [categoriesRaw])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      price: 0,
      stock: 0,
      categoryId: "",
      status: "DRAFT",
    },
  })

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || "",
        sku: initialData.sku || "",
        description: initialData.description || "",
        price: initialData.priceCents ? initialData.priceCents / 100 : 0,
        stock: initialData.stock || 0,
        categoryId: initialData.categoryId || initialData.category?.id || "",
        status:
          (initialData.status as FormData["status"]) || "DRAFT",
      })
    }
  }, [initialData, reset])

  const handleFormSubmit = async (data: FormData) => {
    const payload: ProductFormPayload = {
      name: data.name,
      sku: data.sku || undefined,
      description: data.description || undefined,
      price: data.price,
      priceCents: Math.round(data.price * 100),
      stock: data.stock,
      categoryId: data.categoryId || undefined,
      status: data.status,
    }
    await onSubmit(payload)
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="max-w-2xl space-y-6"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium">{t("common.name")} *</label>
        <input
          {...register("name")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder="Centrifugal Process Pump 4x3-10"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger">{t("form.minChars")}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">SKU</label>
          <input
            {...register("sku")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            placeholder="PUMP-4X3-10"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("common.status")}</label>
          <select
            {...register("status")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="DRAFT">{t("status.DRAFT")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="ARCHIVED">{t("status.ARCHIVED")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("form.priceLabel")} *</label>
          <input
            type="number"
            step="0.01"
            {...register("price")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {errors.price && (
            <p className="mt-1 text-xs text-danger">{t("form.priceNegative")}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("common.stock")} *</label>
          <input
            type="number"
            {...register("stock")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {errors.stock && (
            <p className="mt-1 text-xs text-danger">{errors.stock.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">{t("catalog.categories")}</label>
        <select
          {...register("categoryId")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          <option value="">{t("form.noCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c, t)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">{t("product.description")}</label>
        <textarea
          {...register("description")}
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder={t("form.descriptionPh")}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("form.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  )
}
