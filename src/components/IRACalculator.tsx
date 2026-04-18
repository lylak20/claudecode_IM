'use client'

import { useState } from 'react'

interface IRACalculatorProps {
  investmentAmount: number   // $M
  preMoneyValuation: number  // $M
  entryRevenue: number       // $M (0 = unknown)
  holdPeriod?: number        // default 5
}

// ── Financial math ────────────────────────────────────────────────────────────

function calcReturns(
  investmentAmount: number,
  ownership: number,
  entryRevenue: number,
  cagrPct: number,
  exitMult: number,
  holdPeriod: number,
) {
  const cagr = cagrPct / 100
  const rev: number[] = Array.from({ length: holdPeriod + 1 }, (_, i) =>
    entryRevenue * Math.pow(1 + cagr, i),
  )
  const rev5 = rev[holdPeriod]
  const exitEV = rev5 * exitMult
  const investorReturn = exitEV * ownership
  const moic = investmentAmount > 0 ? investorReturn / investmentAmount : 0
  const irr = moic > 0 ? (Math.pow(moic, 1 / holdPeriod) - 1) * 100 : 0
  return { rev, rev5, exitEV, investorReturn, moic, irr }
}

/**
 * Backsolve CAGR so that IRR ≈ targetIRR%, given a fixed exit multiple.
 * Returns an integer % rounded to nearest 5.
 */
function backsolveCAGR(
  targetIRRpct: number,
  exitMult: number,
  investmentAmount: number,
  postMoney: number,
  entryRevenue: number,
  holdPeriod: number,
): number {
  const safeRevenue = entryRevenue > 0 ? entryRevenue : 1.0
  const ownership = postMoney > 0 ? investmentAmount / postMoney : 0.1
  const targetMOIC = Math.pow(1 + targetIRRpct / 100, holdPeriod)
  const needReturn = investmentAmount * targetMOIC
  const needExitEV = ownership > 0 ? needReturn / ownership : 0
  const needRev5 = exitMult > 0 ? needExitEV / exitMult : 0
  const ratio = needRev5 / safeRevenue
  if (ratio <= 0) return 50
  const cagrRaw = (Math.pow(ratio, 1 / holdPeriod) - 1) * 100
  // Round to nearest 5, clamp 5–300
  return Math.max(5, Math.min(300, Math.round(cagrRaw / 5) * 5))
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtM(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}T`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}B`
  if (val >= 100) return `$${val.toFixed(0)}M`
  if (val >= 10) return `$${val.toFixed(1)}M`
  if (val >= 1) return `$${val.toFixed(2)}M`
  return `$${(val * 1_000).toFixed(0)}K`
}

function fmtPct(val: number): string {
  return `${val.toFixed(0)}%`
}

function fmtX(val: number): string {
  return `${val.toFixed(1)}x`
}

