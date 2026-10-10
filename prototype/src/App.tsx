import { useEffect, useState } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Check, LayoutDashboard, Cpu, Layers, ChevronsUpDown, Code2, Database, FolderTree, GitBranch, LibraryBig, ListChecks, Moon, RefreshCw, Search, Sparkles, Sun, Table2, Tags } from 'lucide-react'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BACKING } from '@/lib/backing'
import { StoreProvider, useStore } from '@/lib/store'
import { Sessions, Versions } from '@/pages/Analytics'
import BackendStatus from '@/pages/BackendStatus'
import Branches from '@/pages/Branches'
import DatabaseDetail from '@/pages/DatabaseDetail'
import Home, { Overview } from '@/pages/Home'
import Catalog from '@/pages/Catalog'
import Databases from '@/pages/Databases'
import NotebookEditor from '@/pages/NotebookEditor'
import Notebooks, { Environment } from '@/pages/Notebooks'
import ObjectExplorer from '@/pages/ObjectExplorer'
import SqlEditor from '@/pages/SqlEditor'
import Sync from '@/pages/Sync'
import SyncCreate from '@/pages/SyncCreate'
import SyncDetail from '@/pages/SyncDetail'
import TableEditor from '@/pages/TableEditor'

const NAV = [
  { to: '/databases', label: 'Databases', icon: Database },
  { to: '/branches', label: 'Branches', icon: GitBranch },
  { to: '/tables', label: 'Table editor', icon: Table2 },
  { to: '/sql', label: 'SQL editor', icon: Code2 },
  { to: '/explorer', label: 'Object explorer', icon: FolderTree },
]
const LAKE = [
  { to: '/sync', label: 'Sync', icon: RefreshCw },
  { to: '/analytics/sql', label: 'Spark SQL', icon: Sparkles },
  { to: '/analytics/versions', label: 'Versions', icon: Layers },
  { to: '/analytics/sessions', label: 'Sessions', icon: Cpu },
  { to: '/notebooks', label: 'Notebooks', icon: BookOpen },
  { to: '/catalog', label: 'Catalog', icon: LibraryBig },
]
const LATER: { label: string; icon: typeof BookOpen }[] = []
const DB_TABS = ['Overview', 'Connect', 'API keys', 'Compute', 'Observability', 'Roles', 'Extensions', 'Backups', 'Settings']

