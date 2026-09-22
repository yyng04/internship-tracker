import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../../db/schema'
import { cx } from '../../lib/utils'
import {
  avgDaysToFirstResponse,
  bySource,
  currentDistribution,
  responseRate,
  statusFunnel,
  weeklyApplied,
} from '../../lib/stats'
import type { Status } from '../../types'
import { Card, EmptyState, PageHeader, STATUS_COLORS, StatusBadge } from '../components/ui'

const FUNNEL_SKIP: readonly Status[] = ['wishlist', 'withdrawn']

function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <Card>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-400">{sub}</div>}
    </Card>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold">{children}</h2>
}

/** Width of a proportional bar as a percent of the largest value in its list. */
function pct(count: number, max: number): string {
  return max === 0 ? '0%' : `${Math.round((count / max) * 100)}%`
}

export function Stats() {
  const apps = useLiveQuery(() => db.applications.toArray(), [], [])

  if (apps.length === 0) {
    return (
      <>
        <PageHeader title="Stats" subtitle="How your search is going" />
        <EmptyState
          title="Nothing to chart yet"
          body="Add applications on the Board and this page will fill in with weekly counts, a funnel and response rates."
        />
      </>
    )
  }

  const rr = responseRate(apps)
  const avgDays = avgDaysToFirstResponse(apps)
  const weekly = weeklyApplied(apps)
  const funnel = statusFunnel(apps).filter((r) => !FUNNEL_SKIP.includes(r.status))
  const funnelMax = Math.max(0, ...funnel.map((r) => r.count))
  const dist = currentDistribution(apps)
  const sources = bySource(apps)
  const sourceMax = Math.max(0, ...sources.map((r) => r.count))

  return (
    <>
      <PageHeader title="Stats" subtitle="How your search is going" />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile value={String(apps.length)} label="Total tracked" />
        <StatTile value={String(rr.applied)} label="Applied" />
        <StatTile
          value={`${Math.round(rr.rate * 100)}%`}
          label="Response rate"
          sub={`${rr.responded} responded / ${rr.applied} applied`}
        />
        <StatTile
          value={avgDays === null ? 'n/a' : avgDays.toFixed(1)}
          label="Avg days to first response"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Applications per week</SectionTitle>
          <div className="text-zinc-600 dark:text-zinc-300">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#696965" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="week" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#bfbdb4', fillOpacity: 0.12 }}
                  wrapperClassName="rounded border border-zinc-200 bg-white text-sm shadow dark:border-zinc-700 dark:bg-zinc-900"
                  contentStyle={{ background: 'transparent', border: 'none' }}
                  labelStyle={{ color: 'inherit' }}
                  itemStyle={{ color: 'inherit' }}
                  formatter={(v) => [v, 'Applied']}
                />
                <Bar dataKey="count" fill="#eee5d0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>Funnel</SectionTitle>
          <p className="mb-3 text-xs text-zinc-500">
            Counts every application that reached each stage. Applications may skip stages.
          </p>
          <ul className="space-y-2">
            {funnel.map((r) => (
              <li key={r.status} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <div className="h-2.5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={cx('h-full rounded', STATUS_COLORS[r.status])}
                    style={{ width: pct(r.count, funnelMax) }}
                  />
                </div>
                <span className="text-right tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Current status</SectionTitle>
          <ul className="space-y-2">
            {dist.map((r) => (
              <li key={r.status} className="flex items-center justify-between text-sm">
                <StatusBadge status={r.status} />
                <span className="tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>By source</SectionTitle>
          <ul className="space-y-2">
            {sources.map((r) => (
              <li key={r.source} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="capitalize">{r.source}</span>
                <div className="h-2.5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded bg-indigo-500" style={{ width: pct(r.count, sourceMax) }} />
                </div>
                <span className="text-right tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
