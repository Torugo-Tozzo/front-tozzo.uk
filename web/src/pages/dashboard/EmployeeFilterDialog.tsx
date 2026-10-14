import { createSignal, For, Show } from "solid-js"
import { Search } from "lucide-solid"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/i18n/solid"

type Employee = { id: string; name: string }
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase()

/** Picks one employee to filter by (the schedule uses it, S5). */
export default function EmployeeFilterDialog(props: { employees: Employee[]; selectedId: string | null; onApply: (id: string | null) => void }) {
  const { t } = useTranslation("calendar")
  const { t: common } = useTranslation("common")
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [draftId, setDraftId] = createSignal<string | null>(null)
  const visible = () => props.employees.filter((employee) => normalize(employee.name).includes(normalize(query())))
  const begin = () => { setDraftId(props.selectedId); setQuery(""); setOpen(true) }
  const apply = () => { props.onApply(draftId()); setOpen(false) }

  return <>
    <Button variant="outline" aria-label={t("filterByEmployee")} onClick={begin}><Search class="mr-2 h-4 w-4" />{t("filterByEmployee")}<Show when={props.selectedId}><span class="ml-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" /></Show></Button>
    <Dialog open={open()} onOpenChange={setOpen}><DialogContent class="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{t("filterByEmployee")}</DialogTitle><DialogDescription>{t("filterEmployeesHelp")}</DialogDescription></DialogHeader>
      <Input placeholder={t("searchEmployee")} aria-label={t("searchEmployee")} value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
      <div class="max-h-64 space-y-1 overflow-y-auto">
        <Show when={visible().length} fallback={<p class="p-3 text-sm text-muted-foreground">{t("noEmployeesFound")}</p>}>
          <For each={visible()}>
            {(employee) => <label class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"><input type="radio" name="calendar-employee-filter" checked={draftId() === employee.id} onChange={() => setDraftId(employee.id)} />{employee.name}</label>}
          </For>
        </Show>
      </div>
      <DialogFooter class="gap-2"><Button variant="ghost" onClick={() => setDraftId(null)}>{t("clearFilter")}</Button><Button variant="outline" onClick={() => setOpen(false)}>{common("cancel")}</Button><Button onClick={apply}>{t("applyFilter")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>
}
