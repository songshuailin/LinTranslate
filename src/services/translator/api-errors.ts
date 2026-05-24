export async function buildApiErrorMessage(prefix: string, response: Response): Promise<string> {
  const fallback = `${prefix}: ${response.status} ${response.statusText}`.trim()

  const text = await response.text().catch(() => '')
  if (!text) return fallback

  try {
    const data = JSON.parse(text) as {
      error?: { message?: string }
      message?: string
      detail?: string
    }
    const message = data.error?.message || data.message || data.detail
    if (message) return `${prefix}: ${response.status} - ${message}`
  } catch {
    // Fall through to a short text preview.
  }

  return `${fallback} - ${text.slice(0, 300)}`
}
