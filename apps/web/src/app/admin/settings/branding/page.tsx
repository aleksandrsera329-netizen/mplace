"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Image as ImageIcon, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { useTenantStore } from "@/store/tenant"
import { RequireRole } from "@/components/require-role"
import { useI18n } from "@/i18n/store"

export default function BrandingSettingsPage() {
  return (
    <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
      <BrandingSettingsInner />
    </RequireRole>
  )
}

function BrandingSettingsInner() {
  const queryClient = useQueryClient()
  const setBranding = useTenantStore((s) => s.setBranding)
  const { t } = useI18n()

  const [form, setForm] = useState({
    name: "",
    primaryColor: "#f59e0b",
    secondaryColor: "#1e293b",
    customDomain: "",
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)

  const { data: current, isLoading } = useQuery({
    queryKey: ["tenant-branding"],
    queryFn: () => api.tenant.me(),
  })

  useEffect(() => {
    if (current) {
      setForm({
        name: current.name || "",
        primaryColor: current.primaryColor || "#f59e0b",
        secondaryColor: current.secondaryColor || "#1e293b",
        customDomain: current.domain || "",
      })
      setLogoPreview(current.logoUrl || null)
      setFaviconPreview(current.faviconUrl || null)
    }
  }, [current])

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append("name", form.name)
      formData.append("primaryColor", form.primaryColor)
      formData.append("secondaryColor", form.secondaryColor)
      if (form.customDomain) formData.append("domain", form.customDomain)
      if (logoFile) formData.append("logo", logoFile)
      if (faviconFile) formData.append("favicon", faviconFile)
      return api.tenant.updateBranding(formData)
    },
    onSuccess: (data) => {
      setBranding(data)
      queryClient.invalidateQueries({ queryKey: ["tenant-branding"] })
      toast({
        title: t("common.success"),
        description: t("branding.saved"),
        type: "success",
      })
      setLogoFile(null)
      setFaviconFile(null)
    },
    onError: (err: Error) => {
      toast({
        title: t("common.error"),
        description: err.message || t("common.error"),
        type: "error",
      })
    },
  })

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFaviconFile(file)
      setFaviconPreview(URL.createObjectURL(file))
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!current) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold">{t("branding.title")}</h1>
        <p className="text-muted-foreground">{t("branding.noTenant")}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("branding.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("branding.subtitle")}</p>
      </div>

      <div className="space-y-2">
        <Label>{t("branding.name")}</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Mplace Energy"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("branding.primaryColor")}</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={form.primaryColor}
              onChange={(e) =>
                setForm({ ...form, primaryColor: e.target.value })
              }
              className="h-10 w-14 p-1"
            />
            <Input
              value={form.primaryColor}
              onChange={(e) =>
                setForm({ ...form, primaryColor: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("branding.secondaryColor")}</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={form.secondaryColor}
              onChange={(e) =>
                setForm({ ...form, secondaryColor: e.target.value })
              }
              className="h-10 w-14 p-1"
            />
            <Input
              value={form.secondaryColor}
              onChange={(e) =>
                setForm({ ...form, secondaryColor: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("branding.logo")}</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Logo"
                className="max-h-16 max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                {t("branding.upload")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, SVG, WebP · до 2 MB
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("branding.favicon")}</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30">
            {faviconPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconPreview}
                alt="Favicon"
                className="h-8 w-8 object-contain"
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                {t("branding.upload")}
                <input
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFaviconChange}
                />
              </label>
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">ICO, PNG, SVG</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("branding.domain")}</Label>
        <Input
          value={form.customDomain}
          onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
          placeholder="marketplace.yourcompany.com"
        />
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full sm:w-auto"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Сохраняем...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {t("branding.save")}
          </>
        )}
      </Button>
    </div>
  )
}
