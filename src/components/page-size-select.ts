export interface PageSizeSelectProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  initiallyOpen?: boolean
  restoreFocus?: boolean
}

export const PAGE_SIZES = ['10', '20', '35']
export const PAGE_SIZE_TRIGGER_CLASS = 'ml-2 h-8 w-[70px] border-0 bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_hsl(var(--foreground)),inset_0_0_0_3px_hsl(var(--background))] transition-transform hover:scale-105 data-[expanded]:hover:scale-100'
