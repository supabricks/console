import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, Eye, EyeOff, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { backing, STATUS_LABEL } from '@/lib/backing'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** Marks a screen or control whose backend is missing or has no UI today. */
export function BackingTag({ id, className, compact }: { id: string; className?: string; compact?: boolean }) {
  const { showBacking } = useStore()
  const b = backing(id)
  if (!b || b.status === 'live' || !showBacking) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex cursor-help items-center rounded border border-dashed font-medium whitespace-nowrap',
            compact ? 'size-4 justify-center text-[10px]' : 'h-5 px-1.5 text-[11px]',
            b.status === 'new' ? 'border-warning/50 bg-warning/8 text-warning' : 'border-info/50 bg-info/8 text-info',
            className,
          )}
        >
          {compact ? (b.status === 'new' ? '!' : 'i') : b.status === 'new' ? 'Needs backend' : 'API only'}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="font-medium">{b.id}, {STATUS_LABEL[b.status]}</div>
        <div className="opacity-80">{b.note}</div>
      </TooltipContent>
    </Tooltip>
  )
}

export function PageHeader({ title, description, actions, tag }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; tag?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-[1.6rem] leading-tight font-semibold tracking-tight">{title}</h1>
          {tag}
        </div>
        {description && <div className="mt-1.5 max-w-[72ch] text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

const TONE: Record<string, string> = {
  running: 'text-success', succeeded: 'text-success', healthy: 'text-success',
  lagging: 'text-warning', paused: 'text-muted-foreground', blocked: 'text-destructive', starting: 'text-info', active: 'text-success', installed: 'text-success',
  suspended: 'text-muted-foreground', idle: 'text-muted-foreground',
  provisioning: 'text-info', scaling: 'text-info',
  cancelled: 'text-warning', 'idle in transaction': 'text-warning',
  failed: 'text-destructive',
}

/** Status is always a word; the mark only reinforces it. */
export function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status] ?? 'text-muted-foreground'
  const hollow = status === 'suspended' || status === 'idle' || status === 'paused' || status === 'stopped'
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap">
      <span className={cn('size-2 rounded-full', tone, hollow ? 'border-[1.5px] border-current' : 'bg-current', (status === 'provisioning' || status === 'starting') && 'animate-pulse')} />
      <span className="capitalize">{status}</span>
    </span>
  )
}

export function copy(text: string, what = 'Copied') {
  void navigator.clipboard?.writeText(text).catch(() => undefined)
  toast.success(what)
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={() => { copy(text, 'Copied to clipboard'); setDone(true); setTimeout(() => setDone(false), 1200) }}
    >
      {done ? <Check className="text-success" /> : <Copy />}
    </Button>
  )
}

/** A labelled, copyable value. Secrets are masked until revealed. */
export function CopyField({ label, value, secret, mono = true }: { label: string; value: string; secret?: string; mono?: boolean }) {
  const [shown, setShown] = useState(false)
  const display = secret && !shown ? value.replaceAll(secret, '••••••••••••') : value
  return (
    <div>
      <div className="mb-1 text-[13px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1 rounded-md border bg-muted/50 py-1 pr-1 pl-3">
        <code className={cn('min-w-0 flex-1 truncate text-[13px]', mono && 'font-mono')}>{display}</code>
        {secret && (
          <Button variant="ghost" size="icon-sm" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}>
            {shown ? <EyeOff /> : <Eye />}
          </Button>
        )}
        <CopyButton text={value} label={`Copy ${label}`} />
      </div>
    </div>
  )
}

export function CodeBlock({ code, secret }: { code: string; secret?: string }) {
  const [shown, setShown] = useState(false)
  const display = secret && !shown ? code.replaceAll(secret, '••••••••••••') : code
  return (
    <div className="relative rounded-md border bg-muted/40">
      <div className="absolute top-1.5 right-1.5 flex gap-0.5">
        {secret && (
          <Button variant="ghost" size="icon-sm" aria-label="Toggle password" onClick={() => setShown(!shown)}>
            {shown ? <EyeOff /> : <Eye />}
          </Button>
        )}
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 pr-20 font-mono text-[13px] leading-relaxed">{display}</pre>
    </div>
  )
}

export function Sparkline({ data, color = 'var(--oltp)', className }: { data: number[]; color?: string; className?: string }) {
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${26 - ((v - min) / span) * 22}`).join(' ')
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn('h-7 w-24', className)} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** One figure in a strip. Sits on the page with a hairline rule, not in a card. */
export function Stat({ label, value, sub, tag, spark, sparkColor }: { label: string; value: ReactNode; sub?: ReactNode; tag?: ReactNode; spark?: number[]; sparkColor?: string }) {
  return (
    <div className="border-l py-0.5 pl-4">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>{label}</span>
        {tag}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="tabular text-[1.55rem] leading-none font-semibold tracking-tight">{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

/** A titled group. The title sits on the page; only the content is boxed. */
export function Section({ title, description, actions, children, tag, flush }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; tag?: ReactNode; flush?: boolean }) {
  return (
    <section>
      <header className="mb-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {tag}
          </div>
          {description && <p className="mt-0.5 max-w-[78ch] text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('rounded-lg border bg-card', flush ? 'overflow-hidden [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4' : 'p-4')}>{children}</div>
    </section>
  )
}

export function BranchSelect({ className }: { className?: string }) {
  const { dbBranches, branchName, setBranchName } = useStore()
  return (
    <Select value={branchName} onValueChange={setBranchName}>
      <SelectTrigger size="sm" className={cn('gap-1.5', className)} aria-label="Branch">
        <GitBranch className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {dbBranches.map((b) => (
          <SelectItem key={b.id} value={b.name}>
            <span className="font-mono text-[13px]">{b.name}</span>
            {b.isDefault && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">default</Badge>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Destructive confirmation that requires typing the resource name. */
export function ConfirmDelete({ open, onOpenChange, name, kind, consequence, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; name: string; kind: string; consequence: string; onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setTyped('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {kind} “{name}”?</DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-name">Type <span className="font-mono">{name}</span> to confirm</Label>
          <Input id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={typed !== name} onClick={() => { onConfirm(); onOpenChange(false); setTyped('') }}>
            Delete {kind}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-muted-foreground">{children}</div>}
    </div>
  )
}
