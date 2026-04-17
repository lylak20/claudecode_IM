'use client'

import dynamic from 'next/dynamic'

// Chart.js — dynamic import avoids SSR issues
const ChartRenderer = dynamic(() => import('./ChartRenderer'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-xs text-stone-400">
      Loading chart…
    </div>
  ),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartSpec {
  title: string
  type: 'line' | 'bar' | 'waterfall'
  stacked?: boolean
  yLabel?: string
  xLabel?: string
  yFormat?: 'dollar' | 'dollarmillions' | 'percent' | 'number' | 'thousands'
  labels: string[]
  datasets: {
    label: string
    data: number[]
    chartType?: 'line' | 'bar'  // for combo (mixed) charts
    totals?: boolean[]           // waterfall: which bars are subtotal/total (shown in green)
  }[]
}

// ── Color palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#1e4d8c', // navy blue
  '#e07b39', // orange
  '#2d7a3c', // green
  '#5ba3d9', // light blue
  '#9b59b6', // purple
  '#c0392b', // red
]

// Blue gradient for cohort retention charts (dark → light per dataset)
function cohortBlue(idx: number, total: number): string {
  const t = total <= 1 ? 0 : idx / (total - 1)
  const r = Math.round(0x1e + t * (0xa8 - 0x1e))
  const g = Math.round(0x4d + t * (0xd4 - 0x4d))
  const b = Math.round(0x8c + t * (0xf0 - 0x8c))
  return `rgb(${r},${g},${b})`
}

// ── Y-axis formatter ──────────────────────────────────────────────────────────

function makeFmt(yFormat: ChartSpec['yFormat']) {
  return (v: number): string => {
    switch (yFormat) {
      case 'dollar':
        return v >= 0
          ? `$${Math.abs(v).toLocaleString()}`
          : `($${Math.abs(v).toLocaleString()})`
      case 'dollarmillions': return `$${v}M`
      case 'percent': return `${v}%`
      case 'thousands': return `${v}K`
      default: return String(v)
    }
  }
}

// ── Waterfall chart config ────────────────────────────────────────────────────
// Each item shown as a bar from 0 to its value (+ or −).
// Blue = positive increment, Orange = negative, Green = subtotal/total.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWaterfallConfig(spec: ChartSpec): Record<string, any> {
  const ds = spec.datasets[0]
  const values = ds.data
  const isTotals: boolean[] = ds.totals ?? values.map(() => false)
  const fmt = makeFmt(spec.yFormat)

  const colors = values.map((v, i) => {
    if (isTotals[i]) return '#2d7a3c'   // green for totals
    return v >= 0 ? '#1e4d8c' : '#e07b39' // navy / orange
  })

  return {
    type: 'bar',
    data: {
      labels: spec.labels,
      datasets: [
        {
          label: ds.label || 'Amount',
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => ` ${fmt(ctx.raw as number)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, maxRotation: 50, minRotation: 30 },
        },
        y: {
          grid: { color: '#f3f4f6' },
          border: { display: false },
          ticks: { font: { size: 10 }, callback: fmt },
        },
      },
    },
  }
}

// ── Standard chart config (line / bar / combo) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toChartConfig(spec: ChartSpec): Record<string, any> {
  if (spec.type === 'waterfall') return toWaterfallConfig(spec)

  const hasMixed = spec.datasets.some(d => d.chartType && d.chartType !== spec.type)
  const allLines = spec.type === 'line' && spec.datasets.every(d => !d.chartType || d.chartType === 'line')
  const isCohort = allLines && spec.datasets.length >= 3
  const n = spec.datasets.length
  const fmt = makeFmt(spec.yFormat)

  const datasets = spec.datasets.map((ds, i) => {
    const effectiveType = ds.chartType ?? spec.type
    const isLine = effectiveType === 'line'
    const color = isCohort ? cohortBlue(i, n) : PALETTE[i % PALETTE.length]

    return {
      type: hasMixed ? effectiveType : undefined,
      label: ds.label,
      data: ds.data,
      backgroundColor: isLine ? color + '18' : color,
      borderColor: color,
      borderWidth: isLine ? (isCohort ? 2 : 2.5) : 0,
      pointRadius: isLine ? (isCohort ? 0 : 3) : 0,
      pointHoverRadius: isLine ? 4 : 0,
      tension: isLine ? 0.2 : 0,
      fill: false,
      yAxisID: hasMixed && i > 0 && isLine ? 'y1' : 'y',
    }
  })

  const scales: Record<string, unknown> = {
    x: {
      stacked: spec.stacked,
      grid: { display: false },
      ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 },
      title: spec.xLabel
        ? { display: true, text: spec.xLabel, font: { size: 10 }, color: '#9ca3af' }
        : { display: false },
    },
    y: {
      stacked: spec.stacked,
      grid: { color: '#f3f4f6', lineWidth: 1 },
      border: { display: false },
      ticks: { font: { size: 10 }, callback: fmt },
      title: spec.yLabel
        ? { display: true, text: spec.yLabel, font: { size: 10 }, color: '#9ca3af' }
        : { display: false },
    },
  }

  if (hasMixed) {
    scales.y1 = {
      position: 'right',
      grid: { drawOnChartArea: false },
      border: { display: false },
      ticks: { font: { size: 10 }, callback: fmt },
    }
  }

  return {
    type: hasMixed ? 'bar' : spec.type,
    data: { labels: spec.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: spec.datasets.length > 1,
          position: 'bottom' as const,
          labels: { boxWidth: 10, boxHeight: 10, font: { size: 10 }, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label: string }; parsed: { y: number } }) =>
              ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales,
    },
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  charts: ChartSpec[]
  label?: string  // header label, e.g. "Financial Charts" vs "Unit Economics Charts"
}

export default function UnitEconomicsCharts({ charts, label }: Props) {
  if (!charts || charts.length === 0) return null

  return (
    <div className="my-4">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {label ?? 'Charts — auto-generated from uploaded data'}
        </span>
      </div>

      {/* 2-column grid */}
      <div className={`grid gap-4 ${charts.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {charts.map((spec, i) => {
          const isWaterfall = spec.type === 'waterfall'
          const isCohort =
            spec.type === 'line' &&
            spec.datasets.length >= 3 &&
            spec.datasets.every(d => !d.chartType || d.chartType === 'line')
          // Wide: waterfall, cohort, or solo chart
          const isWide = isWaterfall || isCohort || charts.length === 1
          // Taller for waterfall (many x labels) and cohort
          const height = isWaterfall ? 280 : isCohort ? 260 : 200

          return (
            <div
              key={i}
              className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${isWide ? 'col-span-2' : ''}`}
            >
              <p className="text-xs font-semibold text-gray-600 mb-3">{spec.title}</p>
              {/* Waterfall legend (manual, since we share one dataset with mixed colors) */}
              {isWaterfall && (
                <div className="flex items-center gap-4 mb-2">
                  {[['#1e4d8c', 'Increase'], ['#e07b39', 'Decrease'], ['#2d7a3c', 'Total']].map(([color, lbl]) => (
                    <span key={lbl} className="flex items-center gap-1 text-xs text-gray-500">
                      <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
                      {lbl}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ height }}>
                <ChartRenderer config={toChartConfig(spec)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
