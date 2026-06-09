import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Staff, Payroll as PayrollRow } from '../lib/types'
import { inr, monthKey, monthLabel } from '../lib/format'
import { Card, PageHeader, Pill, Kpi, Field, Input, Select, Empty } from '../components/ui'

function netPay(basic: number, present: number, working: number, advance: number, deductions: number) {
  const earned = working > 0 ? (basic * present) / working : basic
  return Math.max(0, Math.round(earned - advance - deductions))
}

export default function Payroll() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adv, setAdv] = useState({ staff_id: '', amount: '', reason: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const month = monthKey()

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('staff').select('*').order('name'),
      supabase.from('payroll').select('*').eq('month', month),
    ])
    setStaff((s as Staff[]) ?? [])
    setRows((p as PayrollRow[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Ensure a payroll row exists this month for each staff member.
  async function generatePayroll() {
    const existing = new Set(rows.map((r) => r.staff_id))
    const toCreate = staff.filter((s) => !existing.has(s.id))
    if (toCreate.length === 0) { setMsg('Payroll already generated for this month.'); return }
    await supabase.from('payroll').insert(
      toCreate.map((s) => ({
        staff_id: s.id, staff_name: s.name, role: s.role,
        basic: 0, present_days: 26, working_days: 26, advance: 0, deductions: 0,
        net_pay: 0, month, status: 'pending',
      }))
    )
    setMsg(`Payroll generated for ${toCreate.length} staff ✅`)
    load()
  }

  async function patch(row: PayrollRow, patch: Partial<PayrollRow>) {
    const merged = { ...row, ...patch }
    const np = netPay(Number(merged.basic), Number(merged.present_days), Number(merged.working_days), Number(merged.advance), Number(merged.deductions))
    setRows((arr) => arr.map((r) => (r.id === row.id ? { ...merged, net_pay: np } : r)))
    await supabase.from('payroll').update({ ...patch, net_pay: np }).eq('id', row.id)
  }

  async function markPaid(row: PayrollRow) {
    await supabase.from('payroll').update({ status: 'paid' }).eq('id', row.id)
    setRows((arr) => arr.map((r) => (r.id === row.id ? { ...r, status: 'paid' } : r)))
  }

  async function giveAdvance() {
    if (!adv.staff_id || !adv.amount) return setMsg('Pick a staff member and amount.')
    const row = rows.find((r) => r.staff_id === adv.staff_id)
    if (!row) return setMsg('Generate payroll first, then give advance.')
    await patch(row, { advance: Number(row.advance) + Number(adv.amount) })
    setAdv({ staff_id: '', amount: '', reason: '' })
    setMsg('Advance recorded ✅')
  }

  const totalPayroll = rows.reduce((s, r) => s + Number(r.basic), 0)
  const totalAdvance = rows.reduce((s, r) => s + Number(r.advance), 0)
  const netPayable = rows.filter((r) => r.status !== 'paid').reduce((s, r) => s + Number(r.net_pay), 0)

  return (
    <>
      <PageHeader
        title="Payroll"
        sub={`Staff salaries & attendance — ${monthLabel()}`}
        actions={<button className="btn btn-gold" onClick={generatePayroll}>Generate {monthLabel().split(' ')[0]} Payroll</button>}
      />
      {msg && <div className="alert-strip a-green">{msg}</div>}

      <div className="g4 mb16">
        <Kpi value={String(staff.length)} label="Staff Members" />
        <Kpi value={inr(totalPayroll)} label="Payroll This Month" color="var(--red)" />
        <Kpi value={inr(totalAdvance)} label="Advances Given" color="var(--gold)" />
        <Kpi value={inr(netPayable)} label="Net Payable" color="var(--green)" />
      </div>

      <Card title={`Staff Payroll — ${monthLabel()}`} className="mb16">
        {loading ? <Empty>Loading…</Empty> : staff.length === 0 ? (
          <Empty>No staff yet. Add staff under Settings → Staff & Access.</Empty>
        ) : rows.length === 0 ? (
          <Empty>No payroll for this month yet — click “Generate Payroll”.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Staff</th><th>Role</th><th className="r">Basic</th><th className="c">Present</th><th className="r">Advance</th><th className="r">Deductions</th><th className="r">Net Pay</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.staff_name}</strong></td>
                    <td>{r.role ?? '—'}</td>
                    <td className="r"><Input type="number" value={Number(r.basic)} onChange={(e) => patch(r, { basic: Number(e.target.value) })} style={{ width: 84, padding: '5px 8px' }} /></td>
                    <td className="c">
                      <Input type="number" value={Number(r.present_days)} onChange={(e) => patch(r, { present_days: Number(e.target.value) })} style={{ width: 52, padding: '5px 6px', textAlign: 'center' }} />
                      <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>/{Number(r.working_days)}</span>
                    </td>
                    <td className="r" style={{ color: 'var(--red)' }}>{inr(r.advance)}</td>
                    <td className="r"><Input type="number" value={Number(r.deductions)} onChange={(e) => patch(r, { deductions: Number(e.target.value) })} style={{ width: 72, padding: '5px 8px' }} /></td>
                    <td className="r"><strong>{inr(r.net_pay)}</strong></td>
                    <td><Pill tone={r.status === 'paid' ? 'green' : 'gold'}>{r.status === 'paid' ? 'Paid' : 'Pending'}</Pill></td>
                    <td>{r.status !== 'paid' && <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => markPaid(r)}>Mark Paid</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="g2">
        <Card title="Give Advance">
          <div className="form-row">
            <Field label="Staff Member">
              <Select value={adv.staff_id} onChange={(e) => setAdv({ ...adv, staff_id: e.target.value })}>
                <option value="">Select…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Advance Amount (₹)"><Input type="number" min={0} value={adv.amount} placeholder="0" onChange={(e) => setAdv({ ...adv, amount: e.target.value })} /></Field>
          </div>
          <Field label="Reason"><Input value={adv.reason} placeholder="E.g. Medical emergency…" onChange={(e) => setAdv({ ...adv, reason: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={giveAdvance}>Record Advance</button>
        </Card>

        <Card title="Attendance Summary">
          {rows.length === 0 ? <Empty>Generate payroll to see attendance.</Empty> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="sum-row"><span>Working Days</span><span>{rows[0]?.working_days ?? 26}</span></div>
              {rows.map((r) => {
                const absent = Number(r.working_days) - Number(r.present_days)
                const color = absent === 0 ? 'var(--green)' : absent <= 2 ? 'var(--gold)' : 'var(--red)'
                return (
                  <div className="sum-row" key={r.id}>
                    <span>{r.staff_name}</span>
                    <span style={{ color }}>{r.present_days}/{r.working_days}{absent > 0 ? ` (${absent} absent)` : ' ✓'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
