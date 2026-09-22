import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { cx } from '../lib/utils'
import { Board } from './pages/Board'
import { ApplicationDetail } from './pages/ApplicationDetail'
import { CoverLetters } from './pages/CoverLetters'
import { Templates } from './pages/Templates'
import { Profile } from './pages/Profile'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'

const NAV = [
  { to: '/board', label: 'Board' },
  { to: '/letters', label: 'Cover letters' },
  { to: '/templates', label: 'Templates' },
  { to: '/stats', label: 'Stats' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
]

export function App() {
  const total = useLiveQuery(() => db.applications.count(), [], 0)

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6">
          <div className="text-sm font-semibold">Internship Tracker</div>
          <div className="text-xs text-zinc-500">{total} application{total === 1 ? "" : "s"}</div>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx(
                  'block rounded px-3 py-1.5 text-sm',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/board" element={<Board />} />
          <Route path="/app/:id" element={<ApplicationDetail />} />
          <Route path="/letters" element={<CoverLetters />} />
          <Route path="/letters/:id" element={<CoverLetters />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
