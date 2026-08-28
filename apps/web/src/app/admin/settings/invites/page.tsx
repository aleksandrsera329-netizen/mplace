"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Mail, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { RequireRole } from "@/components/require-role"
import { formatDate } from "@/lib/format"
import { useI18n } from "@/i18n/store"

export default function InvitesSettingsPage() {
  return (
    <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
      <InvitesInner />
    </RequireRole>
  )
}

function InvitesInner() {
  const qc = useQueryClient()
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("BUYER")

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["tenant-invites"],
    queryFn: () => api.tenant.listInvites(),
  })

  const create = useMutation({
    mutationFn: () => api.tenant.createInvite({ email, role }),
    onSuccess: (inv) => {
      toast({
        title: t("admin.inviteCreated"),
        description: t("admin.inviteLink", { token: inv.token }),
        type: "success",
      })
      setEmail("")
      qc.invalidateQueries({ queryKey: ["tenant-invites"] })
    },
    onError: (e: Error) =>
      toast({ title: t("common.error"), description: e.message, type: "error" }),
  })

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.invites.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("admin.invites.subtitle")}
        </p>
      </div>

      <form
        className="space-y-4 rounded-xl border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("admin.invites.email")}</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.invites.role")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="BUYER">Buyer (CUSTOMER)</option>
              <option value="MERCHANT">Merchant</option>
              <option value="TENANT_ADMIN">Tenant admin</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={create.isPending || !email}>
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {t("admin.invites.send")}
        </Button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t("admin.invites.list")}</h2>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.invites.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.role} · {t("rfq.until", { date: formatDate(inv.expiresAt) })}
                      {inv.acceptedAt ? ` · ${t("admin.inviteAccepted")}` : ""}
                    </div>
                    {!inv.acceptedAt && (
                      <div className="mt-1 break-all text-xs text-primary">
                        /invite/{inv.token}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
