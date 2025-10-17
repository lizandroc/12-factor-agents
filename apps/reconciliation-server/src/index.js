import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { dataStore } from './dataStore.js'
import { reconcileWithLLM } from './llmService.js'

const app = express()
const upload = multer({ dest: 'uploads/' })

app.use(cors())
app.use(express.json())

function validateEntityFields (entity, requiredFields) {
  const missing = requiredFields.filter(field => entity[field] === undefined || entity[field] === null)
  return missing
}

function generateRuleChecks (invoice, po) {
  const findings = []
  const rules = []

  if (!po) {
    const discrepancy = dataStore.addDiscrepancy({
      linked_po_id: invoice?.linked_po_id ?? null,
      linked_invoice_id: invoice.invoice_id,
      issue_type: 'missing_po',
      summary: 'Invoice references a purchase order that does not exist.',
      severity: 'critical',
      detected_by: 'rule',
      reviewed: false
    })
    findings.push(discrepancy)
    rules.push(dataStore.addRuleResult({ description: 'Invoice references existing PO', passed: false, details: 'No PO found for invoice.' }))
    return { findings, rules }
  }

  let quantityPassed = true
  let ratePassed = true
  invoice.items.forEach(item => {
    const poItem = po.items.find(poLine => poLine.description === item.description)
    if (!poItem) {
      const discrepancy = dataStore.addDiscrepancy({
        linked_po_id: po.po_id,
        linked_invoice_id: invoice.invoice_id,
        issue_type: 'missing_po',
        summary: `Invoice item ${item.description} missing from PO.`,
        severity: 'warning',
        detected_by: 'rule',
        reviewed: false
      })
      findings.push(discrepancy)
      quantityPassed = false
      ratePassed = false
      return
    }

    if (item.quantity !== poItem.quantity) {
      const discrepancy = dataStore.addDiscrepancy({
        linked_po_id: po.po_id,
        linked_invoice_id: invoice.invoice_id,
        issue_type: 'quantity_mismatch',
        summary: `Invoice quantity ${item.quantity} vs PO quantity ${poItem.quantity} for ${item.description}.`,
        severity: 'critical',
        detected_by: 'rule',
        reviewed: false
      })
      findings.push(discrepancy)
      quantityPassed = false
    }

    if (item.rate !== poItem.rate) {
      const discrepancy = dataStore.addDiscrepancy({
        linked_po_id: po.po_id,
        linked_invoice_id: invoice.invoice_id,
        issue_type: 'rate_mismatch',
        summary: `Invoice rate ${item.rate} vs PO rate ${poItem.rate} for ${item.description}.`,
        severity: 'warning',
        detected_by: 'rule',
        reviewed: false
      })
      findings.push(discrepancy)
      ratePassed = false
    }
  })

  rules.push(dataStore.addRuleResult({ description: 'Invoice quantities align with PO', passed: quantityPassed, details: quantityPassed ? 'Quantities match.' : 'Mismatch detected.' }))
  rules.push(dataStore.addRuleResult({ description: 'Invoice rates align with PO', passed: ratePassed, details: ratePassed ? 'Rates match.' : 'Mismatch detected.' }))

  return { findings, rules }
}

app.post('/api/auth/email', (req, res) => {
  const { email, name } = req.body
  if (!email) {
    return res.status(400).json({ status: 'failure', errors: ['Email is required.'] })
  }

  const user = dataStore.addUser({ email, name: name ?? email.split('@')[0], role: 'user' })
  return res.json({ user_id: user.user_id, auth_method: 'email', email: user.email, token: `dev-token-${user.user_id}`, expires_in: 3600 })
})

app.post('/api/auth/google', (req, res) => {
  const { email, name } = req.body
  if (!email) {
    return res.status(400).json({ status: 'failure', errors: ['Google email required.'] })
  }
  const user = dataStore.addUser({ email, name: name ?? email.split('@')[0], role: 'user' })
  return res.json({ user_id: user.user_id, auth_method: 'google', email: user.email, token: `google-dev-token-${user.user_id}`, expires_in: 3600 })
})

app.get('/api/users', (req, res) => {
  res.json({ status: 'success', data: dataStore.listUsers() })
})