function irrClass(irr: number): string {
  if (irr >= 35) return 'text-emerald-700 font-bold'
  if (irr >= 20) return 'text-blue-700 font-semibold'
  if (irr >= 5) return 'text-amber-700'
  return 'text-red-600'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function YellowInput({
  value,
  onChange,
  suffix = '',
  min = 0,
  max = 999,
  step = 1,
  width = 'w-16',
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  width?: string
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="number"
        value={value}
        onChange={e => {
          const v = Number(e.target.value)
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
        }}
        min={min}
        max={max}
        step={step}
        className={`bg-yellow-50 border border-yellow-300 rounded px-1.5 py-0.5 text-center font-semibold text-sm ${width} focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-300`}
        style={{ MozAppearance: 'textfield' } as React.CSSProperties}
      />
      {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
    </span>
  )
}

const TH = 'text-left font-semibold text-gray-900 border border-gray-200 px-3 py-2 bg-gray-50 text-sm'
const TD = 'border border-gray-200 px-3 py-2 text-gray-700 text-sm'
const TDC = 'border border-gray-200 px-3 py-2 text-gray-700 text-sm text-center'

// Sensitivity table fixed axes
const S_CAGRS = [10, 25, 50, 75, 100, 150]
const S_EXITS = [6, 8, 10, 12, 15, 20, 25]

// ── Main component ────────────────────────────────────────────────────────────

export default function IRACalculator({
  investmentAmount,
  preMoneyValuation,
  entryRevenue: initRevenue,
  holdPeriod = 5,
}: IRACalculatorProps) {
  const postMoney = preMoneyValuation + investmentAmount
  const ownership = postMoney > 0 ? investmentAmount / postMoney : 0

  // Use 1.0 as floor if entryRevenue is unknown/0
  const safeInit = initRevenue > 0 ? initRevenue : 1.0
  const [entryRevenue, setEntryRevenue] = useState(safeInit)

  // Backsolve initial CAGR to hit target IRRs: Bear 15%, Base 25%, Bull 40%
  const [bearCAGR, setBearCAGR] = useState(() =>
    backsolveCAGR(15, 10, investmentAmount, postMoney, safeInit, holdPeriod),
  )
  const [baseCAGR, setBaseCAGR] = useState(() =>
    backsolveCAGR(25, 15, investmentAmount, postMoney, safeInit, holdPeriod),
  )
  const [bullCAGR, setBullCAGR] = useState(() =>
    backsolveCAGR(40, 20, investmentAmount, postMoney, safeInit, holdPeriod),
  )

  const [bearExit, setBearExit] = useState(10)
  const [baseExit, setBaseExit] = useState(15)
  const [bullExit, setBullExit] = useState(20)

  const bear = calcReturns(investmentAmount, ownership, entryRevenue, bearCAGR, bearExit, holdPeriod)
  const base = calcReturns(investmentAmount, ownership, entryRevenue, baseCAGR, baseExit, holdPeriod)
  const bull = calcReturns(investmentAmount, ownership, entryRevenue, bullCAGR, bullExit, holdPeriod)

  return (
    <div className="space-y-7 my-2">
      {/* ── Note ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 text-xs text-amber-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
        <span className="text-base leading-none mt-0.5">✏️</span>
        <span>
          <strong>Yellow cells are editable.</strong> Change CAGR, exit multiples, or entry revenue —
          all tables update instantly. Sensitivity Analysis uses the same formula as Returns by Case,
          so numbers will always be consistent.
        </span>
      </div>

      {/* ── Investment Assumptions ────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold mb-2 text-gray-800">Investment Assumptions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ['Investment Amount', `$${investmentAmount}M`],
                ['Pre-Money Valuation', `$${preMoneyValuation}M`],
                ['Post-Money Valuation', `$${postMoney}M`],
                ['Ownership % Acquired', `${(ownership * 100).toFixed(1)}%`],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td className={TH} style={{ width: '52%' }}>{label}</td>
                  <td className={TD}>{val}</td>
                </tr>
              ))}
              {/* Editable entry revenue */}
              <tr>
                <td className={TH}>Entry Revenue / ARR</td>
                <td className={TD}>
                  <span className="flex items-center gap-1.5">
                    <span className="text-gray-400 text-xs">$</span>
                    <YellowInput
                      value={entryRevenue}
                      onChange={setEntryRevenue}
                      suffix="M"
                      min={0.01}
                      max={100_000}
                      step={0.1}
                      width="w-20"
                    />
                    {initRevenue <= 0 && (
                      <span className="text-amber-600 text-xs">← Enter estimated ARR</span>
                    )}
                  </span>
                </td>
              </tr>
              {/* Editable entry EV/Revenue — back-calculates entryRevenue when changed */}
              <tr>
                <td className={TH}>Entry EV / Revenue</td>
                <td className={TD}>
                  <YellowInput
                    value={entryRevenue > 0 ? parseFloat((postMoney / entryRevenue).toFixed(1)) : 0}
                    onChange={v => { if (v > 0) setEntryRevenue(postMoney / v) }}
                    suffix="x"
                    min={0.1}
                    max={10000}
                    step={0.5}
                    width="w-20"
                  />
                </td>
              </tr>
              <tr>
                <td className={TH}>Hold Period</td>
                <td className={TD}>{holdPeriod} years</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5-Year Revenue Projection ─────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold mb-2 text-gray-800">
          {holdPeriod}-Year Revenue Projection
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={TH}>Case</th>
                <th className={TH + ' text-center'}>CAGR</th>
                {Array.from({ length: holdPeriod + 1 }, (_, i) => (
                  <th key={i} className={TH + ' text-center'}>
                    Yr {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { label: 'Bear', cagr: bearCAGR, set: setBearCAGR, data: bear },
                  { label: 'Base', cagr: baseCAGR, set: setBaseCAGR, data: base },
                  { label: 'Bull', cagr: bullCAGR, set: setBullCAGR, data: bull },
                ] as const
              ).map(({ label, cagr, set, data }) => (
                <tr key={label}>
                  <td className={TD + ' font-medium'}>{label}</td>
                  <td className={TDC}>
                    <YellowInput value={cagr} onChange={set} suffix="%" min={1} max={500} />
                  </td>
                  {data.rev.map((v, i) => (
                    <td key={i} className={TDC}>
                      {fmtM(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Investment Returns by Case ────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold mb-2 text-gray-800">Investment Returns by Case</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={TH}>Metric</th>
                <th className={TH + ' text-center'}>Bear</th>
                <th className={TH + ' text-center'}>Base</th>
                <th className={TH + ' text-center'}>Bull</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue CAGR row (display only, matches projection table) */}
              <tr>
                <td className={TD + ' font-medium'}>Revenue CAGR</td>
                <td className={TDC}>{fmtPct(bearCAGR)}</td>
                <td className={TDC}>{fmtPct(baseCAGR)}</td>
                <td className={TDC}>{fmtPct(bullCAGR)}</td>
              </tr>
              {/* Exit Multiple — editable yellow */}
              <tr>
                <td className={TD + ' font-medium'}>Exit Multiple</td>
                <td className={TDC}>
                  <YellowInput value={bearExit} onChange={setBearExit} suffix="x" min={1} max={100} />
                </td>
                <td className={TDC}>
                  <YellowInput value={baseExit} onChange={setBaseExit} suffix="x" min={1} max={100} />
                </td>
                <td className={TDC}>
                  <YellowInput value={bullExit} onChange={setBullExit} suffix="x" min={1} max={100} />
                </td>
              </tr>
              <tr>
                <td className={TD + ' font-medium'}>Yr {holdPeriod} Revenue</td>
                <td className={TDC}>{fmtM(bear.rev5)}</td>
                <td className={TDC}>{fmtM(base.rev5)}</td>
                <td className={TDC}>{fmtM(bull.rev5)}</td>
              </tr>
              <tr>
                <td className={TD + ' font-medium'}>Exit Enterprise Value</td>
                <td className={TDC}>{fmtM(bear.exitEV)}</td>
                <td className={TDC}>{fmtM(base.exitEV)}</td>
                <td className={TDC}>{fmtM(bull.exitEV)}</td>
              </tr>
              <tr>
                <td className={TD + ' font-medium'}>Investor Return ({(ownership * 100).toFixed(1)}%)</td>
                <td className={TDC}>{fmtM(bear.investorReturn)}</td>
                <td className={TDC}>{fmtM(base.investorReturn)}</td>
                <td className={TDC}>{fmtM(bull.investorReturn)}</td>
              </tr>
              <tr>
                <td className={TD + ' font-medium'}>MOIC</td>
                <td className={TDC}>{fmtX(bear.moic)}</td>
                <td className={TDC}>{fmtX(base.moic)}</td>
                <td className={TDC}>{fmtX(bull.moic)}</td>
              </tr>
              {/* IRR — highlighted */}
              <tr className="bg-gray-50">
                <td className={TD + ' font-bold'}>IRR</td>
                <td className={`${TDC} font-bold ${irrClass(bear.irr)}`}>{fmtPct(bear.irr)}</td>
                <td className={`${TDC} font-bold ${irrClass(base.irr)}`}>{fmtPct(base.irr)}</td>
                <td className={`${TDC} font-bold ${irrClass(bull.irr)}`}>{fmtPct(bull.irr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sensitivity Analysis ─────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold mb-1 text-gray-800">
          Sensitivity Analysis — IRR by Revenue CAGR vs. Exit Multiple
        </h3>
        <p className="text-xs text-gray-400 mb-2">
          Uses the same formula as Returns by Case — numbers are guaranteed consistent.
          {' '}<span className="text-orange-500">■</span> Bear &nbsp;
          <span className="text-blue-500">■</span> Base &nbsp;
          <span className="text-emerald-500">■</span> Bull
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={TH + ' text-center'}>Exit ↓ / CAGR →</th>
                {S_CAGRS.map(c => (
                  <th key={c} className={TH + ' text-center'}>
                    {c}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {S_EXITS.map(exit => (
                <tr key={exit}>
                  <td className={TD + ' font-medium text-center'}>{exit}x</td>
                  {S_CAGRS.map(cagr => {
                    const r = calcReturns(investmentAmount, ownership, entryRevenue, cagr, exit, holdPeriod)
                    const irr = r.irr
                    // Highlight cells that match a case's exact CAGR+exit
                    const isBear = cagr === bearCAGR && exit === bearExit
                    const isBase = cagr === baseCAGR && exit === baseExit
                    const isBull = cagr === bullCAGR && exit === bullExit
                    const bg = isBear
                      ? 'bg-orange-50 ring-1 ring-inset ring-orange-300'
                      : isBase
                      ? 'bg-blue-50 ring-1 ring-inset ring-blue-300'
                      : isBull
                      ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300'
                      : ''
                    return (
                      <td
                        key={cagr}
                        className={`${TDC} ${bg} ${irrClass(irr)}`}
                        title={`CAGR ${cagr}%, Exit ${exit}x → IRR ${irr.toFixed(1)}%`}
                      >
                        {fmtPct(irr)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          IRR = (Exit EV × Ownership / Investment)^(1/{holdPeriod}) − 1. &nbsp;
          Entry Revenue = {fmtM(entryRevenue)}, Ownership = {(ownership * 100).toFixed(1)}%.
        </p>
      </div>
    </div>
  )
}
