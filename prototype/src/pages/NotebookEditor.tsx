import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Braces, ClipboardPaste, Copy, Database, FastForward, FileText, FolderOpen, ListTree, Package, Play, Plus, RotateCw, Save, Scissors, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag } from '@/components/common'
import { CodeInput, Markdown, OutputView } from '@/components/notebook-parts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { deltaType, fmtN, SLOTS, slotsOf, TABLES } from '@/lib/data'
import { evaluate, newCell } from '@/lib/notebooks'
import type { Cell, Notebook } from '@/lib/notebooks'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Panel = 'files' | 'data' | 'outline' | 'packages' | 'variables'
type Item = { label: string; kbd?: string; on: () => void; disabled?: boolean } | 'sep'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SHORTCUTS: [string, string][] = [
  ['Shift Enter', 'Run cell, select below'], ['Ctrl Enter', 'Run cell'], ['Enter', 'Edit the selected cell'], ['Esc', 'Leave the cell (command mode)'],
  ['A / B', 'Insert cell above / below'], ['D D', 'Delete cell'], ['Z', 'Undo delete'], ['M / Y', 'Change to Markdown / code'],
  ['X / C / V', 'Cut / copy / paste cell'], ['↑ ↓ or K J', 'Select previous / next cell'], ['I I', 'Interrupt the kernel'], ['0 0', 'Restart the kernel'], ['Ctrl S', 'Save'],
]

function Tool({ label, on, children, disabled }: { label: string; on: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={on}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
  )
}