app.get('/api/contracts', (req, res) => {
  res.json({ status: 'success', data: dataStore.listContracts() })
})

app.post('/api/contracts', (req, res) => {
  const contract = req.body
  const missing = validateEntityFields(contract, ['vendor_id', 'agreement_terms', 'file_type', 'file_url'])
  if (missing.length) {
    return res.status(400).json({ status: 'failure', entity: null, errors: [`Missing fields: ${missing.join(', ')}`] })
  }
  const stored = dataStore.addContract(contract)
  res.status(201).json({ status: 'success', entity: stored, errors: null })
})

app.get('/api/purchase-orders', (req, res) => {
  res.json({ status: 'success', data: dataStore.listPurchaseOrders() })
})

app.post('/api/purchase-orders', (req, res) => {
  const po = req.body
  const missing = validateEntityFields(po, ['vendor_id', 'items'])
  if (missing.length) {
    return res.status(400).json({ status: 'failure', entity: null, errors: [`Missing fields: ${missing.join(', ')}`] })
  }
  const stored = dataStore.addPurchaseOrder(po)
  res.status(201).json({ status: 'success', entity: stored, errors: null })
})

app.get('/api/invoices', (req, res) => {
  res.json({ status: 'success', data: dataStore.listInvoices() })
})

app.post('/api/invoices', (req, res) => {
  const invoice = req.body
  const missing = validateEntityFields(invoice, ['vendor_id', 'linked_po_id', 'items', 'file_type', 'file_url'])
  if (missing.length) {
    return res.status(400).json({ status: 'failure', entity: null, errors: [`Missing fields: ${missing.join(', ')}`] })
  }
  const stored = dataStore.addInvoice(invoice)
  res.status(201).json({ status: 'success', entity: stored, errors: null })
})

app.post('/api/files/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'failure', errors: ['No file uploaded.'] })
  }

  const fileRecord = dataStore.addFileRecord({
    file_type: req.file.mimetype,
    extract_status: 'success',
    extracted_data: { filename: req.file.originalname },
    errors: null
  })

  res.status(201).json({ status: 'success', entity: fileRecord, errors: null })
})

app.post('/api/reconcile', async (req, res) => {
  try {
    const { invoice_id } = req.body
    const invoice = dataStore.listInvoices().find(inv => inv.invoice_id === invoice_id)
    if (!invoice) {
      return res.status(404).json({ status: 'failure', findings: [], errors: ['Invoice not found.'] })
    }

    const po = dataStore.listPurchaseOrders().find(order => order.po_id === invoice.linked_po_id)

    const { findings, rules } = generateRuleChecks(invoice, po)

    const prompt = `Compare the following purchase order and invoice. Identify discrepancies and provide recommendations.\nPO: ${JSON.stringify(po)}\nInvoice: ${JSON.stringify(invoice)}`
    const llmResult = await reconcileWithLLM({ prompt, linked_po_id: po?.po_id, linked_invoice_id: invoice.invoice_id })
    const storedLLM = dataStore.addLLMAnalysis(llmResult)

    const responsePayload = {
      status: 'success',
      findings,
      errors: null
    }

    res.json({
      ...responsePayload,
      llm_analysis: storedLLM,
      rules
    })
  } catch (error) {
    const errRecord = dataStore.addError({ step: 'reconciliation', message: error.message })
    res.status(500).json({ status: 'failure', findings: [], errors: [error.message], error_id: errRecord.error_id })
  }
})

app.get('/api/dashboard', (req, res) => {
  const data = dataStore.listDiscrepancies()
  res.json({ status: 'success', data, errors: null })
})

app.get('/api/rules', (req, res) => {
  res.json({ status: 'success', data: dataStore.listRules(), errors: null })
})

app.get('/api/errors', (req, res) => {
  res.json({ status: 'success', data: dataStore.listErrors(), errors: null })
})

app.get('/api/llm-analyses', (req, res) => {
  res.json({ status: 'success', data: dataStore.listLLMAnalyses(), errors: null })
})

const port = process.env.PORT ?? 4000
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Reconciliation server listening on port ${port}`)
})
