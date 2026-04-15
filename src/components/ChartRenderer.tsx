'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ChartRenderer({ config }: { config: Record<string, any> }) {
  if (!config?.type || !config?.data) {
    return <div className="h-full flex items-center justify-center text-xs text-stone-400">Invalid chart config</div>
  }

  return (
    <Chart
      type={config.type}
      data={config.data}
      options={{
        ...config.options,
        responsive: true,
        maintainAspectRatio: false,
      }}
    />
  )
}
