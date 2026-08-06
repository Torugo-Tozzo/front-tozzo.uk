import { describe, it, expect } from 'vitest'
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
    expect(row.className).toContain('hover:bg-muted/50')
    expect(row.className).not.toContain('bg-row')
    expect(row.style.borderLeftColor).toBe('')
  })

  it('renders the colored left border and row background when accentColor is given', () => {
    render(
      <Table><TableBody>
        <TableRow accentColor="#dc2626"><TableCell>accented row</TableCell></TableRow>
      </TableBody></Table>
    )
    const row = screen.getByText('accented row').closest('tr')!
    expect(row.className).toContain('bg-row')
    expect(row.className).toContain('border-l-4')
    expect(row.style.borderLeftColor).toBe('rgb(220, 38, 38)')
  })
})
