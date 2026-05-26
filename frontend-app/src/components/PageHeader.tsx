import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  action?: React.ReactNode
  /**
   * Max-width of the inner content row. Should match the page's own content width
   * so the header title/actions align with the content below on wide screens.
   * Defaults to 'max-w-5xl' (guests, budget, photos, communications).
   * Pass 'max-w-4xl' or 'max-w-3xl' for narrower pages.
   */
  maxWidth?: string
}

export default function PageHeader({ title, subtitle, action, maxWidth = 'max-w-5xl' }: Props) {
  return (
    <header className="bg-white border-b border-gold-light flex-shrink-0">
      <div className={`mx-auto ${maxWidth} px-4 sm:px-6 pt-2.5 pb-3 sm:pt-3 sm:pb-4`}>
        {/* Back link, on its own row, far-left edge. Wording is intentionally
            explicit ("Back to dashboard") rather than the shorter "Dashboard" so
            non-technical users (parents, older guests doing a walkthrough) immediately
            understand the affordance as a navigation control. */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-brown-light hover:text-brown transition mb-1.5"
        >
          <span aria-hidden>←</span> Back to dashboard
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-lg sm:text-xl font-bold text-brown leading-tight">{title}</h1>
            {subtitle && <p className="hidden sm:block text-xs text-brown-light mt-0.5 truncate">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </div>
    </header>
  )
}
