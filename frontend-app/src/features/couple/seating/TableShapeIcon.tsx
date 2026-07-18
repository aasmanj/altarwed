import { normalizeShape, shapeDescription } from './tableShape'

// Small silhouette of a reception table (issue #356). Purely presentational: it reads shape +
// capacity from props and draws an SVG motif with seat "pips" so a couple can tell a round table
// from a long head table at a glance in the editor and on the printed board.
//
// ROUND      -> circle, pips evenly around the rim
// RECTANGLE  -> rounded rectangle, pips along the two long sides
// HEAD       -> wide banquet bar, pips along the front edge only (guests face the room)

function seatDots(capacity: number): number {
  // Cap the drawn pips so a 12-seat table stays legible at icon size; the numeric count still
  // shows the true capacity elsewhere in the UI.
  if (!Number.isFinite(capacity) || capacity < 1) return 1
  return Math.min(Math.round(capacity), 12)
}

export default function TableShapeIcon({
  shape,
  capacity = 8,
  size = 28,
  className = '',
}: {
  shape: string | null | undefined
  capacity?: number
  size?: number
  className?: string
}) {
  const s = normalizeShape(shape)
  const dots = seatDots(capacity)
  const title = shapeDescription(s)
  const pip = 'currentColor'

  // 0..24 viewBox keeps the math simple; the surface (table) is a lighter fill, pips solid.
  const surface = { fill: 'currentColor', fillOpacity: 0.15, stroke: 'currentColor', strokeWidth: 1.25 }

  let body: React.ReactNode
  if (s === 'ROUND') {
    const cx = 12, cy = 12, r = 6.5, pipR = 9.5
    body = (
      <>
        <circle cx={cx} cy={cy} r={r} {...surface} />
        {Array.from({ length: dots }).map((_, i) => {
          const a = (2 * Math.PI * i) / dots - Math.PI / 2
          return <circle key={i} cx={cx + pipR * Math.cos(a)} cy={cy + pipR * Math.sin(a)} r={1.4} fill={pip} />
        })}
      </>
    )
  } else if (s === 'RECTANGLE') {
    const perSide = Math.ceil(dots / 2)
    body = (
      <>
        <rect x={5} y={7} width={14} height={10} rx={2} {...surface} />
        {Array.from({ length: perSide }).map((_, i) => {
          const x = 5 + ((i + 1) * 14) / (perSide + 1)
          return <circle key={`t${i}`} cx={x} cy={4.5} r={1.4} fill={pip} />
        })}
        {Array.from({ length: dots - perSide }).map((_, i) => {
          const x = 5 + ((i + 1) * 14) / (dots - perSide + 1)
          return <circle key={`b${i}`} cx={x} cy={19.5} r={1.4} fill={pip} />
        })}
      </>
    )
  } else {
    // HEAD: wide bar, pips only along the front edge.
    body = (
      <>
        <rect x={2.5} y={9} width={19} height={6} rx={1.5} {...surface} />
        {Array.from({ length: dots }).map((_, i) => {
          const x = 2.5 + ((i + 1) * 19) / (dots + 1)
          return <circle key={i} cx={x} cy={17.5} r={1.4} fill={pip} />
        })}
      </>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {body}
    </svg>
  )
}
