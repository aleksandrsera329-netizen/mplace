"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

const itemSchema = z.object({
  name: z.string().min(1, "Название"),
  quantity: z.coerce.number().int().min(1),
  unit: z.string().optional(),
  specs: z.string().optional(),
})

const schema = z.object({
  title: z.string().min(3, "Минимум 3 символа"),
  description: z.string().optional(),
  deadline: z.string().optional(),
  items: z.array(itemSchema).min(1),
})

type FormData = z.infer<typeof schema>

export default function NewRfqPage() {
  const router = useRouter()
  const [error, setError] = useState("")

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      deadline: "",
      items: [{ name: "", quantity: 1, unit: "pcs", specs: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  const onSubmit = async (data: FormData) => {
    setError("")
    try {
      const created = await api.createRfq({
        title: data.title,
        description: data.description || undefined,
        deadline: data.deadline
          ? new Date(data.deadline).toISOString()
          : undefined,
        items: data.items.map((it) => ({
          name: it.name,
          quantity: Number(it.quantity),
          unit: it.unit || "pcs",
          specs: it.specs || undefined,
        })),
      })
      router.push(`/rfq/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать RFQ")
    }
  }

  return (
    <AccountShell
      title="Новый RFQ"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/rfq">Отмена</Link>
        </Button>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium">Тема *</label>
          <input
            {...register("title")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            placeholder="Поставка запорной арматуры"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-danger">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Описание</label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Дедлайн</label>
          <input
            type="date"
            {...register("deadline")}
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Позиции</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() =>
                append({ name: "", quantity: 1, unit: "pcs", specs: "" })
              }
            >
              <Plus className="h-4 w-4" />
              Строка
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <input
                    {...register(`items.${index}.name`)}
                    placeholder="Наименование"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min={1}
                    {...register(`items.${index}.quantity`)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    {...register(`items.${index}.unit`)}
                    placeholder="ед."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    {...register(`items.${index}.specs`)}
                    placeholder="Спеки"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {errors.items && (
            <p className="mt-2 text-xs text-danger">Добавьте хотя бы одну позицию</p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Создание…" : "Создать RFQ"}
        </Button>
      </form>
    </AccountShell>
  )
}
