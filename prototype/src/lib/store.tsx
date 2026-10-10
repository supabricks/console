import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { API_KEYS, BRANCHES, DATABASES, PIPELINES, SESSIONS } from './data'
import { NOTEBOOKS, PACKAGES } from './notebooks'
import type { Notebook, Package } from './notebooks'
import type { ApiKey, Branch, Database, Pipeline, Session } from './data'

type Store = {
  databases: Database[]
  setDatabases: (fn: (d: Database[]) => Database[]) => void
  branches: Branch[]
  setBranches: (fn: (b: Branch[]) => Branch[]) => void
  pipelines: Pipeline[]
  setPipelines: (fn: (p: Pipeline[]) => Pipeline[]) => void
  sessions: Session[]
  setSessions: (fn: (s: Session[]) => Session[]) => void
  notebooks: Notebook[]
  setNotebooks: (fn: (n: Notebook[]) => Notebook[]) => void
  packages: Package[]
  setPackages: (fn: (p: Package[]) => Package[]) => void
  apiKeys: ApiKey[]
  setApiKeys: (fn: (k: ApiKey[]) => ApiKey[]) => void
  dbId: string
  setDbId: (id: string) => void
  branchName: string
  setBranchName: (n: string) => void
  db: Database
  branch: Branch
  dbBranches: Branch[]
  showBacking: boolean
  setShowBacking: (v: boolean) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [databases, setDbs] = useState(DATABASES)
  const [branches, setBrs] = useState(BRANCHES)
  const [apiKeys, setKeys] = useState(API_KEYS)
  const [pipelines, setPls] = useState(PIPELINES)
  const [sessions, setSes] = useState(SESSIONS)
  const [notebooks, setNbs] = useState(NOTEBOOKS)
  const [packages, setPkgs] = useState(PACKAGES)
  const [dbId, setDbIdRaw] = useState('db_app')
  const [branchName, setBranchName] = useState('main')
  const [showBacking, setShowBackingRaw] = useState(() => { try { return localStorage.getItem('sb-backing') === '1' } catch { return false } })
  const setShowBacking = (v: boolean) => { setShowBackingRaw(v); try { localStorage.setItem('sb-backing', v ? '1' : '0') } catch { /* storage unavailable */ } }

  const value = useMemo<Store>(() => {
    const db = databases.find((d) => d.id === dbId) ?? databases[0]
    const dbBranches = branches.filter((b) => b.db === db.id)
    const branch = dbBranches.find((b) => b.name === branchName) ?? dbBranches.find((b) => b.isDefault) ?? dbBranches[0]
    return {
      databases, setDatabases: (fn) => setDbs(fn),
      branches, setBranches: (fn) => setBrs(fn),
      apiKeys, setApiKeys: (fn) => setKeys(fn),
      pipelines, setPipelines: (fn) => setPls(fn),
      sessions, setSessions: (fn) => setSes(fn),
      notebooks, setNotebooks: (fn) => setNbs(fn),
      packages, setPackages: (fn) => setPkgs(fn),
      dbId: db.id,
      setDbId: (id) => { setDbIdRaw(id); setBranchName('main') },
      branchName: branch?.name ?? 'main', setBranchName,
      db, branch, dbBranches, showBacking, setShowBacking,
    }
  }, [databases, branches, apiKeys, pipelines, sessions, notebooks, packages, dbId, branchName, showBacking])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
