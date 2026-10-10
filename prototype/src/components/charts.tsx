import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'

export type SeriesDef = { key: string; label: string; color: string }

const axis = { fontSize: 11, fill: 'var(--muted-foreground)' }

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tabular flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium">{Number(p.value).toFixed(p.value < 10 ? 2 : 0)}{unit}</span>
        </div>
      ))}
    </div>
  )
}

/** A small time-series panel: title, current value, then the chart. */
export function MetricChart({ title, value, data, series, unit = '', kind = 'area', tag, height = 150 }: {
  title: string; value: ReactNode; data: Record<string, number | string>[]; series: SeriesDef[]; unit?: string; kind?: 'area' | 'line'; tag?: ReactNode; height?: number
}) {
  const Chart = kind === 'area' ? AreaChart : LineChart
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] text-muted-foreground">{title}</div>
        {tag}
      </div>
      <div className="tabular mt-0.5 mb-2 text-lg font-semibold">{value}</div>
      {series.length > 1 && (
        <div className="mb-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="t" tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={48} />
          <RTooltip content={<Tip unit={unit} />} cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} />
          {series.map((s) =>
            kind === 'area' ? (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.1} strokeWidth={1.6} isAnimationActive={false} />
            ) : (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} dot={false} strokeWidth={1.6} isAnimationActive={false} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  )
}

export function timeAxis(points: number, range: string) {
  const mins = range === '1h' ? 60 : range === '6h' ? 360 : range === '24h' ? 1440 : 10080
  const end = 14 * 60 + 5
  return Array.from({ length: points }, (_, i) => {
    const m = end - Math.round(((points - 1 - i) / (points - 1)) * mins)
    const mm = ((m % 1440) + 1440) % 1440
    const label = `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`
    return range === '7d' ? `Oct ${9 - Math.floor((points - 1 - i) / (points / 7))}` : label
  })
}
