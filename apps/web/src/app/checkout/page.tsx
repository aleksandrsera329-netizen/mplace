"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart"
import { api } from "@/lib/api"

const schema = z.object({
  company: z.string().min(2, "Укажите компанию"),
  contactName: z.string().min(2, "Укажите контактное лицо"),
  email: z.string().email("Некорректный email"),
  phone: z.string().min(6, "Укажите телефон"),
  comment: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function CheckoutPage() {
  const { items, itemCount, subtotalCents, refresh, clear } = useCartStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderNumbers, setOrderNumbers] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    void refresh().finally(() => setReady(true))
  }, [refresh])

  const onSubmit = async (data: FormData) => {
    if (items.length === 0) return

    setIsSubmitting(true)
    try {
      // Nest CheckoutDto: customerName, customerEmail, comment
      // company/phone go into comment (no dedicated fields on API)
      const commentParts = [
        data.company ? `Компания: ${data.company}` : null,
        data.phone ? `Тел: ${data.phone}` : null,
        data.comment?.trim() || null,
      ].filter(Boolean)

      const result = await api.checkout({
        customerName: data.contactName,
        customerEmail: data.email,
        comment: commentParts.join(" | ") || undefined,
      })

      // Backend clears cart items inside checkout transaction
      await clear()
      setOrderNumbers(
        (result.orders || []).map((o) => o.orderNumber).filter(Boolean),
      )
      setSuccess(true)
    } catch (e) {
      console.error(e)
      const msg =
        e instanceof Error
          ? e.message
          : "Не удалось оформить заказ. Проверьте endpoint."
      alert(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mb-6 text-6xl" aria-hidden>
            ✓
          </div>
          <h1 className="mb-4 text-3xl font-bold">Заявка отправлена</h1>
          <p className="mb-4 text-muted-foreground">
            Поставщики получили вашу заявку и свяжутся с вами.
          </p>
          {orderNumbers.length > 0 && (
            <p className="mb-8 text-sm text-muted-foreground">
              Номер{orderNumbers.length > 1 ? "а" : ""}:{" "}
              <span className="font-medium text-foreground">
                {orderNumbers.join(", ")}
              </span>
            </p>
          )}
          <Button asChild>
            <Link href="/">Вернуться в каталог</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted-foreground">
          Загрузка…
        </div>
      </div>
    )
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="mb-6 text-lg text-muted-foreground">Корзина пуста</p>
          <Button asChild>
            <Link href="/">Перейти в каталог</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/cart"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в корзину
        </Link>

        <h1 className="mb-8 text-3xl font-bold">Оформление заказа</h1>

        <div className="grid gap-8 lg:grid-cols-5">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 lg:col-span-3"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Компания *
              </label>
              <input
                {...register("company")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder='ООО "Энергетика"'
              />
              {errors.company && (
                <p className="mt-1 text-xs text-danger">
                  {errors.company.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Контактное лицо *
              </label>
              <input
                {...register("contactName")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Иван Иванов"
              />
              {errors.contactName && (
                <p className="mt-1 text-xs text-danger">
                  {errors.contactName.message}
                </p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Email *
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="ivan@company.ru"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Телефон *
                </label>
                <input
                  {...register("phone")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="+7 900 000-00-00"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Комментарий
              </label>
              <textarea
                {...register("comment")}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Срок поставки, особые требования..."
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Отправка…" : "Отправить заявку"}
            </Button>
          </form>

          <div className="h-fit rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <h2 className="mb-4 font-semibold">Ваша заявка</h2>
            <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
              {items.slice(0, 5).map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">
                    {item.product?.name || "Товар"} × {item.quantity}
                  </span>
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-xs">и ещё {items.length - 5}…</li>
              )}
            </ul>
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>Позиций</span>
              <span>{itemCount}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Сумма</span>
              <span className="text-accent">
                {formatMoney(subtotalCents)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
