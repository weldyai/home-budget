import { useEffect, useRef, useState } from 'react'
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js'
import { supabase } from '../lib/supabase'

Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

const COLORS = [
  '#4ade80', '#fb923c', '#60a5fa', '#a78bfa', '#f87171',
  '#facc15', '#f472b6', '#34d399', '#94a3b8', '#cbd5e1',
]

export default function CategoryChart() {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [data, setData] = useState([])

  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: data.map((d) => d.category),
        datasets: [{
          data: data.map((d) => d.total),
          backgroundColor: COLORS.slice(0, data.length),
          borderWidth: 2,
          borderColor: '#1e293b',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: '#e2e8f0', font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.toFixed(2)} MAD`,
            },
          },
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [data])

  async function fetchData() {
    const firstDay = `${currentMonth}-01`
    const lastDay = `${currentMonth}-31`
    const { data: rows } = await supabase
      .from('expenses')
      .select('category, amount')
      .gte('date', firstDay)
      .lte('date', lastDay)

    if (!rows) return
    const summary = {}
    for (const row of rows) {
      summary[row.category] = (summary[row.category] || 0) + parseFloat(row.amount)
    }
    setData(Object.entries(summary).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total))
  }

  return (
    <div className="card">
      <h2>Par categorie — {currentMonth}</h2>
      {data.length === 0
        ? <p className="empty">Aucune donnee ce mois.</p>
        : <canvas ref={canvasRef} />
      }
    </div>
  )
}
