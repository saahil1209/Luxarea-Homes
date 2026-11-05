// Floor plans are drawn on a 0–1 grid over the floor plate, with the plate's
// real size in feet, so the same plan scales onto any tower footprint and the
// labels can still show true room dimensions.

export type RoomKind = 'living' | 'bed' | 'wet' | 'kitchen' | 'outdoor' | 'service' | 'circulation'

export interface Room {
  name: string
  kind: RoomKind
  x: number
  y: number
  w: number
  h: number
}

export interface FloorPlan {
  id: string
  widthFt: number
  depthFt: number
  rooms: Room[]
}

export const FLOOR_PLANS: Record<string, FloorPlan> = {
  // 3 BHK, about 2,400 sq ft carpet
  three: {
    id: 'three',
    widthFt: 64,
    depthFt: 42,
    rooms: [
      { name: 'Living & Dining', kind: 'living', x: 0, y: 0, w: 0.46, h: 0.55 },
      { name: 'Sea Deck', kind: 'outdoor', x: 0, y: 0.55, w: 0.3, h: 0.45 },
      { name: 'Foyer', kind: 'circulation', x: 0.3, y: 0.55, w: 0.16, h: 0.45 },
      { name: 'Kitchen', kind: 'kitchen', x: 0.46, y: 0, w: 0.18, h: 0.38 },
      { name: 'Utility', kind: 'service', x: 0.46, y: 0.38, w: 0.18, h: 0.17 },
      { name: 'Bedroom 2', kind: 'bed', x: 0.46, y: 0.55, w: 0.2, h: 0.45 },
      { name: 'Master Suite', kind: 'bed', x: 0.64, y: 0, w: 0.36, h: 0.55 },
      { name: 'Bath', kind: 'wet', x: 0.66, y: 0.55, w: 0.12, h: 0.45 },
      { name: 'Bedroom 3', kind: 'bed', x: 0.78, y: 0.55, w: 0.22, h: 0.45 },
    ],
  },
  // 4 BHK, about 3,600 sq ft carpet
  four: {
    id: 'four',
    widthFt: 78,
    depthFt: 50,
    rooms: [
      { name: 'Formal Living', kind: 'living', x: 0, y: 0, w: 0.34, h: 0.5 },
      { name: 'Dining', kind: 'living', x: 0.34, y: 0, w: 0.2, h: 0.5 },
      { name: 'Wraparound Deck', kind: 'outdoor', x: 0, y: 0.5, w: 0.22, h: 0.5 },
      { name: 'Family Lounge', kind: 'living', x: 0.22, y: 0.5, w: 0.2, h: 0.5 },
      { name: 'Foyer', kind: 'circulation', x: 0.42, y: 0.5, w: 0.12, h: 0.5 },
      { name: 'Kitchen', kind: 'kitchen', x: 0.54, y: 0, w: 0.16, h: 0.32 },
      { name: 'Staff Room', kind: 'service', x: 0.54, y: 0.32, w: 0.16, h: 0.18 },
      { name: 'Bedroom 2', kind: 'bed', x: 0.54, y: 0.5, w: 0.16, h: 0.5 },
      { name: 'Master Suite', kind: 'bed', x: 0.7, y: 0, w: 0.3, h: 0.5 },
      { name: 'Bedroom 3', kind: 'bed', x: 0.7, y: 0.5, w: 0.16, h: 0.5 },
      { name: 'Bedroom 4', kind: 'bed', x: 0.86, y: 0.5, w: 0.14, h: 0.5 },
    ],
  },
  // Full-floor penthouse, about 6,500 sq ft carpet
  penthouse: {
    id: 'penthouse',
    widthFt: 104,
    depthFt: 64,
    rooms: [
      { name: 'Grand Salon', kind: 'living', x: 0, y: 0, w: 0.38, h: 0.52 },
      { name: 'Infinity Pool Deck', kind: 'outdoor', x: 0, y: 0.52, w: 0.38, h: 0.48 },
      { name: 'Dining', kind: 'living', x: 0.38, y: 0, w: 0.17, h: 0.4 },
      { name: 'Bar & Library', kind: 'living', x: 0.38, y: 0.4, w: 0.17, h: 0.3 },
      { name: 'Private Lift Lobby', kind: 'circulation', x: 0.38, y: 0.7, w: 0.17, h: 0.3 },
      { name: 'Show Kitchen', kind: 'kitchen', x: 0.55, y: 0, w: 0.15, h: 0.3 },
      { name: 'Service Wing', kind: 'service', x: 0.55, y: 0.3, w: 0.15, h: 0.22 },
      { name: 'Media Room', kind: 'living', x: 0.55, y: 0.52, w: 0.15, h: 0.48 },
      { name: 'Master Suite', kind: 'bed', x: 0.7, y: 0, w: 0.3, h: 0.42 },
      { name: 'Dressing', kind: 'wet', x: 0.7, y: 0.42, w: 0.1, h: 0.2 },
      { name: 'Suite 2', kind: 'bed', x: 0.8, y: 0.42, w: 0.2, h: 0.3 },
      { name: 'Suite 3', kind: 'bed', x: 0.7, y: 0.62, w: 0.15, h: 0.38 },
      { name: 'Suite 4', kind: 'bed', x: 0.85, y: 0.72, w: 0.15, h: 0.28 },
    ],
  },
  // Villa level plans (Alibaug)
  villaGround: {
    id: 'villaGround',
    widthFt: 90,
    depthFt: 60,
    rooms: [
      { name: 'Living Pavilion', kind: 'living', x: 0, y: 0, w: 0.42, h: 0.55 },
      { name: 'Pool Terrace', kind: 'outdoor', x: 0, y: 0.55, w: 0.6, h: 0.45 },
      { name: 'Dining', kind: 'living', x: 0.42, y: 0, w: 0.2, h: 0.55 },
      { name: 'Kitchen', kind: 'kitchen', x: 0.62, y: 0, w: 0.18, h: 0.35 },
      { name: 'Staff Quarters', kind: 'service', x: 0.8, y: 0, w: 0.2, h: 0.35 },
      { name: 'Guest Suite', kind: 'bed', x: 0.62, y: 0.35, w: 0.38, h: 0.65 },
    ],
  },
  villaUpper: {
    id: 'villaUpper',
    widthFt: 90,
    depthFt: 60,
    rooms: [
      { name: 'Master Suite', kind: 'bed', x: 0, y: 0, w: 0.4, h: 0.6 },
      { name: 'Sit-out Balcony', kind: 'outdoor', x: 0, y: 0.6, w: 0.4, h: 0.4 },
      { name: 'Upper Lounge', kind: 'living', x: 0.4, y: 0, w: 0.22, h: 1 },
      { name: 'Bedroom 2', kind: 'bed', x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { name: 'Bedroom 3', kind: 'bed', x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
}

export function roomSizeLabel(plan: FloorPlan, room: Room): string {
  const w = Math.round(room.w * plan.widthFt)
  const d = Math.round(room.h * plan.depthFt)
  return `${w}′ × ${d}′`
}
