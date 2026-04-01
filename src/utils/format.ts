export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('pt-BR')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatRole(role: string): string {
  const roles: Record<string, string> = {
    DONO: 'Dono',
    GERENTE: 'Gerente',
    FUNCIONARIO: 'Funcionário',
    CLIENTE: 'Cliente',
  }
  return roles[role] ?? role
}

export function getTodayDate(): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function toISO(date: string, time: string, seconds = '00'): string {
  return new Date(`${date}T${time}:${seconds}`).toISOString()
}
