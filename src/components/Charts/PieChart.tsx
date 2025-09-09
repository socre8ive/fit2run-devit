'use client'

import { Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

interface PieChartProps {
  data: ChartData<'pie'>
  title?: string
  height?: number
}

export default function PieChart({ data, title, height = 300 }: PieChartProps) {
  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((sum, value) => sum + (value as number), 0)
            const percentage = ((context.raw as number / total) * 100).toFixed(1)
            return `${context.label}: ${percentage}%`
          }
        }
      },
    },
  }

  return (
    <div className="card">
      <div style={{ height }}>
        <Pie data={data} options={options} />
      </div>
    </div>
  )
}