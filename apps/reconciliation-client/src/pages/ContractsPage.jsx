import { useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient.js'
import { PortalCard } from '../components/PortalCard.jsx'
import { DataTable } from '../components/DataTable.jsx'

const fileTypes = ['pdf', 'jpg', 'csv', 'xls', 'xlsx']

export function ContractsPage () {
  const api = useApiClient()
  const [contracts, setContracts] = useState([])
  const [form, setForm] = useState({ vendor_id: '', agreement_terms: '', file_type: 'pdf', file_url: '' })
  const [fileStatus, setFileStatus] = useState(null)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    async function loadContracts () {
      const { data } = await api.get('/contracts')
      setContracts(data.data)
    }
    loadContracts()
  }, [api])

  async function handleFileUpload (event) {
    const file = event.target.files?.[0]
    if (!file) return
    const payload = new FormData()
    payload.append('file', file)
    try {
      const { data } = await api.post('/files/upload', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      setFileStatus({ success: true, message: `Uploaded ${file.name}` })
      setForm(prev => ({ ...prev, file_type: mapMimeToType(file.type), file_url: `uploaded://${data.entity.file_id}` }))
    } catch (error) {
      setFileStatus({ success: false, message: error.response?.data?.errors?.join(', ') ?? error.message })
    }
  }

  function mapMimeToType (mime) {
    if (mime.includes('pdf')) return 'pdf'
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
    if (mime.includes('csv')) return 'csv'
    if (mime.includes('excel') || mime.includes('spreadsheetml')) return 'xlsx'
    return form.file_type
  }

  async function handleSubmit (event) {
    event.preventDefault()
    try {
      const payload = { ...form, file_type: form.file_type, file_url: form.file_url || 'uploaded://manual' }
      const { data } = await api.post('/contracts', payload)
      setContracts(prev => [...prev, data.entity])
      setForm({ vendor_id: '', agreement_terms: '', file_type: 'pdf', file_url: '' })
      setFileStatus(null)
      setFormError(null)
    } catch (error) {
      setFormError(error.response?.data?.errors?.join(', ') ?? error.message)
    }
  }

  return (
    <PortalCard
      title="Contract Upload Portal"
      description="Upload master agreements to anchor invoice reconciliation and ensure negotiated terms are enforced."
    >
      {fileStatus && (
        <div className={`alert ${fileStatus.success ? 'success' : 'error'}`}>
          {fileStatus.message}
        </div>
      )}
      {formError && <div className="alert error">{formError}</div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <input
          placeholder="Vendor ID"
          value={form.vendor_id}
          onChange={event => setForm(prev => ({ ...prev, vendor_id: event.target.value }))}
          required
        />
        <textarea
          placeholder="Agreement Terms"
          rows={4}
          value={form.agreement_terms}
          onChange={event => setForm(prev => ({ ...prev, agreement_terms: event.target.value }))}
          required
        />
        <label>
          Upload Contract File
          <input type="file" onChange={handleFileUpload} accept={fileTypes.map(type => `.${type}`).join(',')} />
        </label>
        <select
          value={form.file_type}
          onChange={event => setForm(prev => ({ ...prev, file_type: event.target.value }))}
        >
          {fileTypes.map(type => (
            <option key={type} value={type}>{type.toUpperCase()}</option>
          ))}
        </select>
        <input
          placeholder="File URL"
          value={form.file_url}
          onChange={event => setForm(prev => ({ ...prev, file_url: event.target.value }))}
        />
        <button className="button" type="submit">Create Contract</button>
      </form>

      <DataTable
        columns={[
          { header: 'Contract ID', accessor: 'contract_id' },
          { header: 'Vendor', accessor: 'vendor_id' },
          { header: 'Terms', accessor: 'agreement_terms' },
          { header: 'Uploaded', accessor: 'upload_date' },
          { header: 'File Type', accessor: 'file_type' },
          { header: 'File URL', accessor: 'file_url' }
        ]}
        data={contracts.map(contract => ({ ...contract }))}
      />
    </PortalCard>
  )
}
