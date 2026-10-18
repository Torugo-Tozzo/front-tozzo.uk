// Dev-only catalogue of the ui/ primitives (route /__ui, plan S1). The visual
// suite compares it with the React /__ui (scenarios ui, ui-select-open,
// ui-dialog, ui-dropdown-open). Sample text reuses existing i18n keys; the
// variant names are code identifiers, not copy.
import { createSignal, For, type JSX } from 'solid-js'
import { Pencil, Plus, Trash2 } from 'lucide-solid'

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
import { useTranslation } from '@/i18n/solid'
import type { OrderItemStatus } from '@/lib/status'

const buttonVariants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
const buttonSizes = ['default', 'sm', 'lg'] as const
const alertVariants = ['default', 'warning', 'destructive'] as const
const itemStatuses: OrderItemStatus[] = ['REQUESTED', 'IN_PREPARATION', 'READY', 'DELIVERED']

function Section(props: { id: string; title: string; children: JSX.Element }) {
  return (
    <section data-testid={`ui-${props.id}`} class="space-y-3">
      <h2 class="font-mono text-sm font-semibold">{props.title}</h2>
      {props.children}
    </section>
  )
}

function Variant(props: { name: string; children: JSX.Element }) {
  return (
    <div class="flex flex-col items-start gap-1">
      <code class="text-xs text-muted-foreground">{props.name}</code>
      {props.children}
    </div>
  )
}

