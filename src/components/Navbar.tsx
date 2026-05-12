import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@mysten/dapp-kit'
import { Waves, LayoutDashboard, PlusSquare, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/builder', label: 'Create Form', icon: PlusSquare },
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-teal-700 text-lg shrink-0">
          <Waves className="h-6 w-6" />
          <span>WalrusPulse</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === to
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Wallet */}
        <div className="shrink-0 [&>button]:!bg-teal-600 [&>button]:!text-white [&>button]:!rounded-lg [&>button]:!text-sm [&>button]:!font-medium [&>button]:!px-4 [&>button]:!py-2 [&>button]:hover:!bg-teal-700 [&>button]:!border-0 [&>button]:!shadow-sm">
          <ConnectButton connectText="Connect Wallet" />
        </div>
      </div>
    </header>
  )
}
