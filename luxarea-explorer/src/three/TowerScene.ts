import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { FloorInfo, Property } from '../data/listings'
import { FLOOR_PLANS, roomSizeLabel, type RoomKind } from '../data/floorplans'

export interface TowerOptions {
  /** Wheel/pinch zoom. Off on scrolling pages so the page keeps scrolling. */
  zoom?: boolean
  /** Drag to orbit. Off on touch screens in the hero so swipes scroll the page. */
  rotate?: boolean
}

export interface TowerCallbacks {
  onHover: (floor: number | null) => void
  onSelect: (floor: number) => void
}

const GOLD = new THREE.Color('#C49A6C')
const WARM = new THREE.Color('#ffc98a')
const ROOM_COLORS: Record<RoomKind, string> = {
  living: '#c8a679',
  bed: '#dccdb0',
  wet: '#b7c1c2',
  kitchen: '#cfc4b2',
  outdoor: '#5f7d6a',
  service: '#a8a191',
  circulation: '#e9e2d0',
}

interface FloorMesh {
  floor: number
  group: THREE.Group
  glass: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>
  slab: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>
  baseY: number
  targetY: number
  baseLit: number
  info: FloorInfo | null
}

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  r = Math.min(r, w / 2, d / 2)
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + d - r)
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  s.lineTo(x + r, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function extrudeUp(shape: THREE.Shape, height: number): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 12 })
  g.rotateX(-Math.PI / 2)
  return g
}

export class TowerScene {
  private renderer: THREE.WebGLRenderer
  private labelRenderer: CSS2DRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private floors: FloorMesh[] = []
  private floorH: number
  private towerTop = 0
  private hovered: number | null = null
  private selected: number | null = null
  private highlightedType: string | null = null
  private planGroup: THREE.Group | null = null
  private camGoal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null
  private raf = 0
  private clock = new THREE.Clock()
  private resizeObs: ResizeObserver
  private downAt: { x: number; y: number } | null = null
  private pointerInside = false
  private disposed = false
  private insets = { left: 0, right: 0, bottom: 0 }

  constructor(
    private container: HTMLElement,
    private tooltip: HTMLElement,
    private property: Property,
    floorInfo: FloorInfo[],
    private cb: TowerCallbacks,
    opts: TowerOptions = {},
  ) {
    const isVilla = property.form === 'villa'
    this.floorH = isVilla ? 1.1 : 0.42

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.domElement.className = 'plan-labels'
    container.appendChild(this.labelRenderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.35
    pmrem.dispose()
    this.scene.fog = new THREE.Fog('#1b2a29', 55, 150)

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.enableZoom = opts.zoom ?? true
    this.controls.enableRotate = opts.rotate ?? true
    if (opts.rotate === false) this.renderer.domElement.style.touchAction = 'pan-y'
    this.controls.minPolarAngle = 0.25
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04
    this.controls.autoRotateSpeed = 0.35
    this.controls.addEventListener('start', () => {
      this.camGoal = null
      this.controls.autoRotate = false
    })

    this.buildLights()
    this.buildGround(isVilla)
    this.buildTower(floorInfo, isVilla)
    this.frameTower(true)

    const el = this.renderer.domElement
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('pointerleave', this.onPointerLeave)
    el.addEventListener('pointerenter', () => (this.pointerInside = true))

    if (import.meta.env.DEV) (window as unknown as { __tower: TowerScene }).__tower = this
    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    this.resize()
    this.loop()
  }

  // ---------- build ----------

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#9fb6dd', '#1b1510', 0.9))
    const sun = new THREE.DirectionalLight('#ffb98a', 1.6)
    sun.position.set(-30, 25, 20) // low western sunset light, from the sea side
    this.scene.add(sun)
    const fill = new THREE.DirectionalLight('#8aa4d6', 0.5)
    fill.position.set(25, 30, -20)
    this.scene.add(fill)
  }

