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
import { useI18n } from "@/i18n/store"

const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})

const merchantSchema = customerSchema.extend({
  shopName: z.string().min(2),
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
  const { t } = useI18n()

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
    if (!token) throw new Error(res.message || t("auth.tokenMissing"))
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
      setError(e instanceof Error ? e.message : t("auth.registerError"))
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
      setError(e instanceof Error ? e.message : t("auth.registerError"))
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
        <h1 className="mb-2 text-center text-3xl font-bold">
          {t("auth.registerTitle")}
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {t("auth.buyer")} / {t("auth.seller")}
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
            {t("auth.buyer")}
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
            {t("auth.seller")}
          </button>
        </div>

        {mode === "customer" ? (
          <form
            onSubmit={customerForm.handleSubmit(onCustomer)}
            className="space-y-4"
          >
            <Field
              label={t("auth.name")}
              error={customerForm.formState.errors.name ? t("auth.nameRequired") : undefined}
            >
              <input
                {...customerForm.register("name")}
                className={inputCls}
                autoComplete="name"
              />
            </Field>
            <Field
              label={t("auth.email")}
              error={customerForm.formState.errors.email ? t("auth.invalidEmail") : undefined}
            >
              <input
                type="email"
                {...customerForm.register("email")}
                className={inputCls}
                autoComplete="email"
              />
            </Field>
            <Field
              label={t("auth.passwordLabel")}
              error={customerForm.formState.errors.password ? t("auth.minPassword") : undefined}
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
                ? t("auth.signingIn")
                : t("auth.registerTitle")}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={merchantForm.handleSubmit(onMerchant)}
            className="space-y-4"
          >
            <Field
              label={t("checkout.contact")}
              error={merchantForm.formState.errors.name ? t("auth.nameRequired") : undefined}
            >
              <input
                {...merchantForm.register("name")}
                className={inputCls}
                autoComplete="name"
              />
            </Field>
            <Field
              label={t("auth.email")}
              error={merchantForm.formState.errors.email ? t("auth.invalidEmail") : undefined}
            >
              <input
                type="email"
                {...merchantForm.register("email")}
                className={inputCls}
                autoComplete="email"
              />
            </Field>
            <Field
              label={t("auth.passwordLabel")}
              error={merchantForm.formState.errors.password ? t("auth.minPassword") : undefined}
            >
              <input
                type="password"
                {...merchantForm.register("password")}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
            <Field
              label={t("auth.shopName")}
              error={merchantForm.formState.errors.shopName ? t("auth.shopRequired") : undefined}
            >
              <input {...merchantForm.register("shopName")} className={inputCls} />
            </Field>
            <Field label={t("auth.slugOptional")}>
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
                ? t("auth.signingIn")
                : t("auth.registerTitle")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("auth.pendingKyc")}
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("auth.login")}
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
