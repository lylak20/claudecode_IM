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
  type: 'line' | 'bar'
  stacked?: boolean
  yLabel?: string
  xLabel?: string
  yFormat?: 'dollar' | 'dollarmillions' | 'percent' | 'number' | 'thousands'
  labels: string[]
  datasets: {
    label: string
    data: number[]
    chartType?: 'line' | 'bar' // for combo (mixed) charts
  }[]
}

// ── Color palette (matches screenshots: navy + orange + green + others) ───────

const PALETTE = [
  '#1e4d8c', // navy blue (primary)
  '#e07b39', // orange
  '#2d7a3c', // green
  '#5ba3d9', // light blue
  '#9b59b6', // purple
  '#c0392b', // red
]

// Blue gradient for cohort/retention charts (many datasets, all lines)
// Goes from dark navy → light sky blue, matching the screenshot style
function cohortBlue(idx: number, total: number): string {
  // Newest cohort = darkest, oldest = lightest
  const t = total <= 1 ? 0 : idx / (total - 1)
  // Interpolate: dark #1e4d8c → light #a8d4f0
  const r = Math.round(0x1e + t * (0xa8 - 0x1e))
  const g = Math.round(0x4d + t * (0xd4 - 0x4d))
  const b = Math.round(0x8c + t * (0xf0 - 0x8c))
  return `rgb(${r},${g},${b})`
}

// ── Convert compact ChartSpec → full Chart.js v4 config ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toChartConfig(spec: ChartSpec): Record<string, any> {
  const hasMixed = spec.datasets.some(d => d.chartType && d.chartType !== spec.type)

  // Detect cohort/retention chart: all datasets are lines, >= 3 datasets
  const allLines = spec.type === 'line' && spec.datasets.every(d => !d.chartType || d.chartType === 'line')
  const isCohort = allLines && spec.datasets.length >= 3

  const n = spec.datasets.length
  const datasets = spec.datasets.map((ds, i) => {
    const effectiveType = ds.chartType ?? spec.type
    const isLine = effectiveType === 'line'
    // Use blue gradient for cohort charts, otherwise standard palette
    const color = isCohort ? cohortBlue(i, n) : PALETTE[i % PALETTE.length]

    return {
      type: hasMixed ? effectiveType : undefined,
      label: ds.label,
      data: ds.data,
      backgroundColor: isLine ? color + '18' : color,
      borderColor: color,
      borderWidth: isLine ? (isCohort ? 2 : 2.5) : 0,
      pointRadius: isLine ? (isCohort ? 0 : 3) : 0,  // no dots on cohort lines = cleaner
      pointHoverRadius: isLine ? 4 : 0,
      tension: isLine ? 0.2 : 0,
      fill: false,
      yAxisID: hasMixed && i > 0 && isLine ? 'y1' : 'y',
    }
  })

  // y-axis tick formatter
  const fmt = (v: number): string => {
    switch (spec.yFormat) {
      case 'dollar': return `$${v}`
      case 'dollarmillions': return `$${v}M`
      case 'percent': return `${v}%`
      case 'thousands': return `${v}K`
      default: return String(v)
    }
  }

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

  // Second y-axis for combo charts (right side)
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

export default function UnitEconomicsCharts({ charts }: { charts: ChartSpec[] }) {
  if (!charts || charts.length === 0) return null

  return (
    <div className="my-4">
      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Charts — auto-generated from uploaded data</span>
      </div>

      {/* 2-column grid */}
      <div className={`grid gap-4 ${charts.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {charts.map((spec, i) => {
          // Cohort/retention charts: many line datasets → taller + full width for readability
          const isCohort = spec.type === 'line' && spec.datasets.length >= 3
            && spec.datasets.every(d => !d.chartType || d.chartType === 'line')
          const isWide = isCohort || charts.length === 1

          return (
            <div
              key={i}
              className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${isWide ? 'col-span-2' : ''}`}
            >
              {/* Chart title */}
              <p className="text-xs font-semibold text-gray-600 mb-3">{spec.title}</p>
              {/* Chart — taller for cohort/wide charts */}
              <div style={{ height: isCohort ? 260 : 200 }}>
                <ChartRenderer config={toChartConfig(spec)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
