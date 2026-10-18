import { splitProps, type JSX } from "solid-js"

import { cn } from "@/lib/utils"

function Table(props: JSX.HTMLAttributes<HTMLTableElement>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <div class="relative w-full overflow-auto">
      <table class={cn("w-full caption-bottom text-sm border border-foreground", local.class)} {...others} />
    </div>
  )
}

function TableHeader(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <thead class={cn("[&_tr]:border-b bg-foreground text-primary-foreground [&_tr]:hover:bg-transparent", local.class)} {...others} />
}

function TableBody(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <tbody class={local.class} {...others} />
}

function TableFooter(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <tfoot
      class={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        local.class
      )}
      {...others}
    />
  )
}

export interface TableRowProps extends JSX.HTMLAttributes<HTMLTableRowElement> {
  accentColor?: string
}

function TableRow(props: TableRowProps) {
  const [local, others] = splitProps(props, ["class", "accentColor", "style"])
  return (
    <tr
      // Status indicator as an inset box-shadow, not border-l: a real 4px
      // border merges with the table's outer border through border-collapse.
      style={local.accentColor
        ? { "box-shadow": `inset 4px 0 0 0 ${local.accentColor}`, ...(local.style as JSX.CSSProperties | undefined) }
        : local.style}
      class={cn(
        "transition-all duration-150 data-[state=selected]:bg-muted hover:bg-black/10 dark:hover:bg-white/10",
        local.accentColor
          // Dashed top/bottom (row divider); the left edge (the shadow) stays solid.
          ? "border-t border-b border-foreground [border-top-style:dashed] [border-bottom-style:dashed] relative"
          : "border-b border-dashed last:border-b-0",
        local.class
      )}
      {...others}
    />
  )
}

function TableHead(props: JSX.ThHTMLAttributes<HTMLTableCellElement>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <th
      class={cn(
        "h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
        local.class
      )}
      {...others}
    />
  )
}

function TableCell(props: JSX.TdHTMLAttributes<HTMLTableCellElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <td class={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", local.class)} {...others} />
}

function TableCaption(props: JSX.HTMLAttributes<HTMLTableCaptionElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <caption class={cn("mt-4 text-sm text-muted-foreground", local.class)} {...others} />
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
