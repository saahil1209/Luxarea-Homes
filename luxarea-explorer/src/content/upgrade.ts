// Saved home-page content predates sections added later in the code (e.g.
// "Developers we work with"). This adds any missing section types from the
// defaults, at their default position, without touching the team's edits.
import type { HomeContent } from './types'

export function withNewSections(saved: HomeContent, defaults: HomeContent): HomeContent {
  const have = new Set(saved.sections.map((s) => s.type))
  const missing = defaults.sections.filter((s) => !have.has(s.type))
  if (!missing.length) return saved
  const sections = [...saved.sections]
  for (const m of missing) {
    // Insert after the section that precedes it in the defaults, if present.
    const di = defaults.sections.findIndex((s) => s.type === m.type)
    const prevType = di > 0 ? defaults.sections[di - 1].type : null
    const at = prevType ? sections.findIndex((s) => s.type === prevType) + 1 : 0
    sections.splice(at > 0 ? at : sections.length - 1, 0, structuredClone(m))
  }
  return { ...saved, sections }
}
