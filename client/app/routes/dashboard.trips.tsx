import { createFileRoute } from '@tanstack/react-router'
import { Search, Filter, MoreVertical, Eye, Download, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/dashboard/trips')({
  component: TripAuditsComponent,
})

function TripAuditsComponent() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Trip Audits</h2>
          <p className="text-slate-500 mt-1">Review and manage field data collection sessions.</p>
        </div>
        <div className="flex gap-3">
           <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search trip ID..." 
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 w-64 shadow-sm"
              />
           </div>
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
              <Filter size={16} />
              Filters
           </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Trip Identifier</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Device / User</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Time</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Quality (IRI)</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <TripRow 
              id="TRP-01J9..." 
              device="Pixel 8 (Rflmwcom)" 
              time="Oct 11, 2026 - 14:30" 
              iri="3.2 (Fair)" 
              status="Completed"
              statusIcon={<CheckCircle2 className="text-green-500" size={16} />}
            />
            <TripRow 
              id="TRP-01J9..." 
              device="Samsung S24 (User_01)" 
              time="Oct 11, 2026 - 12:15" 
              iri="Pending ML" 
              status="Uploading"
              statusIcon={<Clock className="text-blue-500 animate-pulse" size={16} />}
            />
            <TripRow 
              id="TRP-01J9..." 
              device="Pixel 7 (User_05)" 
              time="Oct 10, 2026 - 18:45" 
              iri="1.8 (Good)" 
              status="Completed"
              statusIcon={<CheckCircle2 className="text-green-500" size={16} />}
            />
            <TripRow 
              id="TRP-01J9..." 
              device="iPhone 15 (Admin)" 
              time="Oct 10, 2026 - 09:10" 
              iri="N/A" 
              status="Failed"
              statusIcon={<AlertCircle className="text-red-500" size={16} />}
            />
          </tbody>
        </table>
        
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
           <p className="text-xs text-slate-500 font-medium">Showing 4 of 1,284 trips</p>
           <div className="flex gap-2">
              <button className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
              <button className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50">Next</button>
           </div>
        </div>
      </div>
    </div>
  )
}

function TripRow({ id, device, time, iri, status, statusIcon }: { id: string; device: string; time: string; iri: string; status: string; statusIcon: React.ReactNode }) {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{id}</td>
      <td className="px-6 py-4">
        <p className="text-sm font-bold text-slate-900">{device}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verified HW</p>
      </td>
      <td className="px-6 py-4 text-sm text-slate-600">{time}</td>
      <td className="px-6 py-4">
        <span className={`text-xs font-black px-2 py-1 rounded ${iri.includes('Good') ? 'bg-green-100 text-green-700' : iri.includes('Fair') ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
           {iri}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
           {statusIcon}
           <span className="text-xs font-bold text-slate-700">{status}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Details"><Eye size={18} /></button>
           <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="Download Samples"><Download size={18} /></button>
           <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Trip"><Trash2 size={18} /></button>
        </div>
      </td>
    </tr>
  )
}
