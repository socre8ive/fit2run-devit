// Date utility functions for consistent formatting

export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString)
  const month = (date.getMonth() + 1).toString()
  const day = date.getDate().toString()
  const year = date.getFullYear().toString().slice(-2)
  
  return `${month}-${day}-${year}`
}

export function formatDateForChart(dateString: string): string {
  return formatDateForDisplay(dateString)
}

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}