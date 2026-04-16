import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ExpenseList from './components/ExpenseList'
import CategoryChart from './components/CategoryChart'
import MonthlyBar from './components/MonthlyBar'
import './index.css'

export default function App() {
  const [monthTotal, setMonthTotal] = useState(0)

  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetchMonthTotal()

    const channel = supabase
      .channel('total-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, () => {
        fetchMonthTotal()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchMonthTotal() {
    const { data } = await supabase
      .from('expenses')
      .select('amount')
      .gte('date', `${currentMonth}-01`)
      .lte('date', `${currentMonth}-31`)

    if (data) {
      setMonthTotal(data.reduce((acc, r) => acc + parseFloat(r.amount), 0))
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Home Budget</h1>
          <div className="total-badge">
            <span className="total-label">{currentMonth}</span>
            <span className="total-amount">{monthTotal.toFixed(2)} MAD</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="grid-two">
          <CategoryChart />
          <MonthlyBar />
        </div>
        <ExpenseList />
      </main>
    </div>
  )
}
