import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ExpenseList() {
  const [expenses, setExpenses] = useState([])

  useEffect(() => {
    fetchExpenses()

    const channel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, (payload) => {
        setExpenses((prev) => [payload.new, ...prev].slice(0, 20))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setExpenses(data)
  }

  const CATEGORY_COLORS = {
    alimentation: '#4ade80',
    restauration: '#fb923c',
    transport: '#60a5fa',
    logement: '#a78bfa',
    sante: '#f87171',
    loisirs: '#facc15',
    habillement: '#f472b6',
    education: '#34d399',
    services: '#94a3b8',
    autre: '#cbd5e1',
  }

  return (
    <div className="card">
      <h2>Dernieres depenses</h2>
      <div className="expense-list">
        {expenses.length === 0 && <p className="empty">Aucune depense enregistree.</p>}
        {expenses.map((exp) => (
          <div key={exp.id} className="expense-item">
            <div className="expense-left">
              <span
                className="category-dot"
                style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#cbd5e1' }}
              />
              <div>
                <div className="expense-desc">{exp.description}</div>
                <div className="expense-meta">{exp.category} · {exp.paid_by} · {exp.date}</div>
              </div>
            </div>
            <div className="expense-amount">
              {parseFloat(exp.amount).toFixed(2)} {exp.currency}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