  private buildGround(isVilla: boolean) {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(140, 64),
      new THREE.MeshStandardMaterial({ color: isVilla ? '#1d2a22' : '#0f171c', metalness: isVilla ? 0 : 0.7, roughness: isVilla ? 0.95 : 0.4 }),
    )
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)

    if (isVilla) {
      const pool = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.06, 2.2),
        new THREE.MeshStandardMaterial({ color: '#3d8fa3', emissive: '#1b6f86', emissiveIntensity: 0.35, roughness: 0.1 }),
      )
      pool.position.set(0, 0.03, 4.8)
      this.scene.add(pool)
      const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.04, 4.2), new THREE.MeshStandardMaterial({ color: '#8a6f52', roughness: 0.8 }))
      deck.position.set(0, 0.02, 4.6)
      this.scene.add(deck)
      return
    }

    // Quiet city context: low, dark neighbours kept out of the camera's line of sight.
    const rand = mulberry(this.property.id.length * 9973)
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: '#131a21', roughness: 0.9, metalness: 0.1, emissive: '#3a2c18', emissiveIntensity: 0.18 })
    const count = 90
    const city = new THREE.InstancedMesh(geo, mat, count)
    const m = new THREE.Matrix4()
    const camAz = Math.atan2(1, 0.62)
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const r = 13 + rand() * 60
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const dAz = Math.abs(Math.atan2(Math.sin(a - camAz), Math.cos(a - camAz)))
      const seaSide = x < -8 && Math.abs(z) < 40
      if (seaSide || (dAz < 0.9 && r < 45)) {
        m.makeScale(0.0001, 0.0001, 0.0001)
      } else {
        const h = 1 + rand() * (r < 30 ? 5 : 11)
        const w = 1.8 + rand() * 3.5
        const d = 1.8 + rand() * 3.5
        m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d))
      }
      city.setMatrixAt(i, m)
    }
    this.scene.add(city)
  }

  private buildTower(floorInfo: FloorInfo[], isVilla: boolean) {
    const [W, D] = this.property.footprint
    const radius = isVilla ? 0.3 : Math.min(W, D) * 0.32
    const h = this.floorH
    const infoByFloor = new Map(floorInfo.map((f) => [f.floor, f]))
    const glassShape = roundedRect(W, D, radius)
    const slabShape = roundedRect(W * (isVilla ? 1.18 : 1.05), D * (isVilla ? 1.22 : 1.08), radius * 1.05)
    const slabH = h * (isVilla ? 0.12 : 0.1)
    const glassGeo = extrudeUp(glassShape, h - slabH)
    const slabGeo = extrudeUp(slabShape, slabH)
    const rand = mulberry(this.property.id.length * 31337)

    // Lobby / podium
    const lobbyH = isVilla ? 0.25 : h * 2.4
    const lobby = new THREE.Mesh(
      extrudeUp(roundedRect(W * 1.12, D * 1.15, radius), lobbyH),
      new THREE.MeshStandardMaterial({ color: isVilla ? '#cfc7b5' : '#2b2a26', emissive: WARM, emissiveIntensity: isVilla ? 0 : 0.35, roughness: 0.5 }),
    )
    this.scene.add(lobby)

    let y = lobbyH
    for (let f = 1; f <= this.property.totalFloors; f++) {
      const info = infoByFloor.get(f) ?? null
      const group = new THREE.Group()
      const roll = rand()
      const lit = !info ? 0.02 : info.status === 'sold' ? (roll < 0.6 ? 0.25 + roll * 0.5 : 0.03) : roll < 0.3 ? 0.18 + roll : 0.03
      const glass = new THREE.Mesh(
        glassGeo,
        new THREE.MeshStandardMaterial({
          color: info ? '#18232d' : '#141c23',
          metalness: 0.65,
          roughness: 0.1,
          emissive: WARM.clone(),
          emissiveIntensity: lit,
          transparent: true,
          opacity: 0.94,
        }),
      )
      glass.position.y = slabH
      const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: '#cbc3ad', roughness: 0.6, emissive: GOLD.clone(), emissiveIntensity: 0, transparent: true, opacity: 1 }))
      group.add(slab, glass)
      group.position.y = y
      glass.userData.floor = f
      slab.userData.floor = f
      this.scene.add(group)
      this.floors.push({ floor: f, group, glass, slab, baseY: y, targetY: y, baseLit: lit, info })
      y += h
    }

    // Crown
    const crownShape = roundedRect(W * 1.06, D * 1.1, radius)
    crownShape.holes.push(roundedRect(W * 0.94, D * 0.96, radius * 0.9) as unknown as THREE.Path)
    const crown = new THREE.Mesh(
      extrudeUp(crownShape, isVilla ? 0.12 : h * 1.6),
      new THREE.MeshStandardMaterial({ color: '#e6c79e', emissive: '#e8b97f', emissiveIntensity: isVilla ? 0.1 : 0.9, roughness: 0.4 }),
    )
    crown.position.y = y
    this.scene.add(crown)
    this.towerTop = y + (isVilla ? 0.12 : h * 1.6)
    this.crown = crown
  }

  private crown: THREE.Mesh | null = null

  // ---------- camera ----------

  /** Aspect of the free area beside/above the UI panels. */
  private freeAspect() {
    const w = Math.max(1, this.container.clientWidth - this.insets.left - this.insets.right)
    const h = Math.max(1, this.container.clientHeight - this.insets.bottom)
    return w / h
  }

  private freeHeightRatio() {
    const h = this.container.clientHeight || 1
    return Math.max(0.35, (h - this.insets.bottom) / h)
  }

  private overviewGoal() {
    const H = this.towerTop
    const [W] = this.property.footprint
    const aspect = this.freeAspect()
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const fitH = (H * 0.6) / (Math.tan(vfov / 2) * this.freeHeightRatio())
    const fitW = (Math.max(W * 2.2, 8) * 0.5) / (Math.tan(vfov / 2) * aspect)
    const dist = Math.max(fitH, fitW, 14) * 1.08
    const target = new THREE.Vector3(0, H * 0.48, 0)
    const dir = new THREE.Vector3(0.62, 0.22, 1).normalize()
    return { pos: target.clone().add(dir.multiplyScalar(dist)), target }
  }

  private floorGoal(fm: FloorMesh) {
    const [W, D] = this.property.footprint
    const aspect = this.freeAspect()
    // Fit the plate (plus a margin for labels) into the free area, so the plan reads at a glance.
    const half = Math.max(W, D) * 0.74
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const t = Math.tan(vfov / 2)
    const dist = Math.max(half / (t * this.freeHeightRatio()), half / (t * aspect), 6.5)
    const target = new THREE.Vector3(0, fm.baseY + this.floorH * 0.3, 0)
    const dir = new THREE.Vector3(0.45, 0.95, 0.75).normalize()
    return { pos: target.clone().add(dir.multiplyScalar(dist)), target }
  }

  private frameTower(instant = false) {
    const goal = this.overviewGoal()
    if (instant) {
      this.camera.position.copy(goal.pos)
      this.controls.target.copy(goal.target)
      this.controls.update()
    } else {
      this.camGoal = goal
    }
    this.controls.minDistance = 6
    this.controls.maxDistance = goal.pos.distanceTo(goal.target) * 1.8
  }

  // ---------- public ----------

  select(floor: number | null) {
    if (floor === this.selected) return
    this.selected = floor
    this.clearPlan()
    const lift = this.property.form === 'villa' ? 3.2 : Math.max(6, this.property.footprint[0] * 1.4)
    for (const fm of this.floors) {
      fm.targetY = floor != null && fm.floor > floor ? fm.baseY + lift : fm.baseY
    }
    if (this.crown) this.crown.userData.lift = floor != null ? lift : 0
    if (floor == null) {
      this.frameTower()
      this.controls.autoRotate = false
    } else {
      const fm = this.floors.find((f) => f.floor === floor)
      if (fm?.info) {
        this.buildPlan(fm)
        this.camGoal = this.floorGoal(fm)
        this.controls.autoRotate = false
      }
    }
    this.applyMaterials()
  }

  /** Pixels covered by UI panels, so the model centres in the space that's left. */
  setInsets(left: number, right: number, bottom: number) {
    const i = this.insets
    if (i.left === left && i.right === right && i.bottom === bottom) return
    this.insets = { left, right, bottom }
    this.applyViewOffset()
    if (this.selected == null) this.frameTower()
    else {
      const fm = this.floors.find((f) => f.floor === this.selected)
      if (fm) this.camGoal = this.floorGoal(fm)
    }
  }

  private applyViewOffset() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    const x = (this.insets.right - this.insets.left) / 2
    const y = this.insets.bottom / 2
    if (x || y) this.camera.setViewOffset(w, h, x, y, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }

  /** Hover from outside the canvas (the floor strip). */
  hover(floor: number | null) {
    if (this.selected != null) return
    this.setHover(floor)
  }

  highlightType(typeId: string | null) {
    this.highlightedType = typeId
    this.applyMaterials()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointerup', this.onPointerUp)
    el.removeEventListener('pointerleave', this.onPointerLeave)
    this.controls.dispose()
    this.clearPlan()
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.scene.environment?.dispose()
    this.renderer.dispose()
    el.remove()
    this.labelRenderer.domElement.remove()
  }

  // ---------- plan ----------

  private buildPlan(fm: FloorMesh) {
    const info = fm.info!
    const plan = FLOOR_PLANS[info.residence.planId]
    if (!plan) return
    const [W, D] = this.property.footprint
    const isVilla = this.property.form === 'villa'
    const pw = W * (isVilla ? 0.98 : 0.84)
    const pd = D * (isVilla ? 0.98 : 0.8)
    const wallH = this.floorH * 0.5
    const wallT = Math.max(W, D) * 0.012
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: '#f4efe2', roughness: 0.8 })
    const slabTop = this.floorH * (isVilla ? 0.12 : 0.1)

    const seen = new Set<string>()
    const addWall = (x1: number, z1: number, x2: number, z2: number) => {
      const key = [x1, z1, x2, z2].map((v) => v.toFixed(3)).join(',')
      if (seen.has(key)) return
      seen.add(key)
      const len = Math.hypot(x2 - x1, z2 - z1)
      const geo = new THREE.BoxGeometry(x1 === x2 ? wallT : len + wallT, wallH, z1 === z2 ? wallT : len + wallT)
      const wall = new THREE.Mesh(geo, wallMat)
      wall.position.set((x1 + x2) / 2, slabTop + wallH / 2, (z1 + z2) / 2)
      group.add(wall)
    }

    for (const room of plan.rooms) {
      const x0 = -pw / 2 + room.x * pw
      const z0 = -pd / 2 + room.y * pd
      const rw = room.w * pw
      const rd = room.h * pd
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(rw - wallT, 0.02, rd - wallT),
        new THREE.MeshStandardMaterial({ color: ROOM_COLORS[room.kind], roughness: 0.75 }),
      )
      tile.position.set(x0 + rw / 2, slabTop + 0.01, z0 + rd / 2)
      group.add(tile)
      if (room.kind !== 'outdoor') {
        addWall(x0, z0, x0 + rw, z0)
        addWall(x0, z0 + rd, x0 + rw, z0 + rd)
        addWall(x0, z0, x0, z0 + rd)
        addWall(x0 + rw, z0, x0 + rw, z0 + rd)
      } else {
        // Glass balustrade on decks
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(rw, wallH * 0.6, wallT * 0.6),
          new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.35, roughness: 0.05 }),
        )
        rail.position.set(x0 + rw / 2, slabTop + wallH * 0.3, z0 + rd)
        group.add(rail)
      }

      const label = document.createElement('div')
      label.className = 'room-label'
      label.innerHTML = `<b>${room.name}</b><span>${roomSizeLabel(plan, room)}</span>`
      const obj = new CSS2DObject(label)
      obj.position.set(x0 + rw / 2, slabTop + wallH + 0.05, z0 + rd / 2)
      group.add(obj)
    }
    fm.group.add(group)
    this.planGroup = group
  }

  private clearPlan() {
    if (!this.planGroup) return
    this.planGroup.traverse((o) => {
      if (o instanceof CSS2DObject) o.element.remove()
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | undefined
      mat?.dispose?.()
    })
    this.planGroup.parent?.remove(this.planGroup)
    this.planGroup = null
  }

  // ---------- look ----------

  private applyMaterials() {
    for (const fm of this.floors) {
      const g = fm.glass.material
      const s = fm.slab.material
      const isSel = this.selected === fm.floor
      const isHover = this.hovered === fm.floor && this.selected == null
      const inType = this.highlightedType != null && fm.info?.residence.id === this.highlightedType && this.selected == null
      const dimmed = this.selected != null && !isSel

      if (isSel) {
        g.opacity = 0.06
        g.emissiveIntensity = 0
        s.emissiveIntensity = 0
      } else if (isHover) {
        g.emissive.copy(GOLD)
        g.emissiveIntensity = fm.info?.status === 'sold' ? 0.22 : 0.55
        g.opacity = 0.95
        s.emissiveIntensity = 0.45
      } else if (inType) {
        g.emissive.copy(GOLD)
        g.emissiveIntensity = 0.25
        g.opacity = 0.94
        s.emissiveIntensity = 0.15
      } else {
        g.emissive.copy(WARM)
        g.emissiveIntensity = dimmed ? fm.baseLit * 0.4 : fm.baseLit
        g.opacity = dimmed ? 0.35 : 0.94
        s.emissiveIntensity = 0
      }
      s.opacity = dimmed ? 0.45 : 1
    }
  }

  // ---------- interaction ----------

  private pick(e: PointerEvent): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = this.floors.flatMap((f) => [f.glass, f.slab])
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    if (!hit) return null
    const floor = hit.object.userData.floor as number
    const fm = this.floors.find((f) => f.floor === floor)
    return fm?.info ? floor : null
  }

  private setHover(floor: number | null) {
    if (floor === this.hovered) return
    this.hovered = floor
    this.renderer.domElement.style.cursor = floor != null ? 'pointer' : 'grab'
    this.applyMaterials()
    this.cb.onHover(floor)
  }

  private onPointerMove = (e: PointerEvent) => {
    this.pointerInside = true
    if (e.pointerType !== 'mouse' || this.selected != null || e.buttons) return
    this.setHover(this.pick(e))
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.downAt) return
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y)
    this.downAt = null
    if (moved > 6 || this.selected != null) return
    const floor = this.pick(e)
    if (floor != null) {
      this.setHover(null)
      this.cb.onSelect(floor)
    }
  }

  private onPointerLeave = () => {
    this.pointerInside = false
    this.setHover(null)
  }

  // ---------- frame ----------

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
    this.camera.aspect = w / h
    this.applyViewOffset()
    if (this.selected == null) this.frameTower(!this.camGoal)
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const k = 1 - Math.exp(-dt * 5)

    for (const fm of this.floors) {
      fm.group.position.y += (fm.targetY - fm.group.position.y) * k
    }
    if (this.crown) {
      const baseCrownY = this.floors.length ? this.floors[this.floors.length - 1].baseY + this.floorH : 0
      const goal = baseCrownY + ((this.crown.userData.lift as number) || 0)
      this.crown.position.y += (goal - this.crown.position.y) * k
    }

    if (this.camGoal) {
      this.camera.position.lerp(this.camGoal.pos, k)
      this.controls.target.lerp(this.camGoal.target, k)
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.02) this.camGoal = null
    }
    this.controls.autoRotate = this.selected == null && this.hovered == null && !this.pointerInside && !this.camGoal && !reducedMotion()
    this.controls.update()

    this.positionTooltip()
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  private positionTooltip() {
    if (this.hovered == null) {
      this.tooltip.style.opacity = '0'
      return
    }
    const fm = this.floors.find((f) => f.floor === this.hovered)
    if (!fm) return
    const [W] = this.property.footprint
    const p = new THREE.Vector3(W * 0.55, fm.group.position.y + this.floorH / 2, 0).project(this.camera)
    const rect = this.container.getBoundingClientRect()
    const x = (p.x * 0.5 + 0.5) * rect.width
    const y = (-p.y * 0.5 + 0.5) * rect.height
    const flip = x > rect.width - 260
    this.tooltip.style.opacity = '1'
    this.tooltip.style.transform = `translate(${flip ? x - 250 : x + 18}px, ${y - 36}px)`
  }
}

function mulberry(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
