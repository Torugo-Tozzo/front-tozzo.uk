// Dev-only catalogue of the ui/ primitives (route /__ui, plan S0/S1). The
// visual suite photographs it so the Solid port of each primitive can be
// compared with the React one. Sample text reuses existing i18n keys; the
// variant names are code identifiers, not copy.
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusSelect } from '@/components/ui/status-select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrencyBRL } from '@/i18n/format'
import type { OrderItemStatus } from '@/lib/status'

const buttonVariants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
const buttonSizes = ['default', 'sm', 'lg'] as const
const alertVariants = ['default', 'warning', 'destructive'] as const
const itemStatuses: OrderItemStatus[] = ['REQUESTED', 'IN_PREPARATION', 'READY', 'DELIVERED']

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-testid={`ui-${id}`} className="space-y-3">
      <h2 className="font-mono text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Variant({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <code className="text-xs text-muted-foreground">{name}</code>
      {children}
    </div>
  )
}

export default function UiShowcasePage() {
  const { t, i18n } = useTranslation('common')
  const { t: status } = useTranslation('status')
  const money = (value: number) => formatCurrencyBRL(value, i18n.language)
  const [checked, setChecked] = useState(true)
  const [radio, setRadio] = useState('all')
  const [itemStatus, setItemStatus] = useState<OrderItemStatus>('IN_PREPARATION')

  return (
    <main className="mx-auto max-w-5xl space-y-10 bg-background p-6 text-foreground">
      <Section id="button" title="Button">
        {buttonSizes.map((size) => (
          <div key={size} className="flex flex-wrap items-end gap-4">
            {buttonVariants.map((variant) => (
              <Variant key={variant} name={`${variant} / ${size}`}>
                <Button variant={variant} size={size}>{t('save')}</Button>
              </Variant>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-4">
          {buttonVariants.map((variant) => (
            <Variant key={variant} name={`${variant} / disabled`}>
              <Button variant={variant} disabled>{t('save')}</Button>
            </Variant>
          ))}
          <Variant name="default / icon">
            <Button size="icon" aria-label={t('add')}><Plus className="h-4 w-4" /></Button>
          </Variant>
        </div>
      </Section>

      <Section id="icon-button" title="IconButton">
        <div className="flex flex-wrap items-end gap-4">
          <Variant name="ghost">
            <IconButton icon={<Pencil className="h-4 w-4" />} label={t('edit')} />
          </Variant>
          <Variant name="outline">
            <IconButton variant="outline" icon={<Plus className="h-4 w-4" />} label={t('add')} />
          </Variant>
          <Variant name="destructive">
            <IconButton variant="destructive" icon={<Trash2 className="h-4 w-4" />} label={t('delete')} />
          </Variant>
          <Variant name="disabled">
            <IconButton disabled icon={<Pencil className="h-4 w-4" />} label={t('edit')} />
          </Variant>
        </div>
      </Section>

      <Section id="alert" title="Alert">
        <div className="grid gap-3">
          {alertVariants.map((variant) => (
            <Variant key={variant} name={variant}>
              <Alert variant={variant}>
                <AlertTitle>{t('status')}</AlertTitle>
                <AlertDescription>{t('noResults')}</AlertDescription>
              </Alert>
            </Variant>
          ))}
        </div>
      </Section>

      <Section id="card" title="Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('filters')}</CardTitle>
            <CardDescription>{t('noResults')}</CardDescription>
          </CardHeader>
          <CardContent>{t('loading')}</CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline">{t('clear')}</Button>
            <Button>{t('apply')}</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section id="input" title="Input / Label">
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ui-input-empty">{t('customer')}</Label>
            <Input id="ui-input-empty" placeholder={t('placeholders.customer')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ui-input-filled">{t('name')}</Label>
            <Input id="ui-input-filled" defaultValue={t('appName')} />
          </div>
          <div className="grid gap-2">
            <Input id="ui-input-disabled" className="peer" disabled defaultValue={t('appName')} />
            <Label htmlFor="ui-input-disabled">{t('status')}</Label>
          </div>
        </div>
      </Section>

      <Section id="select" title="Select / StatusSelect">
        <div className="flex flex-wrap items-end gap-4">
          <Variant name="Select">
            <Select defaultValue="all">
              <SelectTrigger data-testid="ui-select-trigger" aria-label={t('status')} className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="active">{status('active')}</SelectItem>
                <SelectItem value="inactive">{status('inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </Variant>
          <Variant name="Select / disabled">
            <Select defaultValue="all" disabled>
              <SelectTrigger aria-label={t('status')} className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
              </SelectContent>
            </Select>
          </Variant>
          {itemStatuses.map((value) => (
            <Variant key={value} name={`StatusSelect / ${value}`}>
              <StatusSelect value={value} onValueChange={() => {}} ariaLabel={t('status')} />
            </Variant>
          ))}
          <Variant name="StatusSelect / interactive">
            <StatusSelect value={itemStatus} onValueChange={setItemStatus} ariaLabel={t('status')} />
          </Variant>
          <Variant name="StatusSelect / disabled">
            <StatusSelect value="READY" onValueChange={() => {}} disabled ariaLabel={t('status')} />
          </Variant>
        </div>
      </Section>

      <Section id="tabs" title="Tabs">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">{t('all')}</TabsTrigger>
            <TabsTrigger value="active">{status('active')}</TabsTrigger>
            <TabsTrigger value="inactive" disabled>{status('inactive')}</TabsTrigger>
          </TabsList>
          <TabsContent value="all">{t('noResults')}</TabsContent>
          <TabsContent value="active">{status('active')}</TabsContent>
        </Tabs>
      </Section>

      <Section id="table" title="Table">
        <Table>
          <TableCaption>{t('noResults')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead className="text-right">{t('price')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{t('appName')}</TableCell>
              <TableCell>{status('active')}</TableCell>
              <TableCell className="text-right">{money(10)}</TableCell>
            </TableRow>
            <TableRow accentColor="#22c55e">
              <TableCell>{t('appName')}</TableCell>
              <TableCell>{status('active')}</TableCell>
              <TableCell className="text-right">{money(20)}</TableCell>
            </TableRow>
            <TableRow data-state="selected">
              <TableCell>{t('appName')}</TableCell>
              <TableCell>{status('inactive')}</TableCell>
              <TableCell className="text-right">{money(30)}</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>{t('total')}</TableCell>
              <TableCell className="text-right">{money(60)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Section>

      <Section id="skeleton" title="Skeleton">
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Section>

      <Section id="overlays" title="Dialog / DropdownMenu">
        <div className="flex flex-wrap gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="ui-dialog-trigger" variant="outline">{t('edit')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('filters')}</DialogTitle>
                <DialogDescription>{t('noResults')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="ui-dialog-input">{t('customer')}</Label>
                <Input id="ui-dialog-input" placeholder={t('placeholders.customer')} />
              </div>
              <DialogFooter>
                <Button variant="outline">{t('cancel')}</Button>
                <Button>{t('confirm')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="ui-dropdown-trigger" variant="outline">{t('accessibility.openMenu')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{t('filters')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                {t('edit')}
                <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>{t('delete')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
                {status('active')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={radio} onValueChange={setRadio}>
                <DropdownMenuRadioItem value="all">{t('all')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="inactive">{status('inactive')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Section>
    </main>
  )
}
