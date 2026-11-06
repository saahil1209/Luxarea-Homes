import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>()
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}

// ---------- fields ----------
interface Base { label: string; hint?: string; required?: boolean }

export function Text({ label, hint, required, value, onChange, multiline, type = 'text', placeholder }: Base & { value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; placeholder?: string }) {
  const id = useId()
  const hid = hint ? `${id}-hint` : undefined
  return (
    <div className="f">
      <label htmlFor={id}><span>{label}{required && <span className="req"> *</span>}</span></label>
      {multiline
        ? <textarea id={id} value={value ?? ''} placeholder={placeholder} aria-describedby={hid} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} type={type} value={value ?? ''} placeholder={placeholder} aria-describedby={hid} onChange={(e) => onChange(e.target.value)} />}
      {hint && <small id={hid}>{hint}</small>}
    </div>
  )
}

export function Num({ label, hint, required, value, onChange, step = 1, placeholder }: Base & { value: number | null | undefined; onChange: (v: number | null) => void; step?: number; placeholder?: string }) {
  const id = useId()
  const hid = hint ? `${id}-hint` : undefined
  return (
    <div className="f">
      <label htmlFor={id}><span>{label}{required && <span className="req"> *</span>}</span></label>
      <input id={id} type="number" inputMode="decimal" step={step} value={value ?? ''} placeholder={placeholder} aria-describedby={hid} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      {hint && <small id={hid}>{hint}</small>}
    </div>
  )
}

export function Sel<T extends string>({ label, hint, value, onChange, options }: Base & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = useId()
  const hid = hint ? `${id}-hint` : undefined
  return (
    <div className="f">
      <label htmlFor={id}><span>{label}</span></label>
      <select id={id} value={value} aria-describedby={hid} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <small id={hid}>{hint}</small>}
    </div>
  )
}

export function Check({ label, hint, value, onChange }: Base & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="f f-check">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </label>
  )
}

// ---------- drag and drop ----------
export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

export interface HandleProps { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined; setActivatorNodeRef: (el: HTMLElement | null) => void }

function SortableRow({ id, children, className }: { id: string; className?: string; children: (h: HandleProps, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, position: 'relative' as const, zIndex: isDragging ? 5 : undefined }
  return (
    <div ref={setNodeRef} style={style} className={`${className ?? ''}${isDragging ? ' dragging' : ''}`}>
      {children({ attributes: attributes as unknown as Record<string, unknown>, listeners, setActivatorNodeRef }, isDragging)}
    </div>
  )
}

/** A list the team can reorder by dragging (mouse, touch, or keyboard: focus the handle, Space, arrows, Space). */
export function Sortable<T>({ items, onChange, render, ids, grid, className, disabled }: {
  items: T[]
  onChange: (next: T[]) => void
  render: (item: T, index: number, handle: HandleProps, dragging: boolean) => ReactNode
  ids?: string[]
  grid?: boolean
  className?: string
  /** Ids that cannot be moved. */
  disabled?: (id: string) => boolean
}) {
  const sensors = useDndSensors()
  const keys = ids ?? items.map((_, i) => `i${i}`)
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = keys.indexOf(String(e.active.id))
    const to = keys.indexOf(String(e.over.id))
    if (from < 0 || to < 0) return
    if (disabled && (disabled(keys[from]) || disabled(keys[to]))) return
    onChange(arrayMove(items, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={keys} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((it, i) => (
            <SortableRow key={keys[i]} id={keys[i]}>
              {(h, dragging) => render(it, i, h, dragging)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export function Grip({ handle, label, disabled }: { handle: HandleProps; label: string; disabled?: boolean }) {
  return (
    <button type="button" className="grip" ref={handle.setActivatorNodeRef} {...(disabled ? {} : handle.attributes)} {...(disabled ? {} : handle.listeners)} aria-label={label} disabled={disabled} title={disabled ? 'This one stays in place' : 'Drag to reorder'}>
      ⠿
    </button>
  )
}

/** Editable list of short texts, reorderable. */
export function StringList({ label, hint, items, onChange, itemLabel }: Base & { items: string[]; onChange: (v: string[]) => void; itemLabel: string }) {
  return (
    <div className="f">
      <span>{label}</span>
      <Sortable
        items={items}
        onChange={onChange}
        className="rep"
        render={(v, i, h) => (
          <div className="str-row">
            <Grip handle={h} label={`Move ${itemLabel.toLowerCase()} ${i + 1}`} />
            <input aria-label={`${itemLabel} ${i + 1}`} value={v} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} style={{ padding: '8px 10px', border: '1px solid var(--rule)', borderRadius: 8, background: '#fff' }} />
            <button type="button" className="icon-b" aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        )}
      />
      <button type="button" className="b b-sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, ''])}>+ Add {itemLabel.toLowerCase()}</button>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
