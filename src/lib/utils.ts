export function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof (error as Record<string, unknown>).message === 'string'
  )
    return (error as { message: string }).message

  try {
    return new Error(JSON.stringify(error)).message
  }
  catch {
    return String(error)
  }
}
