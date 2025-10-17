import { v4 as uuid } from 'uuid'

class DataStore {
  constructor () {
    this.contracts = []
    this.purchaseOrders = []
    this.invoices = []
    this.files = []
    this.discrepancies = []
    this.rules = []
    this.errors = []
    this.llmAnalyses = []
    this.users = [
      { user_id: 'admin-1', name: 'Demo Admin', email: 'admin@example.com', role: 'admin', last_login: new Date().toISOString() }
    ]
  }

  listContracts () { return this.contracts }
  listPurchaseOrders () { return this.purchaseOrders }
  listInvoices () { return this.invoices }
  listFiles () { return this.files }
  listDiscrepancies () { return this.discrepancies }
  listRules () { return this.rules }
  listErrors () { return this.errors }
  listLLMAnalyses () { return this.llmAnalyses }
  listUsers () { return this.users }

  addContract (payload) {
    const contract = { ...payload, contract_id: payload.contract_id ?? uuid(), upload_date: payload.upload_date ?? new Date().toISOString() }
    this.contracts.push(contract)
    return contract
  }

  addPurchaseOrder (payload) {
    const po = { ...payload, po_id: payload.po_id ?? uuid(), issue_date: payload.issue_date ?? new Date().toISOString() }
    this.purchaseOrders.push(po)
    return po
  }

  addInvoice (payload) {
    const invoice = { ...payload, invoice_id: payload.invoice_id ?? uuid(), received_date: payload.received_date ?? new Date().toISOString() }
    this.invoices.push(invoice)
    return invoice
  }

  addFileRecord (payload) {
    const fileRecord = { ...payload, file_id: payload.file_id ?? uuid() }
    this.files.push(fileRecord)
    return fileRecord
  }

  addDiscrepancy (payload) {
    const discrepancy = { ...payload, discrepancy_id: payload.discrepancy_id ?? uuid(), reviewed: payload.reviewed ?? false }
    this.discrepancies.push(discrepancy)
    return discrepancy
  }

  addRuleResult (payload) {
    const rule = { ...payload, rule_id: payload.rule_id ?? uuid() }
    this.rules.push(rule)
    return rule
  }

  addError (payload) {
    const error = { ...payload, error_id: payload.error_id ?? uuid(), timestamp: payload.timestamp ?? new Date().toISOString() }
    this.errors.push(error)
    return error
  }

  addLLMAnalysis (payload) {
    const analysis = { ...payload, analysis_id: payload.analysis_id ?? uuid() }
    this.llmAnalyses.push(analysis)
    return analysis
  }

  addUser (payload) {
    const user = { ...payload, user_id: payload.user_id ?? uuid(), last_login: payload.last_login ?? new Date().toISOString() }
    this.users.push(user)
    return user
  }
}

export const dataStore = new DataStore()
