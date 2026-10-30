const numero = (valor, casas = 0) =>
  valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export const semDado = '—'

export function formatarInteiro(valor) {
  return valor == null ? semDado : numero(Math.round(valor))
}

export function formatarPercentual(valor, casas = 1) {
  return valor == null ? semDado : `${numero(valor, casas)}%`
}

export function formatarKm(valor) {
  return valor == null ? semDado : `${numero(valor, 1)} km`
}

export function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// "Ana P." vira AP e "Empilhadeira 02" vira E2.
export function iniciais(nome) {
  const palavras = nome.trim().split(/\s+/)
  const primeira = palavras[0]?.[0] ?? '?'
  if (palavras.length === 1) return nome.trim().slice(0, 2).toUpperCase()
  const segunda = palavras[1]
  const letra = /^\d+$/.test(segunda) ? segunda.slice(-1) : segunda[0]
  return `${primeira}${letra}`.toUpperCase()
}

export function turnoAtual(agora = new Date()) {
  const hora = agora.getHours()
  if (hora >= 6 && hora < 12) return 'turno da manhã (6h–12h)'
  if (hora >= 12 && hora < 18) return 'turno da tarde (12h–18h)'
  return 'turno da noite (18h–6h)'
}
