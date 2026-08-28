"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { useI18n } from "@/i18n/store"

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { t } = useI18n()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  })

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => api.tenant.previewInvite(token),
    enabled: Boolean(token),
  })

  const mutation = useMutation({
    mutationFn: () =>
      api.tenant.acceptInvite({
        token,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      }),
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("invite.success"),
        type: "success",
      })
      setTimeout(() => router.push("/login"), 1500)
    },
    onError: (err: Error) => {
      toast({
        title: t("common.error"),
        description: err.message || t("invite.invalidDesc"),
        type: "error",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast({
        title: t("common.error"),
        description: t("invite.confirmPassword"),
        type: "error",
      })
      return
    }
    if (form.password.length < 8) {
      toast({
        title: t("common.error"),
        description: t("invite.password"),
        type: "error",
      })
      return
    }
    mutation.mutate()
  }

  if (preview.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (preview.data && !preview.data.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-danger" />
          <h1 className="mt-4 text-xl font-bold">{t("invite.invalid")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("invite.invalidDesc")}
          </p>
          <Button className="mt-6" onClick={() => router.push("/login")}>
            {t("invite.toLogin")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("invite.title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {preview.data?.tenantName
              ? `«${preview.data.tenantName}» · ${preview.data.email}`
              : t("invite.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("invite.firstName")}</Label>
              <Input
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("invite.lastName")}</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("invite.password")}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("invite.confirmPassword")}</Label>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t("invite.join")}
              </>
            )}
          </Button>
        </form>

        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle className="h-4 w-4" />
            {t("invite.used")}
          </div>
        )}
      </div>
    </div>
  )
}
