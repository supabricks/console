import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BookOpen, Boxes, ChartNoAxesColumn, CalendarClock, Check, ChevronRight, ChevronsUpDown, Database, GitBranch, LayoutDashboard, KeyRound, LibraryBig, ListChecks, LogOut, Moon, Server, Settings, RefreshCw, ScrollText, Search, ShieldCheck, Sparkles, Sun, Tags, UserRound, Users } from 'lucide-react'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BACKING } from '@/lib/backing'
import { StoreProvider, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { AccessProvider } from '@/lib/access'
import { AlertsProvider, useAlerts } from '@/lib/alerts'
import Alerts, { AlertBell, AlertDestinations, AlertRules } from '@/pages/Alerts'
import Secrets from '@/pages/Secrets'
import Usage, { AllUsage } from '@/pages/Usage'
import { CatalogGrants, DataPermissions, ProjectAudit, Roles, RunPermissions } from '@/pages/Access'
import { AuditLog, Groups, People, ServiceAccounts, SignInSettings } from '@/pages/Admin'
import { Sessions, Versions } from '@/pages/Analytics'
import BackendStatus from '@/pages/BackendStatus'
import Branches from '@/pages/Branches'
import Catalog from '@/pages/Catalog'
import DatabaseDetail from '@/pages/DatabaseDetail'
import Databases from '@/pages/Databases'
import Home, { Overview } from '@/pages/Home'
import Jobs, { AllRuns, JobCreate, JobDetail } from '@/pages/Jobs'
import NotebookEditor from '@/pages/NotebookEditor'
import Notebooks, { Environment } from '@/pages/Notebooks'
import ObjectExplorer from '@/pages/ObjectExplorer'
import Project from '@/pages/Project'
import ProjectSettings, { InstallationSettings } from '@/pages/Settings'
import SignIn from '@/pages/SignIn'
import Imports, { ImportNew } from '@/pages/Import'
import Welcome from '@/pages/Welcome'
import SqlEditor from '@/pages/SqlEditor'
import Sync from '@/pages/Sync'
import SyncCreate from '@/pages/SyncCreate'
import SyncDetail from '@/pages/SyncDetail'
import TableEditor from '@/pages/TableEditor'

type Leaf = { to: string; label: string; match?: (p: string) => boolean }
type Section = { id: string; label: string; icon: typeof Database; tone: string; to: string; children: Leaf[] }

// Tools that operate on one database. They nest under the selected database.
const DB_TOOLS: Leaf[] = [
  { to: '/branches', label: 'Branches' },
  { to: '/tables', label: 'Table editor' },
  { to: '/sql', label: 'SQL editor' },
  { to: '/explorer', label: 'Object explorer' },
  { to: '/import', label: 'Import data' },
]
const SECTIONS: Section[] = [
  { id: 'databases', label: 'Database', icon: Database, tone: 'text-oltp', to: '/databases', children: [] },
  { id: 'sync', label: 'Sync', icon: RefreshCw, tone: 'text-muted-foreground', to: '/sync', children: [
    { to: '/sync', label: 'Pipelines', match: (p) => p.startsWith('/sync') && p !== '/sync/new' },
    { to: '/sync/new', label: 'New pipeline' },
  ] },
  { id: 'analytics', label: 'Analytics', icon: Sparkles, tone: 'text-olap', to: '/analytics/sql', children: [
    { to: '/analytics/sql', label: 'Spark SQL' },
    { to: '/analytics/versions', label: 'Versions' },
    { to: '/analytics/sessions', label: 'Sessions' },
  ] },
  { id: 'notebooks', label: 'Notebooks', icon: BookOpen, tone: 'text-olap', to: '/notebooks', children: [
    { to: '/notebooks', label: 'All notebooks', match: (p) => p.startsWith('/notebooks') && p !== '/notebooks/environment' },
    { to: '/notebooks/environment', label: 'Python environment' },
  ] },
  { id: 'jobs', label: 'Jobs', icon: CalendarClock, tone: 'text-olap', to: '/jobs', children: [
    { to: '/jobs', label: 'All jobs', match: (p) => p.startsWith('/jobs') && p !== '/jobs/new' && p !== '/jobs/runs' },
    { to: '/jobs/runs', label: 'Runs' },
    { to: '/jobs/new', label: 'New job' },
  ] },
  { id: 'catalog', label: 'Catalog', icon: LibraryBig, tone: 'text-olap', to: '/catalog', children: [
    { to: '/catalog/explorer', label: 'Tables', match: (p) => p === '/catalog' || p === '/catalog/explorer' },
    { to: '/catalog/publications', label: 'Publications' },
    { to: '/catalog/shared', label: 'Shared datasets' },
  ] },
  { id: 'alerts', label: 'Alerts', icon: Bell, tone: 'text-muted-foreground', to: '/alerts', children: [
    { to: '/alerts', label: 'Alerts', match: (p) => p === '/alerts' },
    { to: '/alerts/rules', label: 'Rules' },
    { to: '/alerts/destinations', label: 'Destinations' },
  ] },
  { id: 'access', label: 'Access', icon: ShieldCheck, tone: 'text-muted-foreground', to: '/access/roles', children: [
    { to: '/access/roles', label: 'Roles' },
    { to: '/access/data', label: 'Data permissions' },
    { to: '/access/runs', label: 'Run permissions' },
    { to: '/access/catalog', label: 'Catalog grants' },
    { to: '/access/secrets', label: 'Secrets' },
    { to: '/access/audit', label: 'Access log' },
  ] },
]
// The installation: who can sign in at all. It sits above every project.
const ADMIN: (Leaf & { icon: typeof Database })[] = [
  { to: '/admin/people', label: 'People', icon: UserRound },
  { to: '/admin/groups', label: 'Groups', icon: Users },
  { to: '/admin/services', label: 'Service accounts', icon: KeyRound },
  { to: '/admin/signin', label: 'Sign-in', icon: ShieldCheck },
  { to: '/admin/usage', label: 'Usage', icon: ChartNoAxesColumn },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/settings', label: 'Server', icon: Server },
]
const DB_TABS: [string, string][] = [['overview', 'Overview'], ['connect', 'Connect'], ['keys', 'API keys'], ['compute', 'Compute'], ['observability', 'Observability'], ['roles', 'Roles'], ['extensions', 'Extensions'], ['backups', 'Backups'], ['settings', 'Settings']]
const sectionOf = (p: string) => (/^\/(databases|branches|tables|sql|explorer|import)/.test(p) ? 'databases' : p.split('/')[1])

/** Rows meeting columns: the transactional and analytical engines over one dataset. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g stroke="var(--oltp)" strokeWidth="2.6" strokeLinecap="round"><path d="M3 6h8" /><path d="M3 12h8" /><path d="M3 18h8" /></g>
      <g stroke="var(--olap)" strokeWidth="2.6" strokeLinecap="round"><path d="M15 4v16" /><path d="M20.5 4v16" /></g>
    </svg>
  )
}

function Shell() {
  const { databases, setDbId, db, dbBranches, branchName, setBranchName, showBacking, setShowBacking, pipelines, jobs } = useStore()
  const { unseen } = useAlerts()
  const loc = useLocation()
  const nav = useNavigate()
  const path = loc.pathname
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('sb-theme') === 'dark' } catch { return false } })
  const [palette, setPalette] = useState(false)
  const current = sectionOf(path)
  const [open, setOpen] = useState<Set<string>>(new Set([current]))
  useEffect(() => { setOpen(new Set([current])) }, [current])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('sb-theme', dark ? 'dark' : 'light') } catch { /* storage unavailable */ }
  }, [dark])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((o) => !o) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const seg = path.split('/').filter(Boolean)
  const gaps = BACKING.filter((b) => b.status !== 'live').length
  const fullBleed = ['tables', 'sql', 'explorer'].includes(seg[0]) || path === '/analytics/sql' || (seg[0] === 'notebooks' && !!seg[1] && seg[1] !== 'environment')
  const atHome = seg[0] === 'home' || seg[0] === 'admin' || seg[0] === 'welcome'
  const inDb = current === 'databases' && !(seg[0] === 'databases' && !seg[1])
  const run = (fn: () => void) => { setPalette(false); fn() }
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const active = (l: Leaf) => (l.match ? l.match(path) : path === l.to || path.startsWith(`${l.to}/`))
  const pickDb = (id: string, name: string) => { setDbId(id); if (seg[0] === 'databases') nav(`/databases/${name}${seg[2] ? `/${seg[2]}` : ''}`) }

  // The path from the project down to the page in view.
  const sec = SECTIONS.find((s) => s.id === current)
  const trail: { label: ReactNode; to?: string }[] = []
  if (seg[0] === 'overview') trail.push({ label: 'Overview' })
  else if (seg[0] === 'project') trail.push({ label: 'Definition', to: '/project' }, { label: ({ files: 'Files', deploy: 'Deploy', package: 'Package' } as Record<string, string>)[seg[1]] ?? 'Resources' })
  else if (seg[0] === 'usage') trail.push({ label: 'Usage' })
  else if (seg[0] === 'settings') trail.push({ label: 'Settings' })
  else if (seg[0] === 'backend') trail.push({ label: 'Backend status' })
  else if (sec) {
    trail.push({ label: sec.label, to: sec.to })
    if (current === 'databases') {
      if (!inDb) trail.push({ label: 'All databases' })
      else trail.push({ label: 'db' }, { label: seg[0] === 'databases' ? (DB_TABS.find(([id]) => id === (seg[2] ?? 'overview'))?.[1] ?? 'Overview') : DB_TOOLS.find((t) => t.to === `/${seg[0]}`)?.label })
    } else if (seg[0] === 'sync' && seg[1] && seg[1] !== 'new') { const p = pipelines.find((x) => x.id === seg[1]); trail.push({ label: 'Pipelines', to: '/sync' }, { label: p ? <>{databases.find((d) => d.id === p.db)?.name} / <span className="font-mono text-[12.5px]">{p.branch}</span></> : 'Pipeline' }) }
    else if (seg[0] === 'jobs' && seg[1] && seg[1] !== 'new' && seg[1] !== 'runs') trail.push({ label: 'All jobs', to: '/jobs' }, { label: <span className="font-mono text-[12.5px]">{jobs.find((j) => j.id === seg[1])?.name ?? 'Job'}</span> })
    else if (seg[0] === 'notebooks' && seg[1] && seg[1] !== 'environment') trail.push({ label: 'All notebooks', to: '/notebooks' }, { label: decodeURIComponent(seg[1]) })
    else trail.push({ label: sec.children.find(active)?.label ?? sec.label })
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-0 border-b p-0">
          <Link to="/home" className="flex h-12 items-center gap-2.5 px-3.5 group-data-[collapsible=icon]:px-2.5">
            <Mark className="size-6 shrink-0" />
            <span className="text-[17px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">supabricks</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {atHome ? (
            <>
            <SidebarGroup className="pb-1"><SidebarGroupContent><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild isActive={seg[0] === 'home'} tooltip="Projects"><NavLink to="/home"><Boxes /><span>Projects</span></NavLink></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroupContent></SidebarGroup>
            <SidebarGroup className="pt-1">
              <div className="px-2 pb-1 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">Administration</div>
              <SidebarGroupContent><SidebarMenu className="gap-0.5">{ADMIN.map((a) => <SidebarMenuItem key={a.to}><SidebarMenuButton asChild isActive={path === a.to} tooltip={a.label}><NavLink to={a.to}><a.icon /><span>{a.label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
            </SidebarGroup>
            </>
          ) : (<>
          {/* Level 0: the project. Everything below belongs to it. */}
          <SidebarGroup className="pb-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton size="lg" tooltip="Project: sales-analytics" className="gap-2.5 border bg-background shadow-xs hover:bg-background">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background"><Boxes className="size-4" /></span>
                        <span className="grid min-w-0 flex-1 leading-tight">
                          <span className="text-[11px] text-muted-foreground">Project</span>
                          <span className="truncate font-semibold">sales-analytics</span>
                        </span>
                        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-60">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Your projects</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => nav('/overview')}><span className="flex-1 font-medium">sales-analytics</span><Check className="text-primary" /></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => nav('/home')}>finance-ops</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => nav('/home')}>growth</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => nav('/home')}>All projects</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === '/overview'} tooltip="Overview"><NavLink to="/overview"><LayoutDashboard /><span>Overview</span></NavLink></SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith('/project')} tooltip="Definition"><NavLink to="/project"><Boxes /><span>Definition</span></NavLink></SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === '/usage'} tooltip="Usage"><NavLink to="/usage"><ChartNoAxesColumn /><span>Usage</span></NavLink></SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === '/settings'} tooltip="Settings"><NavLink to="/settings"><Settings /><span>Settings</span></NavLink></SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Level 1: sections. Level 2: their pages. Level 3: a database's tools. */}
          <SidebarGroup className="pt-1">
            <div className="px-2 pb-1 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">In this project</div>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {SECTIONS.map((s) => {
                  const isOpen = open.has(s.id), here = current === s.id
                  return (
                    <SidebarMenuItem key={s.id}>
                      <SidebarMenuButton tooltip={s.label} onClick={() => (here ? toggle(s.id) : nav(s.to))} className={cn(here ? 'font-semibold' : 'font-medium text-sidebar-foreground/80')} aria-expanded={isOpen}>
                        <s.icon className={s.tone} /><span>{s.label}</span>
                        {s.id === 'alerts' && unseen.length > 0 && <span className="tabular ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white group-data-[collapsible=icon]:hidden">{unseen.length}</span>}
                        <ChevronRight className={cn('size-3.5! text-muted-foreground transition-transform', !(s.id === 'alerts' && unseen.length > 0) && 'ml-auto', isOpen && 'rotate-90')} />
                      </SidebarMenuButton>
                      {isOpen && s.id !== 'databases' && (
                        <SidebarMenuSub className="mr-0 pr-0">
                          {s.children.map((c) => <SidebarMenuSubItem key={c.to}><SidebarMenuSubButton asChild isActive={active(c)}><NavLink to={c.to}>{c.label}</NavLink></SidebarMenuSubButton></SidebarMenuSubItem>)}
                        </SidebarMenuSub>
                      )}
                      {isOpen && s.id === 'databases' && (
                        <SidebarMenuSub className="mr-0 pr-0">
                          <SidebarMenuSubItem><SidebarMenuSubButton asChild isActive={path === '/databases'}><NavLink to="/databases">All databases</NavLink></SidebarMenuSubButton></SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn('flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring', inDb && 'font-medium')}>
                                <span className={cn('size-2 shrink-0 rounded-full', db.state === 'running' ? 'bg-success' : 'border-[1.5px] border-muted-foreground')} />
                                <span className="truncate">{db.name}</span><ChevronsUpDown className="ml-auto size-3 text-muted-foreground" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Work in database</DropdownMenuLabel>
                                {databases.map((d) => <DropdownMenuItem key={d.id} onClick={() => pickDb(d.id, d.name)}><span className="flex-1 font-medium">{d.name}</span><StatusBadge status={d.state} />{d.id === db.id && <Check className="text-primary" />}</DropdownMenuItem>)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <SidebarMenuSub className="mr-0 ml-3 pr-0">
                              <SidebarMenuSubItem><SidebarMenuSubButton asChild size="sm" isActive={seg[0] === 'databases' && !!seg[1] && seg[2] !== 'backups'}><NavLink to={`/databases/${db.name}`}>Overview</NavLink></SidebarMenuSubButton></SidebarMenuSubItem>
                              {DB_TOOLS.map((t) => <SidebarMenuSubItem key={t.to}><SidebarMenuSubButton asChild size="sm" isActive={path === t.to || path.startsWith(`${t.to}/`)}><NavLink to={t.to}>{t.label}</NavLink></SidebarMenuSubButton></SidebarMenuSubItem>)}
                              <SidebarMenuSubItem><SidebarMenuSubButton asChild size="sm" isActive={seg[0] === 'databases' && seg[2] === 'backups'}><NavLink to={`/databases/${db.name}/backups`}>Backups</NavLink></SidebarMenuSubButton></SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          </>)}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            {showBacking && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === '/backend'} tooltip="Backend status"><NavLink to="/backend"><ListChecks /><span>Backend status</span></NavLink></SidebarMenuButton>
                <SidebarMenuBadge>{gaps}</SidebarMenuBadge>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">MO</span>
                    <span className="grid min-w-0 flex-1 leading-tight"><span className="truncate font-medium">Maya Okafor</span><span className="truncate text-xs text-muted-foreground">Administrator</span></span>
                    <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">maya.okafor@example.com</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => nav('/admin/people')}><Users /> Administration</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />} {dark ? 'Light theme' : 'Dark theme'}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/signin')}><LogOut /> Sign out</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Prototype</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowBacking(!showBacking)}><Tags /> {showBacking ? 'Hide' : 'Show'} backend tags</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/backend')}><ListChecks /> Backend status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/welcome/new-project')}><Sparkles /> Show the first-run screen</DropdownMenuItem>
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
          <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
            {atHome ? (seg[0] === 'home' ? <span className="font-medium">Projects</span> : seg[0] === 'welcome' ? <><Link to="/home" className="text-muted-foreground hover:text-foreground">Projects</Link><ChevronRight className="size-3.5 shrink-0 text-border" aria-hidden /><span className="font-medium" aria-current="page">{seg[1]}</span></> : <><span className="text-muted-foreground">Administration</span><ChevronRight className="size-3.5 shrink-0 text-border" aria-hidden /><span className="font-medium" aria-current="page">{ADMIN.find((a) => a.to === path)?.label}</span></>) : (
              <>
                <Link to="/overview" className="shrink-0 text-muted-foreground hover:text-foreground">sales-analytics</Link>
                {trail.map((t, i) => {
                  const last = i === trail.length - 1
                  return (
                    <span key={i} className="flex min-w-0 items-center gap-1.5">
                      <ChevronRight className="size-3.5 shrink-0 text-border" aria-hidden />
                      {t.label === 'db' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                            <Database className="size-3.5 text-oltp" />{db.name}<ChevronsUpDown className="size-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            {databases.map((d) => <DropdownMenuItem key={d.id} onClick={() => pickDb(d.id, d.name)}><span className="flex-1 font-medium">{d.name}</span><StatusBadge status={d.state} />{d.id === db.id && <Check className="text-primary" />}</DropdownMenuItem>)}
                            <DropdownMenuSeparator /><DropdownMenuItem onClick={() => nav('/databases')}>All databases</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : t.to && !last ? <Link to={t.to} className="truncate text-muted-foreground hover:text-foreground">{t.label}</Link> : <span className={cn('truncate', last ? 'font-medium' : 'text-muted-foreground')} aria-current={last ? 'page' : undefined}>{t.label}</span>}
                    </span>
                  )
                })}
              </>
            )}
          </nav>
          {inDb && (
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-2 flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <GitBranch className="size-3.5 text-muted-foreground" /><span className="text-muted-foreground">Branch</span><span className="truncate font-mono text-[12.5px] font-medium">{branchName}</span><ChevronsUpDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Branches of {db.name}</DropdownMenuLabel>
                {dbBranches.map((b) => (
                  <DropdownMenuItem key={b.id} onClick={() => setBranchName(b.name)}>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{b.name}</span>{b.isDefault && <span className="text-xs text-muted-foreground">default</span>}{b.name === branchName && <Check className="text-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator /><DropdownMenuItem onClick={() => nav('/branches')}>Manage branches</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setPalette(true)} className="flex h-8 w-64 items-center gap-2 rounded-md border bg-muted/50 px-2.5 text-[13px] whitespace-nowrap text-muted-foreground hover:bg-muted max-xl:w-auto">
              <Search className="size-3.5" /><span className="max-xl:hidden">Search or jump to</span>
              <kbd className="ml-auto rounded border bg-background px-1.5 text-[11px] max-xl:hidden">Ctrl K</kbd>
            </button>
            {!atHome && <AlertBell />}
            <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" className="text-muted-foreground" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
          </div>
        </header>
        <main className={fullBleed ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full max-w-[1240px] flex-1 px-8 py-7'}>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/project" element={<Project />} />
            <Route path="/project/:tab" element={<Project />} />
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
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/runs" element={<AllRuns />} />
            <Route path="/jobs/new" element={<JobCreate />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:id/:tab" element={<JobDetail />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/:tab" element={<Catalog />} />
            <Route path="/sync" element={<Sync />} />
            <Route path="/sync/new" element={<SyncCreate />} />
            <Route path="/sync/:id" element={<SyncDetail />} />
            <Route path="/sync/:id/:tab" element={<SyncDetail />} />
            <Route path="/welcome/:name" element={<Welcome />} />
            <Route path="/settings" element={<ProjectSettings />} />
            <Route path="/admin/settings" element={<InstallationSettings />} />
            <Route path="/import" element={<Imports />} />
            <Route path="/import/new" element={<ImportNew />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/admin/usage" element={<AllUsage />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/alerts/rules" element={<AlertRules />} />
            <Route path="/alerts/destinations" element={<AlertDestinations />} />
            <Route path="/access/secrets" element={<Secrets />} />
            <Route path="/access" element={<Navigate to="/access/roles" replace />} />
            <Route path="/access/roles" element={<Roles />} />
            <Route path="/access/data" element={<DataPermissions />} />
            <Route path="/access/runs" element={<RunPermissions />} />
            <Route path="/access/catalog" element={<CatalogGrants />} />
            <Route path="/access/audit" element={<ProjectAudit />} />
            <Route path="/admin" element={<Navigate to="/admin/people" replace />} />
            <Route path="/admin/people" element={<People />} />
            <Route path="/admin/groups" element={<Groups />} />
            <Route path="/admin/services" element={<ServiceAccounts />} />
            <Route path="/admin/signin" element={<SignInSettings />} />
            <Route path="/admin/audit" element={<AuditLog />} />
            <Route path="/backend" element={<BackendStatus />} />
          </Routes>
        </main>
      </SidebarInset>

      <CommandDialog open={palette} onOpenChange={setPalette} title="Search" description="Jump to a page, database or branch">
        <Command>
          <CommandInput placeholder="Search pages, databases, branches…" />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup heading="Project">
              <CommandItem onSelect={() => run(() => nav('/overview'))}><LayoutDashboard />Overview</CommandItem>
              <CommandItem onSelect={() => run(() => nav('/project'))}><Boxes />Definition</CommandItem>
              <CommandItem onSelect={() => run(() => nav('/usage'))}><ChartNoAxesColumn />Usage</CommandItem>
              <CommandItem onSelect={() => run(() => nav('/settings'))}><Settings />Settings</CommandItem>
              <CommandItem onSelect={() => run(() => nav('/home'))}><Boxes />All projects</CommandItem>
            </CommandGroup>
            {SECTIONS.map((s) => (
              <CommandGroup key={s.id} heading={s.label}>
                {(s.id === 'databases' ? [{ to: '/databases', label: 'All databases' }, ...DB_TOOLS] : s.children).map((c) => <CommandItem key={c.to} value={`${s.label} ${c.label}`} onSelect={() => run(() => nav(c.to))}><s.icon className={s.tone} />{c.label}</CommandItem>)}
              </CommandGroup>
            ))}
            <CommandGroup heading="Administration">
              {ADMIN.map((a) => <CommandItem key={a.to} value={`Administration ${a.label}`} onSelect={() => run(() => nav(a.to))}><a.icon />{a.label}</CommandItem>)}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={`Database ${db.name}`}>
              {DB_TABS.map(([id, t]) => <CommandItem key={id} value={`${db.name} ${t}`} onSelect={() => run(() => nav(`/databases/${db.name}/${id}`))}><Database />{t}</CommandItem>)}
            </CommandGroup>
            <CommandGroup heading="Switch branch">
              {dbBranches.map((b) => <CommandItem key={b.id} value={`branch ${b.name}`} onSelect={() => run(() => setBranchName(b.name))}><GitBranch /><span className="font-mono text-[12.5px]">{b.name}</span></CommandItem>)}
            </CommandGroup>
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
          <AccessProvider><AlertsProvider>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="*" element={<Shell />} />
            </Routes>
          </AlertsProvider></AccessProvider>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </StoreProvider>
    </HashRouter>
  )
}
