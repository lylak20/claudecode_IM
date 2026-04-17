'use client'

import dynamic from 'next/dynamic'

const ChartRenderer = dynamic(() => import('./ChartRenderer'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-xs text-stone-400">
      Loading chart…
    </div>
  ),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartDataset {
  label: string
  data: number[]
  chartType?: 'line' | 'bar'  // for mixed combo charts
  totals?: boolean[]           // waterfall: mark subtotal/total bars (green)
  colors?: string[]            // per-bar custom colors (e.g. gray for target company)
  isDashed?: boolean           // dashed line (e.g. average reference line)
  lineColor?: string           // custom color override for this dataset
}

export interface ChartSpec {
  title: string
  type: 'line' | 'bar' | 'waterfall'
  stacked?: boolean
  yLabel?: string
  xLabel?: string
  yFormat?: 'dollar' | 'dollarmillions' | 'dollarbillions' | 'percent' | 'number' | 'thousands' | 'multiple'
  labels: string[]
  datasets: ChartDataset[]
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
        return v >= 0 ? `$${Math.abs(v).toLocaleString()}` : `($${Math.abs(v).toLocaleString()})`
      case 'dollarmillions': return `$${v}M`
      case 'dollarbillions': return `$${v}B`
      case 'percent': return `${v}%`
      case 'thousands': return `${v}K`
      case 'multiple': return `${v}x`
      default: return String(v)
    }
  }
}

// ── Waterfall config ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWaterfallConfig(spec: ChartSpec): Record<string, any> {
  const ds = spec.datasets[0]
  const values = ds.data
  const isTotals: boolean[] = ds.totals ?? values.map(() => false)
  const fmt = makeFmt(spec.yFormat)

  const colors = values.map((v, i) => {
    if (isTotals[i]) return '#2d7a3c'
    return v >= 0 ? '#1e4d8c' : '#e07b39'
  })

  return {
    type: 'bar',
    data: {
      labels: spec.labels,
      datasets: [{
        label: ds.label || 'Amount',
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tooltip: { callbacks: { label: (ctx: any) => ` ${fmt(ctx.raw as number)}` } },
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

// ── Standard / combo / peer chart config ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toChartConfig(spec: ChartSpec): Record<string, any> {
  if (spec.type === 'waterfall') return toWaterfallConfig(spec)

  const hasMixed = spec.datasets.some(d => d.chartType && d.chartType !== spec.type)
  const allLines = spec.type === 'line' && spec.datasets.every(d => !d.chartType || d.chartType === 'line')
  const isCohort = allLines && spec.datasets.length >= 3
  const n = spec.datasets.length
  const fmt = makeFmt(spec.yFormat)

  // Second axis formatter — right-side axis for combo charts uses the second dataset's format
  // (for peer charts the right axis is ARR in $M)
  const fmt2 = makeFmt('dollarmillions')

  const datasets = spec.datasets.map((ds, i) => {
    const effectiveType = ds.chartType ?? spec.type
    const isLine = effectiveType === 'line'

    // Color precedence: explicit lineColor > cohort gradient > palette
    const baseColor = ds.lineColor
      ?? (isCohort ? cohortBlue(i, n) : PALETTE[i % PALETTE.length])

    // Per-bar colors array (e.g. mixed navy/gray in peer charts)
    const bgColor = ds.colors
      ? ds.colors
      : isLine ? baseColor + '18' : baseColor

    const borderColor = ds.colors
      ? ds.colors
      : baseColor

    // Which y-axis: second dataset in a mixed chart uses y1
    const useY1 = hasMixed && i > 0 && isLine

    return {
      type: hasMixed ? effectiveType : undefined,
      label: ds.label,
      data: ds.data,
      backgroundColor: bgColor,
      borderColor: borderColor,
      borderWidth: isLine ? (isCohort ? 2 : 2.5) : 0,
      borderDash: ds.isDashed ? [6, 4] : [],
      pointRadius: isLine ? (isCohort ? 0 : 4) : 0,
      pointHoverRadius: isLine ? 5 : 0,
      tension: isLine ? 0.2 : 0,
      fill: false,
      yAxisID: useY1 ? 'y1' : 'y',
      borderRadius: isLine ? 0 : 3,
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

  // Second y-axis (right) for combo / peer charts
  if (hasMixed) {
    const rightDataset = spec.datasets.find((d, i) => i > 0 && (d.chartType === 'line' || spec.type === 'line'))
    const rightFmt = rightDataset?.lineColor === '#ef4444' ? fmt2 : fmt // ARR axis uses $M
    scales.y1 = {
      position: 'right',
      grid: { drawOnChartArea: false },
      border: { display: false },
      ticks: { font: { size: 10 }, callback: rightFmt, color: '#ef4444' },
      title: { display: true, text: 'Est. ARR ($M)', font: { size: 9 }, color: '#ef4444' },
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
            label: (ctx: { dataset: { label: string; yAxisID?: string }; parsed: { y: number } }) => {
              const f = ctx.dataset.yAxisID === 'y1' ? fmt2 : fmt
              return ` ${ctx.dataset.label}: ${f(ctx.parsed.y)}`
            },
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
  label?: string
}

export default function UnitEconomicsCharts({ charts, label }: Props) {
  if (!charts || charts.length === 0) return null

  return (
    <div className="my-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {label ?? 'Charts — auto-generated from uploaded data'}
        </span>
      </div>

      <div className={`grid gap-4 ${charts.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {charts.map((spec, i) => {
          const isWaterfall = spec.type === 'waterfall'
          const isCohort =
            spec.type === 'line' &&
            spec.datasets.length >= 3 &&
            spec.datasets.every(d => !d.chartType || d.chartType === 'line')
          // Wide: waterfall, cohort, peer charts (many labels), or solo
          const isWide = isWaterfall || isCohort || charts.length === 1 || spec.labels.length >= 6
          const height = isWaterfall ? 280 : isCohort ? 260 : 220

          return (
            <div
              key={i}
              className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${isWide ? 'col-span-2' : ''}`}
            >
              <p className="text-xs font-semibold text-gray-600 mb-2">{spec.title}</p>

              {/* Waterfall legend */}
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
