import { describe, it, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Table, TableBody, TableRow, TableCell } from './table'

describe('TableRow', () => {
  it('renders with default hover styling when no accentColor is given', () => {
    render(
      <Table><TableBody>
        <TableRow><TableCell>plain row</TableCell></TableRow>
      </TableBody></Table>
    )
    const row = screen.getByText('plain row').closest('tr')!
    expect(row.className).toContain('hover:bg-black/10')
    expect(row.className).toContain('dark:hover:bg-white/10')
    expect(row.className).not.toContain('bg-row')
    expect(row.style.boxShadow).toBe('')
  })

  it('renders a bordered row (no gray fill) with a colored left edge when accentColor is given', () => {
    render(
      <Table><TableBody>
        <TableRow accentColor="#dc2626"><TableCell>accented row</TableCell></TableRow>
      </TableBody></Table>
    )
    const row = screen.getByText('accented row').closest('tr')!
    expect(row.className).not.toContain('bg-row')
    expect(row.className).toContain('border-foreground')
    // Indicador de status via inset box-shadow (nao border-l) - assim fica
    // sempre dentro da linha, nunca disputa com a borda externa da tabela
    // via border-collapse.
    expect(row.style.boxShadow).toBe('inset 4px 0 0 0 #dc2626')
    // top/bottom tracejado (divisor entre linhas) - furo real: skeleton nao
    // tem accentColor, so as linhas de dado real passam por aqui.
    expect(row.className).toContain('[border-top-style:dashed]')
    expect(row.className).toContain('[border-bottom-style:dashed]')
  })
})
