import { createSignal, onCleanup } from 'solid-js'
import { closestCenter, useDragDropContext, type CollisionDetector } from '@thisbeyond/solid-dnd'

// The `use:draggable` / `use:droppable` directives of @thisbeyond/solid-dnd
// (kitchen and deliveries boards, plan S4).
declare module 'solid-js' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface Directives {
      draggable: boolean
      droppable: boolean | { skipTransform?: boolean }
    }
  }
}

/** closestCenter over the droppables `accept` keeps (dnd-kit's filtered collision detection). */
export const closestCenterAmong = (accept: (data: Record<string, unknown>) => boolean): CollisionDetector =>
  (draggable, droppables, context) => closestCenter(draggable, droppables.filter((droppable) => accept(droppable.data)), context)

// The pointer, as dnd-kit's pointerWithin sees it. solid-dnd does not hand the
// pointer to a collision detector, so it is followed here (one pair of
// document listeners, kept for the app's lifetime).
const pointer = { x: Number.NaN, y: Number.NaN }
let following = false
const followPointer = () => {
  if (following || typeof document === 'undefined') return
  following = true
  const track = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY }
  document.addEventListener('pointerdown', track, { capture: true, passive: true })
  document.addEventListener('pointermove', track, { capture: true, passive: true })
}

/**
 * dnd-kit's pointerWithin over the droppables `accept` keeps: the target is a
 * droppable only while the pointer is inside it, otherwise there is none (a
 * drop elsewhere does nothing).
 */
export const pointerWithinAmong = (accept: (data: Record<string, unknown>) => boolean): CollisionDetector => {
  followPointer()
  return (_draggable, droppables, context) => {
    const inside = droppables.filter((droppable) => {
      if (!accept(droppable.data)) return false
      const { left, right, top, bottom } = droppable.layout
      return pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom
    })
    return inside.find((droppable) => droppable.id === context.activeDroppableId) ?? inside[0] ?? null
  }
}

/**
 * Esc and pointercancel during a pointer drag, which solid-dnd's pointer sensor
 * ignores: the drag ends where it started and `wasCancelled()` tells the
 * board's onDragEnd to send nothing. Render <DragCancel /> inside the provider.
 */
export function createDragCancel() {
  let cancelled = false

  function DragCancel() {
    const [state, { dragEnd, sensorEnd, recomputeLayouts }] = useDragDropContext()!
    // solid-dnd measures droppables only at drag start and end; a scroll mid-drag
    // would leave pointerWithin hitting where a droppable used to be.
    const onScroll = () => { if (state.active.draggable) recomputeLayouts() }
    const cancel = () => {
      if (!state.active.draggable) return
      cancelled = true
      dragEnd()
      sensorEnd()
      // The sensor still listens for the release; a release now only detaches it.
      document.dispatchEvent(new PointerEvent('pointerup'))
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !state.active.draggable) return
      event.preventDefault()
      cancel()
    }
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    onCleanup(() => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('keydown', onKeyDown)
    })
    return null
  }

  return {
    DragCancel,
    /** True once after a cancelled drag (call it first thing in onDragEnd). */
    wasCancelled: () => {
      const was = cancelled
      cancelled = false
      return was
    },
  }
}

export interface KeyboardMoveMessages<S extends string> {
  picked: () => string
  over: (stage: S) => string
  dropped: () => string
  cancelled: () => string
}

/**
 * What a drop did: `false` it was refused at once (nothing to send), a promise
 * the request (true when it went through), `undefined` a dialog took over.
 */
export type DropResult = Promise<boolean> | false | undefined

/** The element a keyboard move focuses again after the card lands (it remounts in the other column). */
const focusKey = (key: string) => {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-dnd-key=${JSON.stringify(key)}]`)?.focus())
}

/**
 * The keyboard alternative to dragging a card between the columns of a board:
 * Space or Enter picks the focused card up, the arrow keys choose the column,
 * Space or Enter drops it there, and Escape (or leaving the card) cancels.
 * Each step is announced in the board's live region; "moved" only once the
 * move went through. The focusable element carries `data-dnd-key`.
 */
export function createKeyboardMove<S extends string>(options: {
  stages: readonly S[]
  messages: KeyboardMoveMessages<S>
}) {
  const [picked, setPicked] = createSignal<{ key: string; from: S; target: S } | null>(null)
  const [announcement, setAnnouncement] = createSignal('')

  const cancel = () => {
    if (!picked()) return
    setPicked(null)
    setAnnouncement(options.messages.cancelled())
  }

  /** onKeyDown for the card `key` in column `from`; `drop` runs when it lands on another column. */
  const keyDown = (key: string, from: S, drop: (to: S) => DropResult) => (event: KeyboardEvent) => {
    const current = picked()
    const mine = current?.key === key
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!mine) {
        setPicked({ key, from, target: from })
        setAnnouncement(options.messages.picked())
        return
      }
      setPicked(null)
      if (current.target === from) {
        setAnnouncement(options.messages.cancelled())
        return
      }
      const result = drop(current.target)
      if (result === false) {
        setAnnouncement(options.messages.cancelled())
      } else if (result) {
        // A failure is said by the board's alert.
        void result.then((moved) => {
          if (!moved) return
          setAnnouncement(options.messages.dropped())
          focusKey(key)
        })
      }
      return
    }
    if (!mine) return
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = options.stages.indexOf(current.target)
    const target = options.stages[(index + step + options.stages.length) % options.stages.length]
    setPicked({ ...current, target })
    setAnnouncement(options.messages.over(target))
  }

  return {
    keyDown,
    /** Leaving the picked card cancels the move. */
    blur: (key: string) => () => { if (picked()?.key === key) cancel() },
    isPicked: (key: string) => picked()?.key === key,
    /** The column the picked card would land on (highlighted like a drag over it). */
    isTarget: (stage: S) => { const current = picked(); return !!current && current.target === stage && current.target !== current.from },
    announcement,
  }
}
