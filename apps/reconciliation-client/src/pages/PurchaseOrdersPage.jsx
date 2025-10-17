import { useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient.js'
import { PortalCard } from '../components/PortalCard.jsx'
import { DataTable } from '../components/DataTable.jsx'

export function PurchaseOrdersPage () {
  const api = useApiClient()
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [form, setForm] = useState({ vendor_id: '', issue_date: '', items: [{ description: '', quantity: 1, rate: 0 }] })
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadPurchaseOrders () {
      const { data } = await api.get('/purchase-orders')
      setPurchaseOrders(data.data)
    }
    loadPurchaseOrders()
  }, [api])

  function updateItem (index, field, value) {
    setForm(prev => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  function addItem () {
    setForm(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, rate: 0 }] }))
  }

  async function handleSubmit (event) {
    event.preventDefault()
    try {
      const payload = {
        vendor_id: form.vendor_id,
        issue_date: form.issue_date,
        items: form.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          rate: Number(item.rate)
        }))
      }
      const { data } = await api.post('/purchase-orders', payload)
      setPurchaseOrders(prev => [...prev, data.entity])
      setForm({ vendor_id: '', issue_date: '', items: [{ description: '', quantity: 1, rate: 0 }] })
      setError(null)
    } catch (err) {
      setError(err.response?.data?.errors?.join(', ') ?? err.message)
    }
  }

  return (
    <PortalCard
      title="Purchase Order Management"
      description="Create and monitor purchase orders. These records drive automated invoice matching."
    >
      {error && <div className="alert error">{error}</div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <input
          placeholder="Vendor ID"
          value={form.vendor_id}
          onChange={event => setForm(prev => ({ ...prev, vendor_id: event.target.value }))}
          required
        />
        <input
          type="date"
          value={form.issue_date}
          onChange={event => setForm(prev => ({ ...prev, issue_date: event.target.value }))}
        />
        {form.items.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(2, 1fr)', gap: '0.5rem' }}>
            <input
              placeholder="Item description"
              value={item.description}
              onChange={event => updateItem(index, 'description', event.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Qty"
              value={item.quantity}
              onChange={event => updateItem(index, 'quantity', event.target.value)}
              min="1"
              required
            />
            <input
              type="number"
              placeholder="Rate"
              value={item.rate}
              onChange={event => updateItem(index, 'rate', event.target.value)}
              min="0"
              step="0.01"
              required
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="button secondary" onClick={addItem}>Add Line Item</button>
          <button type="submit" className="button">Save Purchase Order</button>
        </div>
      </form>

      <DataTable
        columns={[
          { header: 'PO ID', accessor: 'po_id' },
          { header: 'Vendor', accessor: 'vendor_id' },
          { header: 'Items', accessor: 'items', cell: (value) => value.map(item => `${item.description} (${item.quantity} @ ${item.rate})`).join(', ') },
          { header: 'Issue Date', accessor: 'issue_date' }
        ]}
        data={purchaseOrders.map(po => ({ ...po }))}
      />
    </PortalCard>
  )
}
