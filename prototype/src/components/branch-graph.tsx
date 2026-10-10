import type { Branch } from '@/lib/data'

/** Tree order: each branch is followed by its descendants. */
export function treeOrder(all: Branch[]): Branch[] {
  const out: Branch[] = []
  const walk = (parent: string | null) => all.filter((b) => b.parent === parent).forEach((b) => { out.push(b); walk(b.name) })
  walk(null)
  return out
}

export function depthOf(b: Branch, all: Branch[]): number {
  let d = 0, p = b.parent
  while (p) { d++; p = all.find((x) => x.name === p)?.parent ?? null }
  return d
}

/**
 * Lanes for a list of branches, one per row. Time runs left to right in
 * creation order, so a lane starts where its branch forked and runs to now.
 * A branch restored from the past forks from further back on its parent.
 */
export function BranchLanes({ rows, all, rowH, width, inUse, fresh }: {
  rows: Branch[]; all: Branch[]; rowH: number; width: number; inUse?: string; fresh?: string | null
}) {
  const padL = 10, padR = 12
  const order = [...all].sort((a, b) => a.created.localeCompare(b.created))
  const step = (width - padL - padR - 18) / Math.max(1, order.length - 1)
  const xOf = (b: Branch) => padL + order.findIndex((o) => o.id === b.id) * step
  const xNow = width - padR
  const yOf = (i: number) => i * rowH + rowH / 2
  const soft = 'color-mix(in oklab, var(--foreground) 42%, transparent)'
  const faint = 'color-mix(in oklab, var(--foreground) 22%, transparent)'

  return (
    <svg width={width} height={rows.length * rowH} className="pointer-events-none block" aria-hidden>
      {rows.map((b, i) => {
        const pi = rows.findIndex((r) => r.name === b.parent)
        if (pi < 0) return null
        const x = xOf(b), y = yOf(i), py = yOf(pi)
        const fromPast = !/^(Head|Root)/.test(b.point)
        const ox = Math.max(xOf(rows[pi]) + 6, x - (fromPast ? step * 0.7 : Math.min(14, step * 0.45)))
        const r = Math.min(7, x - ox, Math.abs(y - py))
        return (
          <g key={`c-${b.id}`}>
            <path d={`M ${ox} ${py} V ${y - r} Q ${ox} ${y} ${ox + r} ${y} H ${x}`} fill="none" stroke={faint} strokeWidth="1.5" strokeDasharray={fromPast ? '3 3' : undefined} />
            <circle cx={ox} cy={py} r="2.5" fill={soft} />
          </g>
        )
      })}
      {rows.map((b, i) => {
        const x = xOf(b), y = yOf(i)
        const running = b.state === 'running'
        const color = b.name === inUse ? 'var(--primary)' : b.isDefault ? 'var(--oltp)' : running ? soft : faint
        return (
          <g key={`l-${b.id}`}>
            <path
              d={`M ${x} ${y} H ${xNow}`} pathLength={1} fill="none" stroke={color}
              strokeWidth={b.isDefault || b.name === inUse ? 2.5 : 1.75} strokeLinecap="round"
              strokeDasharray={running ? undefined : '0.012 0.03'}
              className={b.id === fresh ? 'lane-fresh' : undefined}
            />
            <circle cx={x} cy={y} r="3.5" fill="var(--card)" stroke={color} strokeWidth="1.75" />
            {running
              ? <circle cx={xNow} cy={y} r="3" fill={color} />
              : <g stroke={color} strokeWidth="1.75" strokeLinecap="round"><path d={`M ${xNow - 2} ${y - 3.5} v 7`} /><path d={`M ${xNow + 2} ${y - 3.5} v 7`} /></g>}
          </g>
        )
      })}
    </svg>
  )
}
