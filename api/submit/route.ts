import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://ralexo1881.app.n8n.cloud/webhook/ss-hub-submit'

  try {
    // Parse incoming form data (includes file if present)
    const formData = await request.formData()

    // Add submission timestamp
    formData.append('submittedAt', new Date().toISOString())

    // Forward to n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('n8n webhook error:', response.status, text)
      return NextResponse.json(
        { error: 'The workflow could not be started. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Submission error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
