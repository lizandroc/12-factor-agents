import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

export async function reconcileWithLLM ({ prompt, linked_po_id, linked_invoice_id }) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      analysis_id: 'llm-dev-' + Date.now(),
      linked_po_id,
      linked_invoice_id,
      summary: 'LLM analysis skipped: OPENAI_API_KEY not configured.',
      flagged_issues: ['LLM_DISABLED'],
      recommendations: ['Provide an OpenAI API key to enable reconciliation insights.'],
      output_format: 'text'
    }
  }

  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
    response_format: { type: 'json_schema', json_schema: {
      name: 'ReconciliationOutput',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          flagged_issues: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        },
        required: ['summary', 'flagged_issues', 'recommendations'],
        additionalProperties: false
      }
    } }
  )

  const content = response.output[0]?.content[0]?.text
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    parsed = {
      summary: 'Unable to parse LLM response.',
      flagged_issues: ['invalid_json'],
      recommendations: ['Review model output and schema.']
    }
  }

  return {
    analysis_id: response.id,
    linked_po_id,
    linked_invoice_id,
    summary: parsed.summary,
    flagged_issues: parsed.flagged_issues,
    recommendations: parsed.recommendations,
    output_format: 'json'
  }
}
