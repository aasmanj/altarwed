import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  action?: React.ReactNode
  /**
   * Max-width of the inner content row — should match the page's own content width
   * so the header title/actions align with the content below on wide screens.
   * Defaults to 'max-w-5xl' (guests, budget, photos, communications).
   * Pass 'max-w-4xl' or 'max-w-3xl' for narrower pages.
   */
  maxWidth?: string
}

export default function PageHeader({ title, subtitle, action, maxWidth = 'max-w-5xl' }: Props) {
  return (
    <header className="bg-white border-b border-gold-light flex-shrink-0">
      <div className={`mx-auto ${maxWidth} px-4 sm:px-6 py-3 sm:py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="text-sm text-brown-light hover:text-brown transition flex items-center gap-1 shrink-0 mt-0.5"
            >
              ← <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-gold-light shrink-0 mt-0.5">|</span>
            <div className="min-w-0">
              <h1 className="font-serif text-lg sm:text-xl font-bold text-brown leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-brown-light mt-0.5 break-words">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </div>
    </header>
  )
}
