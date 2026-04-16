import { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, BarController } from 'chart.js'
import { supabase } from '../lib/supabase'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, BarController)

function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return d.toISOString().slice(0, 7)
  })
}

export default function MonthlyBar() {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [totals, setTotals] = useState([])
  const months = getLast6Months()

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (!canvasRef.current || !totals.length) return
    chartRef.current?.destroy()
    const max = Math.max(...totals)
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: months.map(m => m.slice(5)),
        datasets: [{
          data: totals,
          backgroundColor: totals.map((v, i) => i === totals.length - 1 ? '#3b82f6' : '#334155'),
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(0)} MAD` } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#1e293b' } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [totals])

  async function fetchData() {
    const results = await Promise.all(months.map(async m => {
      const { data } = await supabase.from('expenses').select('amount').gte('date', `${m}-01`).lte('date', `${m}-31`)
      return data?.reduce((s, r) => s + parseFloat(r.amount), 0) || 0
    }))
    setTotals(results)
  }

  return (
    <div className="card">
      <div className="card-title">📊 6 derniers mois</div>
      <div className="chart-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
