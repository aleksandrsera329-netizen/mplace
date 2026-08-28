"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import {
  api,
  saveAuthTokens,
  type AuthUser,
  type LoginResponse,
} from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { postLoginPath } from "@/lib/role-routes"
import { useI18n } from "@/i18n/store"

const schema = z.object({
  email: z.string().email("email"),
  password: z.string().min(6, "password"),
})

type FormData = z.infer<typeof schema>

type MfaPhase = null | "verify" | "enroll"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { t } = useI18n()
  const [error, setError] = useState("")
  const [mfaPhase, setMfaPhase] = useState<MfaPhase>(null)
  const [tempToken, setTempToken] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [enrollSecret, setEnrollSecret] = useState("")
  const [enrollQr, setEnrollQr] = useState("")
  const [mfaBusy, setMfaBusy] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const finishLogin = (res: LoginResponse, fallbackEmail?: string) => {
    const token = res.accessToken
    if (!token) throw new Error(res.message || t("auth.tokenMissing"))
    if (res.refreshToken) saveAuthTokens(token, res.refreshToken)
    else saveAuthTokens(token)
    const user: AuthUser = res.user || {
      id: "me",
      email: fallbackEmail || "",
      role: "CUSTOMER",
    }
    setAuth(token, user)
    const next = searchParams.get("next")
    router.push(postLoginPath(user.role, next))
  }

  const onSubmit = async (data: FormData) => {
    setError("")
    setMfaPhase(null)
    try {
      const res = await api.login(data.email, data.password)
      if (res.mfaRequired || res.requires2fa || res.mfaEnrollmentRequired) {
        const tt = res.tempToken || res.partialToken || ""
        if (!tt) throw new Error(res.message || "MFA required, but no tempToken")
        setTempToken(tt)
        if (res.mfaEnrollmentRequired) {
          setMfaPhase("enroll")
          try {
            const setup = await api.mfaSetup(tt)
            setEnrollSecret(setup.secret || "")
            setEnrollQr(setup.qrCodeDataUrl || "")
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : t("auth.mfaSetupFail"),
            )
          }
        } else {
          setMfaPhase("verify")
        }
        return
      }
      finishLogin(res, data.email)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.loginError"))
    }
  }

  const submitMfaVerify = async () => {
    setError("")
    setMfaBusy(true)
    try {
      const code = totpCode.replace(/\s/g, "")
      if (code.length < 6) throw new Error(t("auth.mfaCodeShort"))
      const res = await api.mfaVerify(tempToken, code)
      finishLogin(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.mfaInvalid"))
    } finally {
      setMfaBusy(false)
    }
  }

  const submitMfaEnroll = async () => {
    setError("")
    setMfaBusy(true)
    try {
      const code = totpCode.replace(/\s/g, "")
      if (code.length < 6) throw new Error(t("auth.mfaCodeFromApp"))
      await api.mfaEnable(tempToken, code)
      // After enable, verify to get full session
      const res = await api.mfaVerify(tempToken, code)
      finishLogin(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.mfaEnableFail"))
    } finally {
      setMfaBusy(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
        <h1 className="mb-8 text-center text-3xl font-bold">{t("auth.login")}</h1>

        {!mfaPhase && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("auth.email")}</label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="email@company.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger">{t("auth.invalidEmail")}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("auth.passwordLabel")}
              </label>
              <input
                type="password"
                {...register("password")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="••••••"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-danger">
                  {t("auth.minPassword")}
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
              {isSubmitting ? t("auth.signingIn") : t("auth.loginButton")}
            </Button>
          </form>
        )}

        {mfaPhase === "verify" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {t("auth.mfaPrompt")}
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("auth.mfaCode")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
                placeholder="000000"
                maxLength={8}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              className="w-full"
              size="lg"
              disabled={mfaBusy}
              onClick={() => void submitMfaVerify()}
            >
              {mfaBusy ? t("auth.checking") : t("auth.mfaConfirm")}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setMfaPhase(null)
                setTotpCode("")
                setTempToken("")
              }}
            >
              ← {t("common.back")}
            </Button>
          </div>
        )}

        {mfaPhase === "enroll" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {t("auth.mfaEnroll")}
            </p>
            {enrollQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enrollQr}
                alt="TOTP QR"
                className="mx-auto rounded-lg border border-border bg-white p-2"
              />
            ) : null}
            {enrollSecret ? (
              <p className="break-all text-center font-mono text-xs text-muted-foreground">
                Secret: {enrollSecret}
              </p>
            ) : null}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("auth.mfaCode")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
                placeholder="000000"
                maxLength={8}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              className="w-full"
              size="lg"
              disabled={mfaBusy}
              onClick={() => void submitMfaEnroll()}
            >
              {mfaBusy ? t("auth.enabling") : t("auth.mfaEnable")}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setMfaPhase(null)
                setTotpCode("")
                setTempToken("")
              }}
            >
              ← {t("common.back")}
            </Button>
          </div>
        )}

        {!mfaPhase && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("auth.register")}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

function LoginFallback() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      {t("common.loading")}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
