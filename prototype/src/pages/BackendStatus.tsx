import { useState } from 'react'
import { PageHeader, Stat, copy } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BACKING, STATUS_LABEL } from '@/lib/backing'
import type { BackingStatus } from '@/lib/backing'
import { cn } from '@/lib/utils'

const TONE: Record<BackingStatus, string> = { live: 'text-success', api: 'text-info', new: 'text-warning' }

export default function BackendStatus() {
  const [filter, setFilter] = useState('gaps')
  const rows = BACKING.filter((b) => filter === 'all' || (filter === 'gaps' ? b.status !== 'live' : b.status === filter))
  const count = (s: BackingStatus) => BACKING.filter((b) => b.status === s).length
  const markdown = () =>
    ['| ID | Section | Feature | Status | Note | Issue |', '| --- | --- | --- | --- | --- | --- |',
      ...rows.map((b) => `| ${b.id} | ${b.section} | ${b.title} | ${STATUS_LABEL[b.status]} | ${b.note} | ${b.issue ? `#${b.issue}` : ''} |`)].join('\n')

  return (
    <>
      <PageHeader
        title="Backend status"
        description="A prototype tool, not part of the product. It lists what each screen needs from the platform, and is the source for the tags shown on screens. Items marked “Needs backend” become issues on the platform repository once the screen is agreed."
        actions={<Button variant="outline" onClick={() => copy(markdown(), 'Table copied as Markdown')}>Copy as Markdown</Button>}
      />
      <div className="mb-6 grid grid-cols-3 gap-x-6">
        <Stat label="Backend ready" value={count('live')} sub="The console can call this today" />
        <Stat label="API only" value={count('api')} sub="Platform supports it; needs console UI only" />
        <Stat label="Needs backend" value={count('new')} sub="No platform support yet" />
      </div>
      <ToggleGroup type="single" variant="outline" size="sm" className="mb-3" value={filter} onValueChange={(v) => v && setFilter(v)}>
        <ToggleGroupItem value="gaps" className="px-3">Gaps</ToggleGroupItem>
        <ToggleGroupItem value="new" className="px-3">Needs backend</ToggleGroupItem>
        <ToggleGroupItem value="api" className="px-3">API only</ToggleGroupItem>
        <ToggleGroupItem value="live" className="px-3">Ready</ToggleGroupItem>
        <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
      </ToggleGroup>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead className="w-20">ID</TableHead><TableHead>Section</TableHead><TableHead>Feature</TableHead><TableHead>Status</TableHead><TableHead>What exists today</TableHead><TableHead className="w-20">Issue</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{b.id}</TableCell>
                <TableCell className="text-muted-foreground">{b.section}</TableCell>
                <TableCell className="font-medium whitespace-normal">{b.title}</TableCell>
                <TableCell className={cn('font-medium whitespace-nowrap', TONE[b.status])}>{STATUS_LABEL[b.status]}</TableCell>
                <TableCell className="max-w-md whitespace-normal text-muted-foreground">{b.note}</TableCell>
                <TableCell className="text-muted-foreground">{b.issue ? `#${b.issue}` : 'Not filed'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
