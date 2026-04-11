import { createFileRoute } from '@tanstack/react-router'
import { MapPin, Filter, Layers, Info } from 'lucide-react'

export const Route = createFileRoute('/dashboard/map')({
  component: RoadMapComponent,
})

function RoadMapComponent() {
  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Malawi Road Network</h2>
          <p className="text-slate-500 mt-1">Spatial visualization of ML-derived road quality scores.</p>
        </div>
        <div className="flex gap-2">
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
              <Filter size={16} />
              Filter Data
           </button>
           <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-md">
              <Layers size={16} />
              Layer Settings
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Map Container */}
        <div className="flex-1 bg-slate-200 rounded-2xl border-2 border-slate-300 relative overflow-hidden shadow-inner">
           {/* Placeholder for MapLibre / Leaflet */}
           <div className="absolute inset-0 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-200 opacity-50">
              <div className="text-center">
                 <MapPin size={48} className="text-blue-600 mx-auto mb-4 animate-bounce" />
                 <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">Interactive Map Engine Loading...</p>
                 <p className="text-slate-400 text-xs mt-2">Projection: Malawi - Blantyre/Lilongwe Corridor</p>
              </div>
           </div>

           {/* Map Overlay Controls */}
           <div className="absolute top-4 left-4 space-y-2">
              <div className="bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 w-48">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quality Legend (IRI)</p>
                 <div className="space-y-2">
                    <LegendItem color="bg-green-500" label="Good ( < 2.0 )" />
                    <LegendItem color="bg-yellow-500" label="Fair ( 2.0 - 4.0 )" />
                    <LegendItem color="bg-red-500" label="Poor ( > 4.0 )" />
                    <LegendItem color="bg-slate-900" label="Critical / Hazard" />
                 </div>
              </div>
           </div>
        </div>

        {/* Info Panel */}
        <aside className="w-80 space-y-4 overflow-auto pr-2">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-4">
                 <Info size={18} />
                 <h3 className="font-bold text-sm uppercase tracking-widest">Zone Insights</h3>
              </div>
              <div className="space-y-4">
                 <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Current Focus</p>
                    <p className="text-lg font-black text-slate-900">Lilongwe Area</p>
                    <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-600 w-3/4" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">75% Data Coverage - ML Confident</p>
                 </div>
                 
                 <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Top Identified Hazards</p>
                    <HazardItem type="Pothole Cluster" location="M1 - North" count={12} />
                    <HazardItem type="Edge Subsidence" location="S122 - Dedza" count={5} />
                    <HazardItem type="Severe Corrugation" location="Unpaved - Salima" count={8} />
                 </div>
              </div>
           </div>
        </aside>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </div>
  )
}

function HazardItem({ type, location, count }: { type: string; location: string; count: number }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
       <div>
          <p className="text-xs font-bold text-slate-800">{type}</p>
          <p className="text-[10px] text-slate-400">{location}</p>
       </div>
       <div className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-600">{count}</div>
    </div>
  )
}
