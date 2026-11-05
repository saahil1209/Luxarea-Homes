import { useEffect, useMemo, useRef, useState } from 'react'
import type { Store, User } from '../data/store'
import { SECTION_META, type Field, type HomeContent, type Section } from '../content/types'
import { renderMain } from '../content/render'
import { BRAND } from '../config'
import indexHtml from '../../index.html?raw'
import homeCss from '../home/home.css?inline'
import motionCss from '../home/motion.css?inline'
import { Check, Grip, Sortable, StringList, Text, useToast } from './ui'

// ---------- preview document ----------
const brandify = (html: string) => html.replace(/%BRAND\.(\w+)%/g, (m, k: string) => (BRAND as Record<string, string>)[k] ?? m)

const PREVIEW_SCRIPT = `
document.addEventListener('click', function (e) {
  var a = e.target.closest('a'); if (a) e.preventDefault();
  var s = e.target.closest('[data-section]');
  if (s) parent.postMessage({ luxareaPreview: 'select', id: s.getAttribute('data-section') }, '*');
});
window.addEventListener('message', function (e) {
  if (!e.data || e.data.luxareaPreview !== 'scroll') return;
  var s = document.querySelector('[data-section="' + e.data.id + '"]');
  document.querySelectorAll('.lx-sel').forEach(function (x) { x.classList.remove('lx-sel') });
  if (s) { s.classList.add('lx-sel'); s.scrollIntoView({ behavior: e.data.smooth ? 'smooth' : 'auto', block: 'start' }); }
});
document.querySelectorAll('[role=tabpanel]').forEach(function (p, i) { if (i) p.hidden = false });
`

function previewDoc(content: HomeContent) {
  let html = indexHtml
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace('<!--HOME_JSONLD-->', '')
    .replace(/<link rel="stylesheet" href="\/src\/home\/motion\.css" \/>/, '')
    .replace(/<link rel="stylesheet" href="\/src\/home\/home\.css" \/>/, `<style>${homeCss}
${motionCss}
      [data-section] { cursor: pointer; }
      [data-section]:hover { outline: 2px dashed rgba(196,154,108,.8); outline-offset: -4px; }
      .lx-sel { outline: 3px solid #c49a6c !important; outline-offset: -4px; }
      .mobile-bar { display: none !important; }
    </style>`)
    .replace(/<!--HOME_MAIN[^>]*-->/, renderMain(content))
  html = html.replace('</body>', `<script>${PREVIEW_SCRIPT}</script></body>`)
  return brandify(html)
}

// ---------- generic field editor ----------
type Obj = Record<string, unknown>

function FieldEditor({ field, value, onChange, store }: { field: Field; value: unknown; onChange: (v: unknown) => void; store: Store }) {
  const toast = useToast()
  const [open, setOpen] = useState<number>(-1)
  switch (field.kind) {
    case 'text':
      return <Text label={field.label} hint={field.hint} value={String(value ?? '')} onChange={onChange} />
    case 'textarea':
      return <Text label={field.label} hint={field.hint} value={String(value ?? '')} onChange={onChange} multiline />
    case 'boolean':
      return <Check label={field.label} hint={field.hint} value={!!value} onChange={onChange} />
    case 'strings':
      return <StringList label={field.label} hint={field.hint} items={(value as string[]) ?? []} onChange={onChange} itemLabel={field.itemLabel} />
    case 'image': {
      const url = String(value ?? '')
      return (
        <div className="f">
          <span>{field.label}</span>
          <div className="img-field">
            {url ? <img src={url} alt="" /> : <div className="ph">None</div>}
            <label className="b b-sm">
              {url ? 'Replace' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  toast('Uploading…')
                  try {
                    onChange(await store.uploadImage(f, 'site'))
                    toast('Photo added')
                  } catch {
                    toast('Could not read that image')
                  }
                }}
              />
            </label>
            {url && <button type="button" className="b b-sm b-ghost b-danger" onClick={() => onChange('')}>Remove</button>}
          </div>
          {field.hint && <small>{field.hint}</small>}
        </div>
      )
    }
    case 'list': {
      const items = (value as Obj[]) ?? []
      const titleOf = (it: Obj, i: number) => String(it.title ?? it.name ?? it.q ?? it.label ?? it.term ?? it.text ?? '').slice(0, 60) || `${field.itemLabel} ${i + 1}`
      return (
        <div className="f">
          <span>{field.label}</span>
          {field.hint && <small>{field.hint}</small>}
          <Sortable
            items={items}
            onChange={(next) => { setOpen(-1); onChange(next) }}
            className="rep"
            render={(it, i, h) => (
              <div className="rep-item">
                <div className="rep-head">
                  <Grip handle={h} label={`Move ${field.itemLabel.toLowerCase()} ${i + 1}`} />
                  <button type="button" className="rep-title" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{titleOf(it, i)}</button>
                  <button
                    type="button"
                    className="icon-b"
                    aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}
                    onClick={() => { if (confirm(`Remove "${titleOf(it, i)}"?`)) { setOpen(-1); onChange(items.filter((_, j) => j !== i)) } }}
                  >✕</button>
                </div>
                {open === i && (
                  <div className="rep-body">
                    {field.fields.map((sub) => (
                      <FieldEditor key={sub.key} field={sub} store={store} value={it[sub.key]} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))} />
                    ))}
                  </div>
                )}
              </div>
            )}
          />
          <button type="button" className="b b-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { onChange([...items, field.newItem()]); setOpen(items.length) }}>+ Add {field.itemLabel.toLowerCase()}</button>
        </div>
      )
    }
  }
}

