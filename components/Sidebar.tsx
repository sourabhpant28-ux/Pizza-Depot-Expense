'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Store,
  Receipt,
  Upload,
  BarChart2,
} from 'lucide-react'

const navLinks = [
  { label: 'Dashboard', href: '/',        icon: LayoutDashboard },
  { label: 'Stores',    href: '/stores',   icon: Store           },
  { label: 'Expenses',  href: '/expenses', icon: Receipt         },
  { label: 'Import',    href: '/import',   icon: Upload          },
  { label: 'Reports',   href: '/reports',  icon: BarChart2       },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [activeCount, setActiveCount] = useState<number | null>(null)

  // Fetch active store count on mount
  useEffect(() => {
    supabase
      .from('stores')
      .select('id')
      .eq('active', true)
      .limit(1000)
      .then(({ data, error }) => {
        if (!error) setActiveCount(data?.length ?? 0)
      })
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside className="flex flex-col w-64 h-full bg-gray-950 text-white">

      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-800">
        <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-1">
          Internal Tool
        </p>
        <h1 className="text-lg font-semibold text-white leading-tight">
          Marketing Fund Tracker
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(href)
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer — live active store count */}
      <div className="px-6 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">Active Stores</p>
        <p className="text-sm font-semibold text-white mt-0.5">
          {activeCount === null ? '…' : `${activeCount} store${activeCount !== 1 ? 's' : ''}`}
        </p>
      </div>

    </aside>
  )
}
