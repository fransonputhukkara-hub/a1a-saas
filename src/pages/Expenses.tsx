import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Expense } from '../lib/types'
import { inr, today, shortDate, isThisMonth, monthLabel } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, Field, Input, Select, BarChart, Empty } from '../components/ui'

const CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Packaging', 'Marketing', 'Repairs', 'Other']
const TONES: Record<string, 'orange' | 'blue' | 'purple' | 'teal' | 'gray' | 'red' | 'gold'> = {
  Rent: 'orange', Electricity: 'blue', 'Staff Salary': 'red', Packaging: 'purple', Marketing: 'teal', Repairs: 'gold', Other: 'gray',
}
const COLORS: Record<string, string> = {
  Rent: 'var(--orange)', Electricity: 'var(--blue)', 'Staff Salary': 'var(--red)', Packaging: 'var(--purple)', Marketing: 'var(--teal)', Repairs: 'var(--gold)', Other: 'var(--muted)',
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [form, setForm] = useState({ category: 'Rent', amount: '', date: today(), paid_via: 'Cash', description: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  function load() {
    setLoading(true)
    supabase.from('expenses').select('*').order('date', { ascending: false }).then(({ data }) => {
      setExpenses((data as Expense[]) ?? [])
      setLoading(false)
    })
  }
  useEffect(load, [])

  const monthExpenses = useMemo(() => expenses.filter((e) => isThisMonth(e.date)), [expenses])
  const monthTotal = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of monthExpenses) m[e.category] = (m[e.category] ?? 0) + Number(e.amount)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthExpenses])
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v))

  async function add() {
    if (!form.amount || Number(form.amount) <= 0) return setMsg('Enter a valid amount.')
    await supabase.from('expenses').insert({
      category: form.category,
      amount: Number(form.amount),
      date: form.date,
      paid_via: form.paid_via,
      description: form.description.trim() || null,
    })
    setForm({ category: 'Rent', amount: '', date: today(), paid_via: 'Cash', description: '' })
    setMsg('Expense added ✅')
    load()
  }

  const rent = byCategory.find(([c]) => c === 'Rent')?.[1] ?? 0
  const elec = byCategory.find(([c]) => c === 'Electricity')?.[1] ?? 0
  const other = monthTotal - rent - elec

  return (
    <>
      <PageHeader title="Expenses" sub="Track all shop operating costs" actions={<button className="btn btn-gold" onClick={add}>＋ Add Expense</button>} />
      {msg && <div className="alert-strip a-green">{msg}</div>}

      <div className="g4 mb16">
        <Kpi value={inr(monthTotal)} label="This Month" color="var(--red)" />
        <Kpi value={inr(rent)} label="Shop Rent" />
        <Kpi value={inr(elec)} label="Electricity" />
        <Kpi value={inr(other)} label="Other" />
      </div>

      <div className="g-sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Add Expense">
            <div className="form-row">
              <Field label="Category">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Amount (₹)"><Input type="number" min={0} value={form.amount} placeholder="0.00" onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            </div>
            <div className="form-row">
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Paid Via">
                <Select value={form.paid_via} onChange={(e) => setForm({ ...form, paid_via: e.target.value })}>
                  <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option>
                </Select>
              </Field>
            </div>
            <Field label="Notes"><Input value={form.description} placeholder="E.g. June rent to landlord…" onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <button className="btn btn-gold" onClick={add}>Add Expense</button>
          </Card>

          <Card title={`Expense Ledger — ${monthLabel()}`}>
            {loading ? <Empty>Loading…</Empty> : monthExpenses.length === 0 ? <Empty>No expenses this month.</Empty> : (
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="r">Amount</th><th>Mode</th></tr></thead>
                  <tbody>
                    {monthExpenses.map((e) => (
                      <tr key={e.id}>
                        <td>{shortDate(e.date)}</td>
                        <td><Pill tone={TONES[e.category] ?? 'gray'}>{e.category}</Pill></td>
                        <td>{e.description ?? '—'}</td>
                        <td className="r">{inr(e.amount)}</td>
                        <td>{e.paid_via}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Expense Breakdown" sticky>
            {byCategory.length === 0 ? <Empty>No data yet.</Empty> : (
              <>
                <BarChart rows={byCategory.map(([cat, val]) => ({ label: cat, pct: (val / maxCat) * 100, amount: inr(val), color: COLORS[cat] ?? 'var(--muted)' }))} />
                <div className="sum-row total" style={{ marginTop: 16 }}><span>Total Expenses</span><span style={{ color: 'var(--red)' }}>{inr(monthTotal)}</span></div>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
