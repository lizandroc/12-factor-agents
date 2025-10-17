import { useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient.js'
import { PortalCard } from '../components/PortalCard.jsx'
import { DataTable } from '../components/DataTable.jsx'

const invoiceFileTypes = ['pdf', 'jpg', 'csv', 'xls', 'xlsx']

export function InvoicesPage () {
  const api = useApiClient()
  const [invoices, setInvoices] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [form, setForm] = useState({
    vendor_id: '',
    linked_po_id: '',
    items: [{ description: '', quantity: 1, rate: 0 }],
    file_type: 'pdf',
    file_url: ''
  })
  const [statusMessage, setStatusMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData () {
      const [invoiceRes, poRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/purchase-orders')
      ])
      setInvoices(invoiceRes.data.data)
      setPurchaseOrders(poRes.data.data)
    }
    loadData()
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

  async function handleFileUpload (event) {
    const file = event.target.files?.[0]
    if (!file) return
    const payload = new FormData()
    payload.append('file', file)
    try {
      const { data } = await api.post('/files/upload', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStatusMessage({ type: 'success', message: `Uploaded ${file.name}` })
      setForm(prev => ({ ...prev, file_type: mapMime(file.type), file_url: `uploaded://${data.entity.file_id}` }))
    } catch (err) {
      setStatusMessage({ type: 'error', message: err.response?.data?.errors?.join(', ') ?? err.message })
    }
  }

  function mapMime (mime) {
    if (mime.includes('pdf')) return 'pdf'
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
    if (mime.includes('csv')) return 'csv'
    if (mime.includes('excel') || mime.includes('spreadsheetml')) return 'xlsx'
    return form.file_type
  }

  async function handleSubmit (event) {
    event.preventDefault()
    try {
      const payload = {
        vendor_id: form.vendor_id,
        linked_po_id: form.linked_po_id,
        items: form.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          rate: Number(item.rate)
        })),
        file_type: form.file_type,
        file_url: form.file_url || 'uploaded://manual'
      }
      const { data } = await api.post('/invoices', payload)
      setInvoices(prev => [...prev, data.entity])
      setForm({ vendor_id: '', linked_po_id: '', items: [{ description: '', quantity: 1, rate: 0 }], file_type: 'pdf', file_url: '' })
      setError(null)
      setStatusMessage({ type: 'success', message: 'Invoice saved.' })
    } catch (err) {
      setError(err.response?.data?.errors?.join(', ') ?? err.message)
    }
  }

  async function reconcileInvoice (invoiceId) {
    try {
      const { data } = await api.post('/reconcile', { invoice_id: invoiceId })
      const summary = data.findings.map(finding => `${finding.issue_type}: ${finding.summary}`).join('; ') || 'No discrepancies found.'
      setStatusMessage({ type: 'success', message: `Reconciliation complete. ${summary}` })
    } catch (err) {
      setStatusMessage({ type: 'error', message: err.response?.data?.errors?.join(', ') ?? err.message })
    }
  }

  return (
    <PortalCard
      title="Invoice Management"
      description="Log invoices, attach source documents, and initiate AI-backed reconciliation to confirm accuracy."
    >
      {statusMessage && <div className={`alert ${statusMessage.type === 'success' ? 'success' : 'error'}`}>{statusMessage.message}</div>}
      {error && <div className="alert error">{error}</div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <input
          placeholder="Vendor ID"
          value={form.vendor_id}
          onChange={event => setForm(prev => ({ ...prev, vendor_id: event.target.value }))}
          required
        />
        <select
          value={form.linked_po_id}
          onChange={event => setForm(prev => ({ ...prev, linked_po_id: event.target.value }))}
          required
        >
          <option value="">Select Purchase Order</option>
          {purchaseOrders.map(po => (
            <option key={po.po_id} value={po.po_id}>{po.po_id} - {po.vendor_id}</option>
          ))}
        </select>
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
        <label>
          Upload Invoice File
          <input type="file" onChange={handleFileUpload} accept={invoiceFileTypes.map(type => `.${type}`).join(',')} />
        </label>
        <select
          value={form.file_type}
          onChange={event => setForm(prev => ({ ...prev, file_type: event.target.value }))}
        >
          {invoiceFileTypes.map(type => (
            <option key={type} value={type}>{type.toUpperCase()}</option>
          ))}
        </select>
        <input
          placeholder="File URL"
          value={form.file_url}
          onChange={event => setForm(prev => ({ ...prev, file_url: event.target.value }))}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="button secondary" onClick={addItem}>Add Line Item</button>
          <button type="submit" className="button">Save Invoice</button>
        </div>
      </form>

      <DataTable
        columns={[
          { header: 'Invoice ID', accessor: 'invoice_id' },
          { header: 'Vendor', accessor: 'vendor_id' },
          { header: 'Linked PO', accessor: 'linked_po_id' },
          { header: 'Items', accessor: 'items', cell: value => value.map(item => `${item.description} (${item.quantity} @ ${item.rate})`).join(', ') },
          { header: 'File', accessor: 'file_type', cell: (value, row) => `${value.toUpperCase()} • ${row.file_url}` },
          { header: 'Actions', accessor: 'invoice_id', cell: (value) => <button className="button" onClick={() => reconcileInvoice(value)}>Reconcile</button> }
        ]}
        data={invoices.map(invoice => ({ ...invoice }))}
      />
    </PortalCard>
  )
}
