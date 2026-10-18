import { describe, it, expect } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import { Table, TableBody, TableRow, TableCell } from './table'

describe('TableRow', () => {
  it('renders with default hover styling when no accentColor is given', () => {
    render(() => (
      <Table><TableBody>
        <TableRow><TableCell>plain row</TableCell></TableRow>
      </TableBody></Table>
    ))
    const row = screen.getByText('plain row').closest('tr')!
    expect(row.className).toContain('hover:bg-black/10')
    expect(row.className).toContain('dark:hover:bg-white/10')
    expect(row.className).not.toContain('bg-row')
    expect(row.style.boxShadow).toBe('')
  })

  it('renders a bordered row (no gray fill) with a colored left edge when accentColor is given', () => {
    render(() => (
      <Table><TableBody>
        <TableRow accentColor="#dc2626"><TableCell>accented row</TableCell></TableRow>
      </TableBody></Table>
    ))
    const row = screen.getByText('accented row').closest('tr')!
    expect(row.className).not.toContain('bg-row')
    expect(row.className).toContain('border-foreground')
    // Status indicator as an inset box-shadow (not border-l), always inside the row.
    expect(row.style.boxShadow).toBe('inset 4px 0 0 0 #dc2626')
    // Dashed top/bottom divider: only data rows have an accentColor.
    expect(row.className).toContain('[border-top-style:dashed]')
    expect(row.className).toContain('[border-bottom-style:dashed]')
  })
})