// ---------- the editor ----------
export default function WebsiteEditor({ store, user }: { store: Store; user: User }) {
  const toast = useToast()
  const [content, setContent] = useState<HomeContent | null>(null)
  const [published, setPublished] = useState<HomeContent | null>(null)
  const [selected, setSelected] = useState<string>('hero')
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(true)
  const frame = useRef<HTMLIFrameElement>(null)
  const saveTimer = useRef<number>()

  useEffect(() => {
    store.getContent().then(({ draft, published }) => {
      setContent(structuredClone(draft))
      setPublished(published)
    })
  }, [store])

  // Clicks inside the preview select that section.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.luxareaPreview === 'select') setSelected(String(e.data.id))
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Redraw the preview when typing pauses, not on every keystroke.
  const [previewContent, setPreviewContent] = useState<HomeContent | null>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewContent(content), previewContent ? 350 : 0)
    return () => window.clearTimeout(t)
  }, [content])
  const doc = useMemo(() => (previewContent ? previewDoc(previewContent) : ''), [previewContent])
  const scrollPreview = (id: string, smooth: boolean) => frame.current?.contentWindow?.postMessage({ luxareaPreview: 'scroll', id, smooth }, '*')
  useEffect(() => {
    scrollPreview(selected, true)
  }, [selected])

  if (!content || !published) return <p className="muted">Loading…</p>

  const changed = JSON.stringify(content.sections) !== JSON.stringify(published.sections)

  const update = (next: HomeContent) => {
    setContent(next)
    setSaved(false)
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      await store.saveContentDraft({ ...next, updatedAt: new Date().toISOString(), updatedBy: user.name })
      setSaved(true)
    }, 700)
  }
  const setSection = (id: string, patch: Partial<Section>) => update({ ...content, sections: content.sections.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)) })

  const publish = async () => {
    setBusy(true)
    try {
      const r = await store.publishContent(content)
      const now = structuredClone(content)
      setPublished(now)
      setSaved(true)
      toast(r.rebuild === 'started' ? 'Published. The live site updates in about a minute.' : r.rebuild === 'local' ? 'Published (demo: visible in this browser only).' : 'Saved as published. Ask the developer to finish the auto-rebuild setup.')
    } finally {
      setBusy(false)
    }
  }
  const discard = () => {
    if (!confirm('Throw away all changes since the last publish?')) return
    update(structuredClone(published))
    toast('Changes discarded')
  }

  const sel = content.sections.find((s) => s.id === selected) ?? content.sections[0]
  const meta = SECTION_META[sel.type]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Website</h1>
          <p>Drag sections to reorder them, hide what you don't need, and click any section (here or in the preview) to edit its words and photos. Changes save automatically as a draft; the live site changes only when you publish.</p>
        </div>
        <div className="actions">
          <span className="small muted" aria-live="polite">{saved ? (changed ? 'Draft saved' : 'Up to date') : 'Saving…'}</span>
          {changed && <button type="button" className="b" onClick={discard}>Discard changes</button>}
          <a className="b" href="/" target="_blank" rel="noopener">View live ↗</a>
          <button type="button" className="b b-gold" onClick={publish} disabled={busy || !changed}>{changed ? 'Publish changes' : 'Published'}</button>
        </div>
      </div>

      <div className="editor">
        <div className="editor-side">
          <div className="card" style={{ padding: 12 }}>
            <p className="small muted" style={{ margin: '0 0 8px 4px' }}>Page sections, top to bottom</p>
            <Sortable
              items={content.sections}
              ids={content.sections.map((s) => s.id)}
              disabled={(id) => !!SECTION_META[content.sections.find((s) => s.id === id)!.type].fixed}
              onChange={(next) => update({ ...content, sections: next })}
              className="sec-list"
              render={(s, _i, h) => {
                const m = SECTION_META[s.type]
                return (
                  <div className={`sec${s.id === sel.id ? ' is-active' : ''}${s.visible ? '' : ' is-hidden'}`}>
                    <Grip handle={h} label={`Move ${m.name}`} disabled={m.fixed} />
                    <button type="button" className="sec-name" onClick={() => setSelected(s.id)} aria-pressed={s.id === sel.id}>{m.name}</button>
                    {!m.required && (
                      <button type="button" className="eye" onClick={() => setSection(s.id, { visible: !s.visible })} aria-label={s.visible ? `Hide ${m.name}` : `Show ${m.name}`}>
                        {s.visible ? 'Shown' : 'Hidden'}
                      </button>
                    )}
                  </div>
                )
              }}
            />
          </div>

          <div className="card">
            <div className="card-head"><h2 style={{ fontSize: 20 }}>{meta.name}</h2>{!sel.visible && <span className="status st-archived">Hidden</span>}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {meta.fields.map((f) => (
                <FieldEditor key={`${sel.id}-${f.key}`} field={f} store={store} value={(sel as unknown as Obj)[f.key]} onChange={(v) => setSection(sel.id, { [f.key]: v } as Partial<Section>)} />
              ))}
            </div>
          </div>
        </div>

        <div className="preview-wrap">
          <div className="preview-bar">
            <span>Preview{changed ? ' (unpublished changes)' : ''}</span>
            <div className="seg" role="group" aria-label="Preview size">
              <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</button>
              <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>Phone</button>
            </div>
          </div>
          <iframe
            ref={frame}
            title="Preview of the home page"
            className={`preview${device === 'phone' ? ' is-phone' : ''}`}
            sandbox="allow-scripts"
            srcDoc={doc}
            onLoad={() => scrollPreview(selected, false)}
          />
        </div>
      </div>
    </>
  )
}