export default function UiShowcasePage() {
  const { t, language } = useTranslation('common')
  const { t: status } = useTranslation('status')
  const money = (value: number) => formatCurrencyBRL(value, language())
  const [checked, setChecked] = createSignal(true)
  const [radio, setRadio] = createSignal('all')
  const [itemStatus, setItemStatus] = createSignal<OrderItemStatus>('IN_PREPARATION')
  const filterLabel = (value: string) => (value === 'all' ? t('all') : status(value as 'active' | 'inactive'))

  return (
    <main class="mx-auto max-w-5xl space-y-10 bg-background p-6 text-foreground">
      <Section id="button" title="Button">
        <For each={buttonSizes}>
          {(size) => (
            <div class="flex flex-wrap items-end gap-4">
              <For each={buttonVariants}>
                {(variant) => (
                  <Variant name={`${variant} / ${size}`}>
                    <Button variant={variant} size={size}>{t('save')}</Button>
                  </Variant>
                )}
              </For>
            </div>
          )}
        </For>
        <div class="flex flex-wrap items-end gap-4">
          <For each={buttonVariants}>
            {(variant) => (
              <Variant name={`${variant} / disabled`}>
                <Button variant={variant} disabled>{t('save')}</Button>
              </Variant>
            )}
          </For>
          <Variant name="default / icon">
            <Button size="icon" aria-label={t('add')}><Plus class="h-4 w-4" /></Button>
          </Variant>
        </div>
      </Section>

      <Section id="icon-button" title="IconButton">
        <div class="flex flex-wrap items-end gap-4">
          <Variant name="ghost">
            <IconButton icon={<Pencil class="h-4 w-4" />} label={t('edit')} />
          </Variant>
          <Variant name="outline">
            <IconButton variant="outline" icon={<Plus class="h-4 w-4" />} label={t('add')} />
          </Variant>
          <Variant name="destructive">
            <IconButton variant="destructive" icon={<Trash2 class="h-4 w-4" />} label={t('delete')} />
          </Variant>
          <Variant name="disabled">
            <IconButton disabled icon={<Pencil class="h-4 w-4" />} label={t('edit')} />
          </Variant>
        </div>
      </Section>

      <Section id="alert" title="Alert">
        <div class="grid gap-3">
          <For each={alertVariants}>
            {(variant) => (
              <Variant name={variant}>
                <Alert variant={variant}>
                  <AlertTitle>{t('status')}</AlertTitle>
                  <AlertDescription>{t('noResults')}</AlertDescription>
                </Alert>
              </Variant>
            )}
          </For>
        </div>
      </Section>

      <Section id="card" title="Card">
        <Card class="max-w-md">
          <CardHeader>
            <CardTitle>{t('filters')}</CardTitle>
            <CardDescription>{t('noResults')}</CardDescription>
          </CardHeader>
          <CardContent>{t('loading')}</CardContent>
          <CardFooter class="gap-2">
            <Button variant="outline">{t('clear')}</Button>
            <Button>{t('apply')}</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section id="input" title="Input / Label">
        <div class="grid max-w-md gap-4">
          <div class="grid gap-2">
            <Label for="ui-input-empty">{t('customer')}</Label>
            <Input id="ui-input-empty" placeholder={t('placeholders.customer')} />
          </div>
          <div class="grid gap-2">
            <Label for="ui-input-filled">{t('name')}</Label>
            <Input id="ui-input-filled" value={t('appName')} />
          </div>
          <div class="grid gap-2">
            <Input id="ui-input-disabled" class="peer" disabled value={t('appName')} />
            <Label for="ui-input-disabled">{t('status')}</Label>
          </div>
        </div>
      </Section>

      <Section id="select" title="Select / StatusSelect">
        <div class="flex flex-wrap items-end gap-4">
          <Variant name="Select">
            <Select<string>
              options={['all', 'active', 'inactive']}
              defaultValue="all"
              itemComponent={(item) => <SelectItem item={item.item}>{filterLabel(item.item.rawValue)}</SelectItem>}
            >
              <SelectTrigger data-testid="ui-select-trigger" aria-label={t('status')} class="w-[180px]">
                <SelectValue<string>>{(state) => filterLabel(state.selectedOption())}</SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </Variant>
          <Variant name="Select / disabled">
            <Select<string>
              options={['all']}
              defaultValue="all"
              disabled
              itemComponent={(item) => <SelectItem item={item.item}>{filterLabel(item.item.rawValue)}</SelectItem>}
            >
              <SelectTrigger aria-label={t('status')} class="w-[180px]">
                <SelectValue<string>>{(state) => filterLabel(state.selectedOption())}</SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </Variant>
          <For each={itemStatuses}>
            {(value) => (
              <Variant name={`StatusSelect / ${value}`}>
                <StatusSelect value={value} onValueChange={() => {}} ariaLabel={t('status')} />
              </Variant>
            )}
          </For>
          <Variant name="StatusSelect / interactive">
            <StatusSelect value={itemStatus()} onValueChange={setItemStatus} ariaLabel={t('status')} />
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
              <TableHead class="text-right">{t('price')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{t('appName')}</TableCell>
              <TableCell>{status('active')}</TableCell>
              <TableCell class="text-right">{money(10)}</TableCell>
            </TableRow>
            <TableRow accentColor="#22c55e">
              <TableCell>{t('appName')}</TableCell>
              <TableCell>{status('active')}</TableCell>
              <TableCell class="text-right">{money(20)}</TableCell>
            </TableRow>
            <TableRow data-state="selected">
              <TableCell>{t('appName')}</TableCell>
              <TableCell>{status('inactive')}</TableCell>
              <TableCell class="text-right">{money(30)}</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>{t('total')}</TableCell>
              <TableCell class="text-right">{money(60)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Section>

      <Section id="skeleton" title="Skeleton">
        <div class="space-y-2">
          <Skeleton class="h-4 w-64" />
          <Skeleton class="h-4 w-48" />
          <Skeleton class="h-10 w-full" />
        </div>
      </Section>

      <Section id="overlays" title="Dialog / DropdownMenu">
        <div class="flex flex-wrap gap-4">
          <Dialog>
            <DialogTrigger as={Button} data-testid="ui-dialog-trigger" variant="outline">{t('edit')}</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('filters')}</DialogTitle>
                <DialogDescription>{t('noResults')}</DialogDescription>
              </DialogHeader>
              <div class="grid gap-2">
                <Label for="ui-dialog-input">{t('customer')}</Label>
                <Input id="ui-dialog-input" placeholder={t('placeholders.customer')} />
              </div>
              <DialogFooter>
                <Button variant="outline">{t('cancel')}</Button>
                <Button>{t('confirm')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu placement="bottom-start">
            <DropdownMenuTrigger as={Button} data-testid="ui-dropdown-trigger" variant="outline">{t('accessibility.openMenu')}</DropdownMenuTrigger>
            <DropdownMenuContent class="w-56">
              <DropdownMenuLabel>{t('filters')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                {t('edit')}
                <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>{t('delete')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={checked()} onChange={setChecked}>
                {status('active')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={radio()} onChange={setRadio}>
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
