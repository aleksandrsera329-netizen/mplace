"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AccountShell } from "@/components/account-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useI18n } from "@/i18n/store"

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  company: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function ProfilePage() {
  const { user, setUser, refresh } = useAuthStore()
  const { t } = useI18n()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || "",
        phone: user.phone || "",
        company: user.company || "",
      })
    }
  }, [user, reset])

  const onSubmit = async (data: FormData) => {
    setMessage("")
    setError("")
    try {
      const updated = await api.updateMe({
        name: data.name,
        phone: data.phone || undefined,
        company: data.company || undefined,
      })
      setUser(updated)
      await refresh()
      setMessage(t("profile.saved"))
    } catch (e) {
      setError(e instanceof Error ? e.message : t("profile.saveError"))
    }
  }

  return (
    <AccountShell title={t("account.profile")}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-lg space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.email")}</label>
          <input
            value={user?.email || ""}
            disabled
            className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("account.name")} *</label>
          <input
            {...register("name")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-danger">{t("auth.nameRequired")}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("account.phone")}</label>
          <input
            {...register("phone")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            placeholder="+7 …"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("account.company")}</label>
          <input
            {...register("company")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("form.saving") : t("common.save")}
        </Button>
      </form>
    </AccountShell>
  )
}
