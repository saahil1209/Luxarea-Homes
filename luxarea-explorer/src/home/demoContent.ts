// Demo mode: swap in home-page content published from /admin in this browser.
import { readLocalPublished } from '../data/localStore'
import { renderMain } from '../content/render'
import { BRAND } from '../config'

export async function applyDemoContent() {
  const content = await readLocalPublished()
  const main = document.getElementById('main')
  if (!content || !main) return
  if (main.dataset.updated && content.updatedAt <= main.dataset.updated) return
  main.innerHTML = renderMain(content).replace(/%BRAND\.(\w+)%/g, (m, k: string) => (BRAND as Record<string, string>)[k] ?? m)
  main.dataset.updated = content.updatedAt
}