/** Rows meeting columns: the transactional and analytical engines over one dataset. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g stroke="var(--oltp)" strokeWidth="2.6" strokeLinecap="round"><path d="M3 6h8" /><path d="M3 12h8" /><path d="M3 18h8" /></g>
      <g stroke="var(--olap)" strokeWidth="2.6" strokeLinecap="round"><path d="M15 4v16" /><path d="M20.5 4v16" /></g>
    </svg>
  )
}

function Crumb({ children }: { children: React.ReactNode }) {
  return <><span className="text-border select-none" aria-hidden>/</span>{children}</>
}

function Shell() {
  const { databases, setDbId, db, dbBranches, branchName, setBranchName, showBacking, setShowBacking } = useStore()
  const loc = useLocation()
  const nav = useNavigate()
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('sb-theme') === 'dark' } catch { return false } })
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('sb-theme', dark ? 'dark' : 'light') } catch { /* storage unavailable */ }
  }, [dark])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((o) => !o) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const seg = loc.pathname.split('/').filter(Boolean)
  const gaps = BACKING.filter((b) => b.status !== 'live').length
  const fullBleed = ['tables', 'sql', 'explorer'].includes(seg[0]) || loc.pathname === '/analytics/sql' || (seg[0] === 'notebooks' && !!seg[1] && seg[1] !== 'environment')
  const scoped = !['backend', 'sync', 'analytics', 'notebooks', 'catalog', 'home', 'overview'].includes(seg[0]) && !(seg[0] === 'databases' && !seg[1])
  const run = (fn: () => void) => { setPalette(false); fn() }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 justify-center border-b">
          <Link to="/overview" className="flex items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:px-0.5">
            <Mark className="size-6 shrink-0" />
            <span className="text-[17px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">supabricks</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="pt-1">
          <SidebarGroup className="pb-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={loc.pathname === '/overview'} tooltip="Overview">
                    <NavLink to="/overview"><LayoutDashboard /><span>Overview</span></NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="gap-2"><span className="size-1.5 rounded-full bg-oltp" />Database</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((n) => (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={loc.pathname.startsWith(n.to)} tooltip={n.label}>
                      <NavLink to={n.to}><n.icon /><span>{n.label}</span></NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="gap-2"><span className="size-1.5 rounded-full bg-olap" />Lakehouse</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {LAKE.map((n) => (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={loc.pathname.startsWith(n.to)} tooltip={n.label}>
                      <NavLink to={n.to}><n.icon /><span>{n.label}</span></NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {LATER.map((n) => (
                  <SidebarMenuItem key={n.label}>
                    <SidebarMenuButton disabled tooltip={`${n.label} is not in this prototype yet`} className="opacity-45">
                      <n.icon /><span>{n.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            {showBacking && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={loc.pathname === '/backend'} tooltip="Backend status">
                  <NavLink to="/backend"><ListChecks /><span>Backend status</span></NavLink>
                </SidebarMenuButton>
                <SidebarMenuBadge>{gaps}</SidebarMenuBadge>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">LO</span>
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate font-medium">Local owner</span>
                      <span className="truncate text-xs text-muted-foreground">This device</span>
                    </span>
                    <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />} {dark ? 'Light theme' : 'Dark theme'}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Prototype</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowBacking(!showBacking)}><Tags /> {showBacking ? 'Hide' : 'Show'} backend tags</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/backend')}><ListChecks /> Backend status</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger className="text-muted-foreground" />
          <nav className="flex min-w-0 items-center gap-2 text-[13px]" aria-label="Context">
            {seg[0] === 'home' ? <span className="font-medium">This device</span> : (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <span className={scoped ? 'text-muted-foreground' : 'font-medium'}>sales-analytics</span><ChevronsUpDown className="size-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Projects</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => nav('/overview')}><span className="flex-1 font-medium">sales-analytics</span><Check className="text-primary" /></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/home')}>finance-ops</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/home')}>growth</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav('/home')}>All projects</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {scoped && (
              <>
                <Crumb>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <Database className="size-3.5 text-oltp" />{db.name}<ChevronsUpDown className="size-3 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-60">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Databases</DropdownMenuLabel>
                      {databases.map((d) => (
                        <DropdownMenuItem key={d.id} onClick={() => { setDbId(d.id); if (seg[0] === 'databases') nav(`/databases/${d.name}${seg[2] ? `/${seg[2]}` : ''}`) }}>
                          <span className="flex-1 font-medium">{d.name}</span><StatusBadge status={d.state} />{d.id === db.id && <Check className="text-primary" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => nav('/databases')}>All databases</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Crumb>
                <Crumb>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <GitBranch className="size-3.5 text-muted-foreground" /><span className="truncate font-mono text-[12.5px]">{branchName}</span><ChevronsUpDown className="size-3 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Branches of {db.name}</DropdownMenuLabel>
                      {dbBranches.map((b) => (
                        <DropdownMenuItem key={b.id} onClick={() => setBranchName(b.name)}>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{b.name}</span>
                          {b.isDefault && <span className="text-xs text-muted-foreground">default</span>}
                          {b.name === branchName && <Check className="text-primary" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => nav('/branches')}>Manage branches</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Crumb>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setPalette(true)} className="flex h-8 w-64 items-center gap-2 rounded-md border bg-muted/50 px-2.5 text-[13px] text-muted-foreground hover:bg-muted max-lg:w-auto">
              <Search className="size-3.5" /><span className="max-lg:hidden">Search or jump to</span>
              <kbd className="ml-auto rounded border bg-background px-1.5 text-[11px] max-lg:hidden">Ctrl K</kbd>
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" className="text-muted-foreground" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
          </div>
        </header>
        <main className={fullBleed ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full max-w-[1240px] flex-1 px-8 py-7'}>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/databases" element={<Databases />} />
            <Route path="/databases/:dbName" element={<DatabaseDetail />} />
            <Route path="/databases/:dbName/:tab" element={<DatabaseDetail />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/tables" element={<TableEditor />} />
            <Route path="/sql" element={<SqlEditor key="pg" />} />
            <Route path="/explorer" element={<ObjectExplorer />} />
            <Route path="/analytics" element={<Navigate to="/analytics/sql" replace />} />
            <Route path="/analytics/sql" element={<SqlEditor key="spark" engine="spark" />} />
            <Route path="/analytics/versions" element={<Versions />} />
            <Route path="/analytics/sessions" element={<Sessions />} />
            <Route path="/notebooks" element={<Notebooks />} />
            <Route path="/notebooks/environment" element={<Environment />} />
            <Route path="/notebooks/:name" element={<NotebookEditor />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/:tab" element={<Catalog />} />
            <Route path="/sync" element={<Sync />} />
            <Route path="/sync/new" element={<SyncCreate />} />
            <Route path="/sync/:id" element={<SyncDetail />} />
            <Route path="/sync/:id/:tab" element={<SyncDetail />} />
            <Route path="/backend" element={<BackendStatus />} />
          </Routes>
        </main>
      </SidebarInset>

      <CommandDialog open={palette} onOpenChange={setPalette} title="Search" description="Jump to a page, database or branch">
        <Command>
        <CommandInput placeholder="Search pages, databases, branches…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Go to">
            {[{ to: '/overview', label: 'Overview', icon: LayoutDashboard }, ...NAV, ...LAKE, { to: '/home', label: 'All projects', icon: LayoutDashboard }].map((n) => <CommandItem key={n.to} onSelect={() => run(() => nav(n.to))}><n.icon />{n.label}</CommandItem>)}
            <CommandItem onSelect={() => run(() => nav('/sync/new'))}><RefreshCw />New sync pipeline</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={`Database ${db.name}`}>
            {DB_TABS.map((t) => (
              <CommandItem key={t} value={`${db.name} ${t}`} onSelect={() => run(() => nav(`/databases/${db.name}/${t === 'API keys' ? 'keys' : t.toLowerCase()}`))}><Database />{t}</CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Switch branch">
            {dbBranches.map((b) => <CommandItem key={b.id} value={`branch ${b.name}`} onSelect={() => run(() => setBranchName(b.name))}><GitBranch /><span className="font-mono text-[12.5px]">{b.name}</span></CommandItem>)}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Switch database">
            {databases.map((d) => <CommandItem key={d.id} value={`database ${d.name}`} onSelect={() => run(() => { setDbId(d.id); nav(`/databases/${d.name}`) })}><Database />{d.name}</CommandItem>)}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Preferences">
            <CommandItem onSelect={() => run(() => setDark(!dark))}>{dark ? <Sun /> : <Moon />}Switch to {dark ? 'light' : 'dark'} theme</CommandItem>
            <CommandItem onSelect={() => run(() => setShowBacking(!showBacking))}><Tags />{showBacking ? 'Hide' : 'Show'} backend tags</CommandItem>
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </SidebarProvider>
  )
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <TooltipProvider delayDuration={150}>
          <Shell />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </StoreProvider>
    </HashRouter>
  )
}
