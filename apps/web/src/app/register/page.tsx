"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { api, saveAuthTokens, type LoginResponse } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { homePathForRole } from "@/lib/role-routes"

const customerSchema = z.object({
  name: z.string().min(2, "Укажите имя"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
})

const merchantSchema = customerSchema.extend({
  shopName: z.string().min(2, "Укажите название магазина"),
  shopSlug: z.string().optional(),
})

type CustomerForm = z.infer<typeof customerSchema>
type MerchantForm = z.infer<typeof merchantSchema>

type Mode = "customer" | "merchant"

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<Mode>("customer")
  const [error, setError] = useState("")

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  const merchantForm = useForm<MerchantForm>({
    resolver: zodResolver(merchantSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      shopName: "",
      shopSlug: "",
    },
  })

  const applySession = (res: LoginResponse) => {
    const token = res.accessToken
    if (!token) throw new Error(res.message || "Токен не получен")
    if (res.refreshToken) saveAuthTokens(token, res.refreshToken)
    else saveAuthTokens(token)
    const user = res.user || {
      id: "me",
      email: "",
      role: mode === "merchant" ? "MERCHANT" : "CUSTOMER",
    }
    setAuth(token, user)
    router.push(homePathForRole(user.role))
  }

  const onCustomer = async (data: CustomerForm) => {
    setError("")
    try {
      const res = await api.registerCustomer({
        name: data.name,
        email: data.email,
        password: data.password,
      })
      applySession(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка регистрации")
    }
  }

  const onMerchant = async (data: MerchantForm) => {
    setError("")
    try {
      const res = await api.registerMerchant({
        name: data.name,
        email: data.email,
        password: data.password,
        shopName: data.shopName,
        shopSlug: data.shopSlug || undefined,
      })
      applySession(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка регистрации")
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
        <h1 className="mb-2 text-center text-3xl font-bold">Регистрация</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Stage 20 — Next.js auth (customer / merchant)
        </p>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-border p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "customer"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
            onClick={() => {
              setMode("customer")
              setError("")
            }}
          >
            Покупатель
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "merchant"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
            onClick={() => {
              setMode("merchant")
              setError("")
            }}
          >
            Продавец
          </button>
        </div>

        {mode === "customer" ? (
          <form
            onSubmit={customerForm.handleSubmit(onCustomer)}
            className="space-y-4"
          >
            <Field
              label="Имя"
              error={customerForm.formState.errors.name?.message}
            >
              <input
                {...customerForm.register("name")}
                className={inputCls}
                autoComplete="name"
              />
            </Field>
            <Field
              label="Email"
              error={customerForm.formState.errors.email?.message}
            >
              <input
                type="email"
                {...customerForm.register("email")}
                className={inputCls}
                autoComplete="email"
              />
            </Field>
            <Field
              label="Пароль"
              error={customerForm.formState.errors.password?.message}
            >
              <input
                type="password"
                {...customerForm.register("password")}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={customerForm.formState.isSubmitting}
            >
              {customerForm.formState.isSubmitting
                ? "Создаём…"
                : "Создать аккаунт"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={merchantForm.handleSubmit(onMerchant)}
            className="space-y-4"
          >
            <Field
              label="Контактное лицо"
              error={merchantForm.formState.errors.name?.message}
            >
              <input
                {...merchantForm.register("name")}
                className={inputCls}
                autoComplete="name"
              />
            </Field>
            <Field
              label="Email"
              error={merchantForm.formState.errors.email?.message}
            >
              <input
                type="email"
                {...merchantForm.register("email")}
                className={inputCls}
                autoComplete="email"
              />
            </Field>
            <Field
              label="Пароль"
              error={merchantForm.formState.errors.password?.message}
            >
              <input
                type="password"
                {...merchantForm.register("password")}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
            <Field
              label="Название магазина"
              error={merchantForm.formState.errors.shopName?.message}
            >
              <input {...merchantForm.register("shopName")} className={inputCls} />
            </Field>
            <Field label="Slug (опционально)">
              <input
                {...merchantForm.register("shopSlug")}
                className={inputCls}
                placeholder="my-shop"
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={merchantForm.formState.isSubmitting}
            >
              {merchantForm.formState.isSubmitting
                ? "Создаём…"
                : "Зарегистрировать магазин"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Магазин создаётся в статусе pending — потребуется KYC.
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
