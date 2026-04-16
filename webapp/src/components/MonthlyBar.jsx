import { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController } from 'chart.js'
import { supabase } from '../lib/supabase'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController)

function getLast6Months() {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}

export default function MonthlyBar() {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [totals, setTotals] = useState([])
  const months = getLast6Months()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!canvasRef.current || totals.length === 0) return

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Total (MAD)',
          data: totals,
          backgroundColor: '#60a5fa',
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y.toFixed(2)} MAD`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [totals])

  async function fetchData() {
    const results = await Promise.all(
      months.map(async (month) => {
        const { data } = await supabase
          .from('expenses')
          .select('amount')
          .gte('date', `${month}-01`)
          .lte('date', `${month}-31`)
        return data ? data.reduce((acc, r) => acc + parseFloat(r.amount), 0) : 0
      })
    )
    setTotals(results)
  }

  return (
    <div className="card">
      <h2>6 derniers mois</h2>
      <canvas ref={canvasRef} />
    </div>
  )
}
