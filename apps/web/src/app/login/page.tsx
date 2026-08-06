"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { api, saveAuthTokens } from "@/lib/api"

const schema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const [error, setError] = useState("")
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "customer@demo.com",
      password: "123456",
    },
  })

  const onSubmit = async (data: FormData) => {
    setError("")
    try {
      const res = await api.login(data.email, data.password)
      if (!res.accessToken) {
        throw new Error("Неверный email или пароль")
      }
      saveAuthTokens(res.accessToken, res.refreshToken)
      window.location.href = "/"
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа")
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
        <h1 className="mb-8 text-center text-3xl font-bold">Вход</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              {...register("email")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="customer@demo.com"
              autoComplete="email"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Пароль</label>
            <input
              type="password"
              {...register("password")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-danger">
                {errors.password.message}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Вход…" : "Войти"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Демо: customer@demo.com / 123456
        </p>
      </div>
    </div>
  )
}
