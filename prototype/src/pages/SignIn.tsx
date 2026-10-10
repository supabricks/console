import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LockKeyhole } from 'lucide-react'
import { Mark } from '@/App'
import { BackingTag } from '@/components/common'
import { Button } from '@/components/ui/button'

export default function SignIn() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-2.5"><Mark className="size-6" /><span className="text-[17px] font-semibold tracking-tight">supabricks</span></div>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-muted-foreground">Use your work account. Access to projects and data is set by your administrators.</p>
          <Button size="lg" className="mt-7 w-full" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => nav('/home'), 900) }}>
            {busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />} {busy ? 'Waiting for your identity provider' : 'Continue with single sign-on'}
          </Button>
          <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t pt-5 text-[13px] [&_dt]:text-muted-foreground">
            <dt>Server</dt><dd className="truncate font-mono text-[12.5px]">analytics.internal.example:8443</dd>
            <dt>Provider</dt><dd>corporate</dd>
          </dl>
          <div className="mt-3"><BackingTag id="AC-01" /></div>
        </div>
        <p className="text-xs text-muted-foreground">Supabricks stores no passwords. If you cannot sign in, ask whoever manages this server.</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-muted/40 lg:block">
        <div className="absolute inset-0 flex flex-col justify-center gap-10 p-16">
          <div className="max-w-md text-[1.75rem] leading-snug font-semibold tracking-tight">One dataset. <span className="text-oltp">PostgreSQL</span> for the application, <span className="text-olap">Spark</span> for the analysis.</div>
          <div className="grid max-w-md gap-2 font-mono text-[13px]">
            {[['oltp', 'public.orders', 'rows, as they are written'], ['olap', 'sales_analytics.app.orders', 'the same rows, as columns']].map(([tone, name, sub]) => (
              <div key={name} className="flex items-center gap-3 rounded-lg border bg-card p-3" style={{ boxShadow: `inset 3px 0 0 var(--${tone})` }}><span className="min-w-0 flex-1 truncate">{name}</span><span className="font-sans text-xs text-muted-foreground">{sub}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