export default function NotebookEditor() {
  const { name = '' } = useParams()
  const { notebooks, setNotebooks, sessions, setSessions, pipelines, databases, packages, setPackages } = useStore()
  const nav = useNavigate()
  const nb = notebooks.find((n) => n.name === name)
  const nbRef = useRef(nb); nbRef.current = nb
  const [sel, setSel] = useState(nb?.cells[0]?.id ?? '')
  const [mode, setMode] = useState<'command' | 'edit'>('command')
  const [panel, setPanel] = useState<Panel | null>('data')
  const [clip, setClip] = useState<Cell | null>(null)
  const [undo, setUndo] = useState<{ cell: Cell; at: number } | null>(null)
  const [dialog, setDialog] = useState<'rename' | 'copy' | 'keys' | null>(null)
  const [text, setText] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const inputs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const token = useRef(0)
  const lastKey = useRef({ key: '', at: 0 })
  if (!nb) return <Navigate to="/notebooks" replace />

  const pl = pipelines.find((p) => p.id === 'pl_7c41e0a2') ?? pipelines[0]
  const plName = pl ? `${databases.find((d) => d.id === pl.db)?.name} / ${pl.branch}` : ''
  const update = (fn: (n: Notebook) => Notebook) => setNotebooks((ns) => ns.map((x) => (x.name === name ? fn(x) : x)))
  const setCells = (fn: (c: Cell[]) => Cell[]) => update((n) => ({ ...n, cells: fn(n.cells), dirty: true }))
  const patchCell = (id: string, p: Partial<Cell>) => update((n) => ({ ...n, cells: n.cells.map((c) => (c.id === id ? { ...c, ...p } : c)) }))
  const idx = nb.cells.findIndex((c) => c.id === sel)
  const cur = nb.cells[idx]
  const toCommand = () => { setMode('command'); root.current?.focus({ preventScroll: true }) }
  const toEdit = (id: string) => { setSel(id); setMode('edit'); requestAnimationFrame(() => inputs.current[id]?.focus()) }
  const select = (i: number) => { const c = nb.cells[Math.max(0, Math.min(nb.cells.length - 1, i))]; if (c) { setSel(c.id); document.getElementById(`cell-${c.id}`)?.scrollIntoView({ block: 'nearest' }) } }
  const usedElsewhere = sessions.filter((s) => s.id !== nb.session).reduce((n, s) => n + slotsOf(s), 0)
  const stale = packages.some((p) => p.prepared !== p.running)

  // ---- kernel ----
  const startKernel = async (): Promise<boolean> => {
    if (!pl) { toast.error('Nothing is synced yet. Create a pipeline in Sync first.'); return false }
    if (usedElsewhere + 1 > SLOTS) { toast.error('Analytical capacity is in use', { description: 'Close a session to start this kernel.', action: { label: 'Sessions', onClick: () => nav('/analytics/sessions') } }); return false }
    const sid = `ses_${Math.random().toString(16).slice(2, 10)}`
    setSessions((s) => [...s.filter((x) => x.id !== nbRef.current?.session), { id: sid, owner: `Notebook: ${name}`, ownerKind: 'notebook', pipeline: pl.id, version: pl.version, profile: 'compact', state: 'starting', started: '14:05', expiresMin: 15 }])
    setPackages((ps) => ps.map((p) => ({ ...p, running: p.prepared })).filter((p) => p.running))
    update((n) => ({ ...n, kernel: 'starting', session: sid, version: pl.version, execCount: 0 }))
    await sleep(1300)
    setSessions((s) => s.map((x) => (x.id === sid ? { ...x, state: 'ready' } : x)))
    update((n) => ({ ...n, kernel: 'idle' }))
    return true
  }
  const stopKernel = () => {
    token.current++
    setSessions((s) => s.filter((x) => x.id !== nb.session))
    update((n) => ({ ...n, kernel: 'stopped', session: undefined, version: null, cells: n.cells.map((c) => ({ ...c, state: undefined })) }))
    toast.success('Kernel stopped')
  }
  const restart = async (opts: { clear?: boolean; runAll?: boolean } = {}) => {
    token.current++
    update((n) => ({ ...n, cells: n.cells.map((c) => ({ ...c, state: undefined, ...(opts.clear || opts.runAll ? { outputs: [], count: null } : {}) })) }))
    if (await startKernel()) { toast.success(`Kernel restarted on version ${fmtN(pl!.version)}`); if (opts.runAll) void runCells(nbRef.current!.cells.map((c) => c.id)) }
  }
  const interrupt = () => {
    if (nb.kernel !== 'busy') return
    token.current++
    update((n) => ({ ...n, kernel: 'idle', cells: n.cells.map((c) => c.state === 'running' ? { ...c, state: undefined, outputs: [{ kind: 'error', ename: 'KeyboardInterrupt', evalue: '', traceback: '---------------------------------------------------------------------------\nKeyboardInterrupt                         Traceback (most recent call last)\n\nKeyboardInterrupt: ' }] } : { ...c, state: undefined }) }))
  }
  const runCells = async (ids: string[]) => {
    const t = ++token.current
    const code = ids.filter((id) => { const c = nbRef.current!.cells.find((x) => x.id === id); return c?.type === 'code' && c.source.trim() })
    if (!code.length) return
    if (nbRef.current!.kernel === 'stopped' && !(await startKernel())) return
    if (t !== token.current) return
    update((n) => ({ ...n, kernel: 'busy', cells: n.cells.map((c) => (code.includes(c.id) ? { ...c, state: 'queued' } : c)) }))
    for (const id of code) {
      patchCell(id, { state: 'running', outputs: [] })
      const cell = nbRef.current!.cells.find((c) => c.id === id)!
      const { outputs, ms } = evaluate(cell, packages.filter((p) => p.running).map((p) => p.name))
      await sleep(ms)
      if (t !== token.current) return
      update((n) => { const count = n.execCount + 1; return { ...n, execCount: count, cells: n.cells.map((c) => (c.id === id ? { ...c, outputs, count, state: undefined } : c)) } })
      if (outputs.some((o) => o.kind === 'error')) { update((n) => ({ ...n, cells: n.cells.map((c) => ({ ...c, state: undefined })) })); break }
    }
    if (t === token.current) update((n) => ({ ...n, kernel: 'idle' }))
  }

  // ---- cell operations ----
  const insert = (at: number, cell = newCell(), edit = false) => { setCells((cs) => [...cs.slice(0, at), cell, ...cs.slice(at)]); if (edit) toEdit(cell.id); else setSel(cell.id) }
  const remove = () => { if (!cur) return; setUndo({ cell: cur, at: idx }); setCells((cs) => (cs.length === 1 ? [newCell()] : cs.filter((c) => c.id !== cur.id))); const next = nb.cells[idx + 1] ?? nb.cells[idx - 1]; if (next) setSel(next.id) }
  const move = (d: -1 | 1) => { const j = idx + d; if (j < 0 || j >= nb.cells.length) return; setCells((cs) => { const a = [...cs]; [a[idx], a[j]] = [a[j], a[idx]]; return a }) }
  const setType = (type: Cell['type']) => cur && patchCell(cur.id, { type, outputs: [], count: null })
  const runSelected = (advance: boolean) => {
    if (!cur) return
    if (cur.type === 'code') void runCells([cur.id])
    if (!advance) { if (cur.type === 'markdown') toCommand(); return }
    if (idx === nb.cells.length - 1) insert(nb.cells.length, newCell(), true)
    else { setSel(nb.cells[idx + 1].id); toCommand() }
  }
  const save = () => { update((n) => ({ ...n, dirty: false, modified: 'Just now' })); toast.success('Notebook saved') }
  const paste = () => clip && insert(idx + 1, { ...clip, id: newCell().id })

  const onCommandKey = (e: KeyboardEvent) => {
    if (mode !== 'command' || e.target !== root.current) return
    const k = e.key, now = Date.now(), dbl = lastKey.current.key === k && now - lastKey.current.at < 600
    lastKey.current = { key: k, at: now }
    const done = () => e.preventDefault()
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') { done(); return save() }
    if (k === 'Enter' && e.shiftKey) { done(); return runSelected(true) }
    if (k === 'Enter' && (e.ctrlKey || e.metaKey)) { done(); return runSelected(false) }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (k === 'Enter') { done(); return cur && toEdit(cur.id) }
    if (k === 'ArrowUp' || k === 'k') { done(); return select(idx - 1) }
    if (k === 'ArrowDown' || k === 'j') { done(); return select(idx + 1) }
    if (k === 'a') return insert(idx)
    if (k === 'b') return insert(idx + 1)
    if (k === 'm') return setType('markdown')
    if (k === 'y') return setType('code')
    if (k === 'x') { setClip(cur); return remove() }
    if (k === 'c') return setClip(cur)
    if (k === 'v') return paste()
    if (k === 'z' && undo) { insert(undo.at, undo.cell); return setUndo(null) }
    if (k === 'd' && dbl) { lastKey.current.key = ''; return remove() }
    if (k === 'i' && dbl) return interrupt()
    if (k === '0' && dbl) return void restart()
  }
  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); return toCommand() }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); return runSelected(true) }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return runSelected(false) }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); return save() }
    if (e.key === 'Tab' && cur) {
      e.preventDefault()
      const ta = e.currentTarget, s = ta.selectionStart
      patchCell(cur.id, { source: cur.source.slice(0, s) + '    ' + cur.source.slice(ta.selectionEnd) })
      requestAnimationFrame(() => ta.setSelectionRange(s + 4, s + 4))
    }
  }

  const allIds = nb.cells.map((c) => c.id)
  const menus: [string, Item[]][] = [
    ['File', [
      { label: 'New notebook', on: () => nav('/notebooks?new=1') }, { label: 'Open…', on: () => nav('/notebooks') }, 'sep',
      { label: 'Save', kbd: 'Ctrl S', on: save }, { label: 'Save a copy…', on: () => { setText(name.replace('.ipynb', '-copy.ipynb')); setDialog('copy') } }, { label: 'Rename…', on: () => { setText(name); setDialog('rename') } },
      { label: 'Download', on: () => toast.success(`Downloaded ${name} (simulated)`) }, 'sep',
      { label: 'Close and stop kernel', on: () => { if (nb.kernel !== 'stopped') stopKernel(); nav('/notebooks') } },
    ]],
    ['Edit', [
      { label: 'Cut cell', kbd: 'X', on: () => { setClip(cur); remove() } }, { label: 'Copy cell', kbd: 'C', on: () => setClip(cur) }, { label: 'Paste cell below', kbd: 'V', on: paste, disabled: !clip }, 'sep',
      { label: 'Delete cell', kbd: 'D D', on: remove }, { label: 'Undo delete', kbd: 'Z', on: () => { if (undo) { insert(undo.at, undo.cell); setUndo(null) } }, disabled: !undo }, 'sep',
      { label: 'Move cell up', on: () => move(-1) }, { label: 'Move cell down', on: () => move(1) }, 'sep',
      { label: 'Clear output of cell', on: () => cur && patchCell(cur.id, { outputs: [], count: null }) }, { label: 'Clear outputs of all cells', on: () => setCells((cs) => cs.map((c) => ({ ...c, outputs: [], count: null }))) },
    ]],
    ['View', (['data', 'files', 'outline', 'packages', 'variables'] as Panel[]).map((p) => ({ label: `${panel === p ? 'Hide' : 'Show'} ${p} panel`, on: () => setPanel(panel === p ? null : p) }))],
    ['Run', [
      { label: 'Run selected cell', kbd: 'Ctrl Enter', on: () => runSelected(false) }, { label: 'Run cell and select below', kbd: 'Shift Enter', on: () => runSelected(true) }, 'sep',
      { label: 'Run all cells', on: () => void runCells(allIds) }, { label: 'Run all above', on: () => void runCells(allIds.slice(0, idx)) }, { label: 'Run selected and all below', on: () => void runCells(allIds.slice(idx)) },
    ]],
    ['Kernel', [
      { label: 'Interrupt', kbd: 'I I', on: interrupt, disabled: nb.kernel !== 'busy' }, { label: 'Restart', kbd: '0 0', on: () => void restart() },
      { label: 'Restart and clear outputs', on: () => void restart({ clear: true }) }, { label: 'Restart and run all', on: () => void restart({ runAll: true }) }, 'sep',
      { label: nb.kernel === 'stopped' ? 'Start kernel' : 'Stop kernel', on: () => (nb.kernel === 'stopped' ? void startKernel() : stopKernel()) },
    ]],
    ['Help', [{ label: 'Keyboard shortcuts', on: () => setDialog('keys') }]],
  ]
  const newer = pl && nb.version !== null ? pl.version - nb.version : 0
  const ran = nb.cells.some((c) => c.count !== null)
  const headings = nb.cells.flatMap((c) => (c.type === 'markdown' ? c.source.split('\n').filter((l) => /^#{1,3}\s/.test(l)).map((l) => ({ id: c.id, level: l.match(/^#+/)![0].length, text: l.replace(/^#+\s*/, '') })) : []))
  const RAIL: [Panel, typeof Database, string][] = [['files', FolderOpen, 'Files'], ['data', Database, 'Data'], ['outline', ListTree, 'Outline'], ['packages', Package, 'Packages'], ['variables', Braces, 'Variables']]

  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 shrink-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b px-3 pt-2">
        <FileText className="size-4 text-olap" />
        <button className="font-medium hover:underline" onClick={() => { setText(name); setDialog('rename') }}>{name}</button>
        <span className="text-xs text-muted-foreground">{nb.dirty ? 'Unsaved changes' : `Saved ${nb.modified.replace(/^(Yesterday|Just now)/, (m) => m.toLowerCase())}`}</span>
        <BackingTag id="NB-07" />
      </div>
      <div className="flex items-center border-b px-1.5">
        {menus.map(([label, items]) => (
          <DropdownMenu key={label}>
            <DropdownMenuTrigger className="rounded px-2 py-1 text-[13px] hover:bg-muted data-[state=open]:bg-muted">{label}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56" onCloseAutoFocus={(e) => { e.preventDefault(); if (mode === 'command') root.current?.focus({ preventScroll: true }) }}>
              {items.map((it, i) => it === 'sep' ? <DropdownMenuSeparator key={i} /> : <DropdownMenuItem key={it.label} disabled={it.disabled} onClick={it.on}>{it.label}{it.kbd && <DropdownMenuShortcut>{it.kbd}</DropdownMenuShortcut>}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
      <div className="flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
        <Tool label="Save (Ctrl S)" on={save}><Save /></Tool>
        <Tool label="Insert cell below (B)" on={() => insert(idx + 1)}><Plus /></Tool>
        <Tool label="Cut cell (X)" on={() => { setClip(cur); remove() }}><Scissors /></Tool>
        <Tool label="Copy cell (C)" on={() => setClip(cur)}><Copy /></Tool>
        <Tool label="Paste cell below (V)" on={paste} disabled={!clip}><ClipboardPaste /></Tool>
        <span className="mx-1 h-4 w-px bg-border" />
        <Tool label="Run cell and select below (Shift Enter)" on={() => runSelected(true)}><Play /></Tool>
        <Tool label="Interrupt the kernel (I I)" on={interrupt} disabled={nb.kernel !== 'busy'}><Square /></Tool>
        <Tool label="Restart the kernel (0 0)" on={() => void restart()}><RotateCw /></Tool>
        <Tool label="Restart the kernel and run all cells" on={() => void restart({ runAll: true })}><FastForward /></Tool>
        <span className="mx-1 h-4 w-px bg-border" />
        <Select value={cur?.type ?? 'code'} onValueChange={(v) => setType(v as Cell['type'])}>
          <SelectTrigger size="sm" className="w-28" aria-label="Cell type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="code">Code</SelectItem><SelectItem value="markdown">Markdown</SelectItem></SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 pr-1 text-[13px]">
          <span className="text-muted-foreground">{mode === 'edit' ? 'Edit mode' : 'Command mode'}</span>
          <span className="h-4 w-px bg-border" />
          <span>Python 3 (Supabricks)</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span role="status" aria-label={`Kernel ${nb.kernel}`} className={cn('size-3 rounded-full border-[1.5px]', nb.kernel === 'busy' ? 'border-foreground bg-foreground' : nb.kernel === 'idle' ? 'border-foreground' : nb.kernel === 'starting' ? 'animate-pulse border-info bg-info' : 'border-dashed border-muted-foreground')} />
            </TooltipTrigger>
            <TooltipContent>Kernel {nb.kernel === 'idle' ? 'idle' : nb.kernel}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-olap/8 px-3 py-1.5 text-[13px]">
        {nb.kernel === 'stopped' ? (
          <><span className="text-muted-foreground">No kernel is running. Starting one reads the latest version{pl ? ` (${fmtN(pl.version)}) of ${plName}` : ''} and takes one analytical slot.</span><Button size="xs" className="ml-auto" onClick={() => void startKernel()}><Play /> Start kernel</Button></>
        ) : (
          <>
            <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" />{nb.kernel === 'starting' ? 'Starting kernel on' : 'Kernel reads'} version <span className="tabular font-medium">{fmtN(nb.version ?? 0)}</span> of {plName}</span>
            {newer > 0 && <span className="text-muted-foreground">{fmtN(newer)} newer version{newer > 1 ? 's' : ''} exist. The kernel keeps the one it started with.</span>}
            {stale && <span className="text-warning">The environment changed. Restart to use it.</span>}
            <span className="ml-auto text-xs text-muted-foreground">Environment default, Python 3.12</span>
            {(newer > 0 || stale) && <Button size="xs" variant="outline" onClick={() => void restart()}><RotateCw /> Restart on latest</Button>}
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r bg-sidebar/50 py-2">
          {RAIL.map(([p, Icon, label]) => (
            <Tooltip key={p}><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={label} aria-pressed={panel === p} className={cn(panel === p && 'bg-accent text-accent-foreground')} onClick={() => setPanel(panel === p ? null : p)}><Icon /></Button></TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
          ))}
        </div>
        {panel && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r bg-sidebar/50 p-2 text-[13px]">
            <div className="mb-1.5 px-1.5 text-xs font-medium text-muted-foreground capitalize">{panel}</div>
            {panel === 'files' && <>{notebooks.map((n) => <Link key={n.name} to={`/notebooks/${n.name}`} className={cn('flex h-7 items-center gap-2 rounded-md px-1.5 hover:bg-accent', n.name === name && 'bg-accent font-medium')}><FileText className="size-3.5 shrink-0 text-olap" /><span className="truncate">{n.name}</span>{n.kernel !== 'stopped' && <span className="ml-auto size-1.5 rounded-full bg-success" title="Kernel running" />}</Link>)}<Link to="/notebooks" className="mt-2 block px-1.5 text-xs text-primary hover:underline">All notebooks</Link></>}
            {panel === 'data' && (pl ? <>
              <div className="flex items-center gap-2 px-1.5 pb-1 text-xs text-muted-foreground"><span className="size-2 rounded-sm bg-olap" />{plName}</div>
              {pl.tables.map((key) => { const t = TABLES.find((x) => `${x.schema}.${x.name}` === key); return (
                <details key={key} className="group">
                  <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md px-1.5 hover:bg-accent">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{key}</span>
                    <Button variant="ghost" size="icon-xs" aria-label={`Insert a cell that loads ${key}`} title="Insert a cell that loads this table" onClick={(e) => { e.preventDefault(); insert(idx + 1, newCell('code', `df = spark.table("${key}")\ndf.limit(10).toPandas()`)) }}><Plus /></Button>
                  </summary>
                  {t?.columns.map((c) => <div key={c.name} className="flex h-6 items-center gap-2 pr-1 pl-4 font-mono text-xs"><span className="truncate">{c.name}</span><span className="ml-auto shrink-0 text-olap">{deltaType(c.type).delta}</span></div>)}
                </details>) })}
              <p className="mt-2 px-1.5 text-xs text-muted-foreground">Use <code className="font-mono">spark.table()</code> or <code className="font-mono">spark.sql()</code>. Tables are read only.</p>
            </> : <p className="px-1.5 text-muted-foreground">Nothing is synced yet.</p>)}
            {panel === 'outline' && (headings.length ? headings.map((h, i) => <button key={i} className="block h-7 w-full truncate rounded-md px-1.5 text-left hover:bg-accent" style={{ paddingLeft: 6 + (h.level - 1) * 12 }} onClick={() => { setSel(h.id); document.getElementById(`cell-${h.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}>{h.text}</button>) : <p className="px-1.5 text-muted-foreground">Headings in Markdown cells appear here.</p>)}
            {panel === 'packages' && <>
              {packages.filter((p) => p.running).map((p) => <div key={p.name} className="flex h-6 items-center gap-2 px-1.5 font-mono text-xs"><span className="truncate">{p.name}</span><span className="ml-auto text-muted-foreground">{p.running}</span></div>)}
              <Link to="/notebooks/environment" className="mt-2 block px-1.5 text-xs text-primary hover:underline">Manage environment</Link>
            </>}
            {panel === 'variables' && <>
              <div className="px-1.5 pb-1"><BackingTag id="NB-05" /></div>
              {ran && nb.kernel !== 'stopped' ? [['spark', 'SparkSession', 'version ' + fmtN(nb.version ?? 0)], ['orders', 'DataFrame', '8 columns'], ['customers', 'DataFrame', '7 columns'], ['by_region', 'DataFrame', '3 columns'], ['df', 'pandas.DataFrame', '4 × 4']].map(([n, t, v]) => <div key={n} className="grid grid-cols-[auto_1fr] gap-x-2 px-1.5 py-1 font-mono text-xs"><span className="font-medium">{n}</span><span className="truncate text-right text-muted-foreground">{t}</span><span className="col-span-2 text-muted-foreground">{v}</span></div>) : <p className="px-1.5 text-muted-foreground">Run a cell to see its variables.</p>}
            </>}
          </aside>
        )}

        <div ref={root} tabIndex={0} onKeyDown={onCommandKey} className="min-w-0 flex-1 overflow-y-auto bg-background outline-none" aria-label="Notebook cells">
          <div className="mx-auto max-w-[1040px] py-4 pr-6 pl-2">
            {nb.cells.map((c, i) => {
              const on = c.id === sel, editing = on && mode === 'edit'
              const prompt = c.type === 'code' ? `[${c.state ? '*' : c.count ?? ' '}]:` : ''
              return (
                <div key={c.id} id={`cell-${c.id}`} onMouseDown={() => { if (!on) { setSel(c.id); setMode('command') } }} className={cn('group relative flex scroll-mt-4 py-1', on && 'bg-accent/40')}>
                  <div className={cn('w-1 shrink-0 rounded-full', on ? 'bg-primary' : 'bg-transparent')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex">
                      <div className={cn('w-16 shrink-0 pt-2 pr-2 text-right font-mono text-xs select-none', c.state ? 'text-primary' : 'text-muted-foreground')}>{prompt}</div>
                      <div className="min-w-0 flex-1" onDoubleClick={() => c.type === 'markdown' && toEdit(c.id)}>
                        {c.type === 'markdown' && !editing ? (
                          <div className="px-3 py-1.5" onClick={() => { setSel(c.id); toCommand() }}><Markdown source={c.source} /></div>
                        ) : (
                          <div className={cn('rounded-sm border', editing ? 'border-primary bg-background' : 'border-border bg-muted/40')}>
                            <CodeInput ref={(el) => { inputs.current[c.id] = el }} value={c.source} plain={c.type === 'markdown'} label={`${c.type === 'code' ? 'Code' : 'Markdown'} cell ${i + 1}`}
                              onChange={(v) => { patchCell(c.id, { source: v }); if (!nb.dirty) update((n) => ({ ...n, dirty: true })) }}
                              onKeyDown={onEditKey} onFocus={() => { setSel(c.id); setMode('edit') }} />
                          </div>
                        )}
                      </div>
                    </div>
                    {c.outputs.map((o, j) => (
                      <div key={j} className="mt-1.5 flex">
                        <div className="w-16 shrink-0 pt-0.5 pr-2 text-right font-mono text-xs text-muted-foreground select-none">{'result' in o && o.result ? `[${c.count}]:` : ''}</div>
                        <div className="min-w-0 flex-1 px-3 pb-1"><OutputView o={o} count={c.count} /></div>
                      </div>
                    ))}
                  </div>
                  {on && (
                    <div className="absolute -top-2 right-2 z-10 flex rounded-md border bg-background shadow-sm">
                      <Tool label="Move up" on={() => move(-1)} disabled={i === 0}><ArrowUp /></Tool>
                      <Tool label="Move down" on={() => move(1)} disabled={i === nb.cells.length - 1}><ArrowDown /></Tool>
                      <Tool label="Insert cell below" on={() => insert(i + 1)}><Plus /></Tool>
                      <Tool label="Delete cell (D D)" on={remove}><Trash2 /></Tool>
                    </div>
                  )}
                </div>
              )
            })}
            <button onClick={() => insert(nb.cells.length, newCell(), true)} className="mt-2 ml-[4.25rem] flex h-8 w-[calc(100%-4.25rem)] items-center justify-center gap-1.5 rounded-sm border border-dashed text-[13px] text-muted-foreground hover:bg-muted/50"><Plus className="size-3.5" /> Click to add a cell</button>
          </div>
        </div>
      </div>

      <Dialog open={dialog === 'rename' || dialog === 'copy'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog === 'copy' ? 'Save a copy' : 'Rename notebook'}</DialogTitle><DialogDescription>{dialog === 'copy' ? 'The copy has no running kernel.' : 'The file is renamed in the project.'}</DialogDescription></DialogHeader>
          <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Notebook name" className="font-mono" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={!/^[\w.-]+\.ipynb$/.test(text) || notebooks.some((n) => n.name === text)} onClick={() => {
              if (dialog === 'copy') setNotebooks((ns) => [...ns, { ...nb, name: text, kernel: 'stopped', session: undefined, version: null, dirty: false, modified: 'Just now' }])
              else { setNotebooks((ns) => ns.map((n) => (n.name === name ? { ...n, name: text } : n))); setSessions((s) => s.map((x) => (x.id === nb.session ? { ...x, owner: `Notebook: ${text}` } : x))) }
              setDialog(null); nav(`/notebooks/${text}`, { replace: dialog === 'rename' })
            }}>{dialog === 'copy' ? 'Save copy' : 'Rename'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'keys'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle><DialogDescription>The same shortcuts as Jupyter. Single-letter keys work in command mode.</DialogDescription></DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13px]">{SHORTCUTS.map(([k, d]) => <div key={k} className="contents"><dt><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd></dt><dd>{d}</dd></div>)}</dl>
        </DialogContent>
      </Dialog>
    </div>
  )
}
