import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="bg-white border-b border-gold-light px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-sm text-brown-light hover:text-brown transition flex items-center gap-1"
          >
            ← Dashboard
          </Link>
          <span className="text-gold-light">|</span>
          <div>
            <h1 className="font-serif text-xl font-bold text-brown leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-brown-light mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </header>
  )
}
