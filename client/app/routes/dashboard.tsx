import { Outlet, createFileRoute, Link } from '@tanstack/react-router'
import { LayoutDashboard, Map as MapIcon, Users, Settings, LogOut, Activity } from 'lucide-react'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black tracking-tighter uppercase italic">Tayenda v1</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Malawi Road Assessment</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Overview" />
          <SidebarItem href="/dashboard/map" icon={<MapIcon size={20} />} label="Road Map" />
          <SidebarItem href="/dashboard/trips" icon={<Activity size={20} />} label="Trip Audits" />
          <SidebarItem href="/dashboard/users" icon={<Users size={20} />} label="User Management" />
          <div className="pt-4 mt-4 border-t border-slate-800">
             <SidebarItem href="/dashboard/settings" icon={<Settings size={20} />} label="System Settings" />
          </div>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium">
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Manager Console</h2>
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">Rflmwcom Admin</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">tayenda.renai-labs.com</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200 shadow-sm">
                RA
             </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function SidebarItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium [&.active]:text-white [&.active]:bg-blue-600 [&.active]:shadow-lg [&.active]:shadow-blue-900/20"
    >
      {icon}
      {label}
    </Link>
  )
}
