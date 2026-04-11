import { createFileRoute } from '@tanstack/react-router'
import { Activity, Smartphone, MapPin, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
})

function DashboardOverview() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h2>
        <p className="text-slate-500 mt-1">Real-time insights from the Malawi Road Network Assessment.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Trips" value="1,284" change="+12% vs last month" icon={<Activity className="text-blue-600" />} />
        <StatCard title="Active Devices" value="42" change="+3 new today" icon={<Smartphone className="text-green-600" />} />
        <StatCard title="Road Quality Index" value="3.8" change="IRI - Average" icon={<MapPin className="text-purple-600" />} />
        <StatCard title="Hazards Detected" value="7" change="-2 from yesterday" icon={<AlertTriangle className="text-yellow-600" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-900 mb-6 uppercase tracking-widest text-[12px] text-slate-500">Recent Road Segments Analysed</h3>
           <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                   <div className="w-12 h-12 rounded bg-white flex items-center justify-center font-black text-blue-600 text-sm border border-slate-200 shadow-sm">M1</div>
                   <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">Segment {1000 + i}</p>
                      <p className="text-xs text-slate-500">Blantyre - Lilongwe Corridor</p>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-slate-900">IRI { (2 + Math.random() * 5).toFixed(1) }</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Quality Score</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
        <div className="col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-900 mb-6 uppercase tracking-widest text-[12px] text-slate-500">System Health</h3>
           <div className="space-y-6">
              <HealthItem label="API Server" status="Online" color="bg-green-500" />
              <HealthItem label="ML Processing Engine" status="Online" color="bg-green-500" />
              <HealthItem label="Database Cluster" status="Warning" color="bg-yellow-500" />
              <HealthItem label="Storage Bucket" status="Online" color="bg-green-500" />
           </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, icon }: { title: string; value: string; change: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{title}</h4>
        <div className="p-2 rounded-lg bg-slate-50">{icon}</div>
      </div>
      <div className="text-3xl font-black text-slate-900">{value}</div>
      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{change}</p>
    </div>
  )
}

function HealthItem({ label, status, color }: { label: string; status: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{status}</span>
    </div>
  )
}
