import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BarChart3, Bot, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAuthenticated, signIn } from '@/lib/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const valid = await signIn(username.trim(), password, rememberMe)

    if (!valid) {
      setError('Invalid username or password')
      setSubmitting(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_14%_18%,rgba(14,116,244,0.22),transparent_40%),radial-gradient(ellipse_at_86%_86%,rgba(245,158,11,0.2),transparent_42%),linear-gradient(145deg,#f8fafc_0%,#f3f4f6_56%,#fff7ed_100%)] p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.55)_0%,transparent_35%,rgba(255,255,255,0.35)_75%,transparent_100%)]" />
      <div className="premium-float pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-300/35 blur-3xl" />
      <div className="premium-float-delayed pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="premium-float-slow pointer-events-none absolute left-1/2 top-20 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-200/25 blur-3xl" />

      <Card className="premium-enter relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden border border-zinc-200/70 bg-white/78 shadow-[0_42px_130px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:min-h-[calc(100vh-3rem)] md:grid md:grid-cols-[1.1fr_0.9fr]">
        <div className="premium-sheen pointer-events-none absolute inset-0" />

        <section className="relative flex flex-col justify-center border-b border-zinc-200/70 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.22),transparent_45%),linear-gradient(160deg,rgba(30,64,175,0.06),rgba(245,158,11,0.08))] p-6 sm:p-8 md:border-b-0 md:border-r md:p-10">
          <div className="premium-stagger mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-blue-300/50 bg-blue-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
            <Sparkles className="h-3.5 w-3.5" />
            AI Powered CE Operations
          </div>

          <div className="premium-stagger mb-6 rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] sm:p-5">
            <div className="flex items-center gap-4">
              <img
                src="/exceedce.com-favicon.ico"
                alt="ExceedCE logo"
                className="h-16 w-16 rounded-xl ring-2 ring-zinc-300 object-contain shadow-md sm:h-20 sm:w-20"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">ExceedCE</p>
                <h1 className="font-['Sora','Segoe_UI',sans-serif] text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">ExceedCE Command</h1>
                <p className="mt-1 text-sm text-zinc-600">Submission pipeline orchestration and analytics</p>
              </div>
            </div>
          </div>

          <p className="premium-stagger max-w-xl text-sm leading-6 text-zinc-700 sm:text-base">
            Manage course sync, roster posting, submission workflows, and real-time status intelligence from one premium control center.
          </p>

          <div className="premium-stagger mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-300/80 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-700">24x7 Pipeline</span>
            <span className="rounded-full border border-zinc-300/80 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-700">Auto Retry</span>
            <span className="rounded-full border border-zinc-300/80 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-700">Live Monitoring</span>
          </div>

          <div className="premium-stagger mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 text-center">
              <p className="text-lg font-extrabold text-zinc-900">99.9%</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Uptime</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 text-center">
              <p className="text-lg font-extrabold text-zinc-900">24x7</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Active</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 text-center">
              <p className="text-lg font-extrabold text-zinc-900">Live</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Insights</p>
            </div>
          </div>

          <div className="premium-stagger mt-7 space-y-3">
            <div className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300/60 bg-blue-50 text-blue-700">
                <Zap className="h-3.5 w-3.5" />
              </span>
              Faster record movement from pending to completion with operational safeguards.
            </div>
            <div className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/60 bg-amber-50 text-amber-700">
                <BarChart3 className="h-3.5 w-3.5" />
              </span>
              Deep insights across dashboard, logs, and completion throughput.
            </div>
            <div className="flex items-start gap-3 text-sm text-zinc-700">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              Secure role-gated access built for critical workflow continuity.
            </div>
          </div>
        </section>

        <div className="flex items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,250,251,0.98))] p-5 sm:p-8 md:p-10">
          <div className="w-full">
            <CardHeader className="premium-stagger space-y-1 px-0 pt-0">
              <CardTitle className="font-['Sora','Segoe_UI',sans-serif] text-2xl font-bold tracking-tight text-zinc-900">Welcome back</CardTitle>
              <CardDescription>Sign in to continue to ExceedCE operations panel</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-0 pb-0">
              <div className="premium-stagger grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.4)]">
                <img src="/cognitiev-logo.png" alt="Cognitiev logo" className="h-6 w-auto object-contain" />
                <p className="text-xs leading-5 text-zinc-600">
                  Built by <span className="font-bold text-zinc-900">Cognitiev</span> to power high-performance automation for mission-critical teams.
                </p>
                <p className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  <Bot className="h-3.5 w-3.5" />
                  Intelligent Workflow Engine
                </p>
              </div>

              <form className="premium-stagger space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder="Enter username"
                    disabled={submitting}
                    required
                    className="h-11 border-zinc-300/90 bg-white/90 focus-visible:ring-2 focus-visible:ring-blue-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    disabled={submitting}
                    required
                    className="h-11 border-zinc-300/90 bg-white/90 focus-visible:ring-2 focus-visible:ring-blue-300"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                    disabled={submitting}
                  />
                  Keep me signed in
                </label>

                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

                <Button
                  className="h-11 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-amber-500 text-base font-semibold text-white shadow-[0_20px_40px_-20px_rgba(30,64,175,0.85)] hover:from-blue-700 hover:via-blue-600 hover:to-amber-500"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Signing in...' : 'Sign in securely'}
                </Button>

                <p className="text-center text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                  Enterprise-grade control access for authorized operators
                </p>
              </form>
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  )
}
