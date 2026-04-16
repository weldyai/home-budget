import { useEffect, useRef, useState } from 'react'
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js'
import { supabase } from '../lib/supabase'

Chart.register(ArcElement, Tooltip, DoughnutController)

const COLORS = ['#3b82f6','#f97316','#22c55e','#a855f7','#ef4444','#eab308','#ec4899','#14b8a6','#64748b','#94a3b8']

export default function CategoryChart({ month }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [data, setData] = useState([])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [month])

  useEffect(() => {
    if (!canvasRef.current || !data.length) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.category),
        datasets: [{ data: data.map(d => d.total), backgroundColor: COLORS, borderWidth: 3, borderColor: '#1e293b' }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.toFixed(0)} MAD` } } },
      },
    })
    return () => chartRef.current?.destroy()
  }, [data])

  async function fetchData() {
    const { data: rows } = await supabase.from('expenses').select('category, amount').gte('date', `${month}-01`).lte('date', `${month}-31`)
    if (!rows?.length) return setData([])
    const agg = {}
    rows.forEach(r => agg[r.category] = (agg[r.category] || 0) + parseFloat(r.amount))
    setData(Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total })))
  }

  if (!data.length) return <div className="card"><p className="empty">Aucune donnée ce mois.</p></div>

  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="card">
      <div className="card-title">🥧 Par catégorie — {month}</div>
      <div className="chart-wrap" style={{ maxWidth: 220, margin: '0 auto' }}>
        <canvas ref={canvasRef} />
      </div>
      <div className="cat-legend">
        {data.map((d, i) => (
          <div key={d.category} className="cat-row">
            <div className="cat-row-left">
              <div className="cat-dot" style={{ background: COLORS[i] }} />
              <span className="cat-name">{d.category}</span>
            </div>
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{(d.total / total * 100).toFixed(0)}%</span>
              <span className="cat-amount">{d.total.toFixed(0)} MAD</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
