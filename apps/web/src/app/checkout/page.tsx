"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import {
  ShippingCalculator,
  type ShippingRateOption,
} from "@/components/shipping-calculator"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"

const schema = z.object({
  customerName: z.string().min(2, "Укажите имя / контактное лицо"),
  customerEmail: z.string().email("Некорректный email"),
  comment: z.string().max(2000).optional(),
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
  const user = useAuthStore((s) => s.user)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderNumbers, setOrderNumbers] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [shippingRate, setShippingRate] = useState<ShippingRateOption | null>(
    null,
  )
  const [region, setRegion] = useState("Moscow")
  const [taxCountry, setTaxCountry] = useState("RU")
  const [taxData, setTaxData] = useState<{
    subtotalCents: number
    taxCents: number
    totalCents: number
  } | null>(null)

  // Rough weight estimate: 10 kg per line unit (B2B equipment placeholder)
  const weightKg = Math.max(
    1,
    items.reduce((s, i) => s + (i.quantity || 1) * 10, 0),
  )
  const shippingCents = shippingRate?.priceCents ?? 0
  const taxCents = taxData?.taxCents ?? 0
  const goodsSubtotal = taxData?.subtotalCents ?? subtotalCents
  const grandTotal = goodsSubtotal + taxCents + shippingCents

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      comment: "",
    },
  })

  useEffect(() => {
    void refresh().finally(() => setReady(true))
  }, [refresh])

  // Prefill contact from auth (Stage 20)
  useEffect(() => {
    if (!user) return
    reset({
      customerName: user.name || "",
      customerEmail: user.email || "",
      comment: "",
    })
  }, [user, reset])

  useEffect(() => {
    if (items.length === 0) {
      setTaxData(null)
      return
    }
    const lines = items
      .map((item) => {
        const productId = item.productId || item.product?.id
        const priceCents =
          item.product?.priceCents ?? item.priceCents ?? 0
        if (!productId) return null
        return {
          productId,
          quantity: item.quantity || 1,
          priceCents,
        }
      })
      .filter(Boolean) as Array<{
      productId: string
      quantity: number
      priceCents: number
    }>
    if (lines.length === 0) return
    void api.tax
      .calculate({ items: lines, country: taxCountry })
      .then(setTaxData)
      .catch(() => setTaxData(null))
  }, [items, taxCountry])

  const onSubmit = async (data: FormData) => {
    if (items.length === 0) return

    setIsSubmitting(true)
    try {
      // Backend: POST /api/checkout + X-Session-Key (via api.request)
      // Response: { orders: [{ id, orderNumber, ... }], message? }
      const shippingNote = shippingRate
        ? `Доставка: ${shippingRate.methodName} (${formatMoney(shippingRate.priceCents)})`
        : undefined
      const taxNote =
        taxCents > 0 ? `НДС/VAT: ${formatMoney(taxCents)}` : undefined
      const result = await api.checkout({
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        comment: [data.comment, shippingNote, taxNote]
          .filter(Boolean)
          .join("\n"),
        taxCountry,
        shipping: shippingRate
          ? {
              rateId: shippingRate.id,
              methodId: shippingRate.methodId,
              priceCents: shippingRate.priceCents,
              daysMin: shippingRate.estimatedDaysMin ?? undefined,
              daysMax: shippingRate.estimatedDaysMax ?? undefined,
            }
          : undefined,
      })

      const numbers = (result.orders || [])
        .map((o) => o.orderNumber)
        .filter(Boolean)

      // Backend clears cart in transaction; sync UI
      await clear()
      await refresh()

      setOrderNumbers(numbers)
      setSuccess(true)
    } catch (e) {
      console.error(e)
      toast({
        title: "Ошибка",
        description:
          e instanceof Error ? e.message : "Не удалось оформить заявку",
        type: "error",
      })
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
            ✅
          </div>
          <h1 className="mb-4 text-3xl font-bold">Заявка отправлена</h1>
          {orderNumbers.length > 0 && (
            <p className="mb-2 text-sm text-muted-foreground">
              Номер{orderNumbers.length > 1 ? "а" : ""}:{" "}
              <span className="font-mono font-medium text-foreground">
                {orderNumbers.join(", ")}
              </span>
            </p>
          )}
          <p className="mb-8 text-muted-foreground">
            Поставщики получили вашу заявку и свяжутся с вами.
          </p>
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
          <p className="mb-6 text-lg text-muted-foreground">Заявка пуста</p>
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
          Назад к заявке
        </Link>

        <h1 className="mb-8 text-3xl font-bold">Оформление заявки</h1>

        <div className="grid gap-8 lg:grid-cols-5">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 lg:col-span-3"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Контактное лицо *
              </label>
              <input
                {...register("customerName")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Иван Иванов"
              />
              {errors.customerName && (
                <p className="mt-1 text-xs text-danger">
                  {errors.customerName.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email *</label>
              <input
                type="email"
                {...register("customerEmail")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="ivan@company.ru"
              />
              {errors.customerEmail && (
                <p className="mt-1 text-xs text-danger">
                  {errors.customerEmail.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Регион доставки
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="Moscow">Москва</option>
                  <option value="Moscow Oblast">Московская область</option>
                  <option value="Saint Petersburg">Санкт-Петербург</option>
                  <option value="">Другой / вся РФ</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Страна (НДС / VAT)
                </label>
                <select
                  value={taxCountry}
                  onChange={(e) => setTaxCountry(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="RU">Россия (RU)</option>
                  <option value="AE">ОАЭ (AE)</option>
                  <option value="KZ">Казахстан (KZ)</option>
                </select>
              </div>
            </div>

            <ShippingCalculator
              weightKg={weightKg}
              country="RU"
              region={region || undefined}
              onSelect={setShippingRate}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Комментарий
              </label>
              <textarea
                {...register("comment")}
                rows={4}
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
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Позиций</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Подытог</span>
                <span>{formatMoney(goodsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>НДС / VAT</span>
                <span>{formatMoney(taxCents)}</span>
              </div>
              {shippingCents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Доставка</span>
                  <span>{formatMoney(shippingCents)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Итого</span>
                <span className="text-accent">{formatMoney(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
