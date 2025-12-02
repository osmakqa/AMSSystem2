import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { Prescription, PrescriptionStatus, DrugType } from '../types';
import ChartDetailModal from './ChartDetailModal';
import { IDS_SPECIALISTS, PHARMACISTS } from '../constants';

interface StatsChartProps {
  data: Prescription[];
  allData: Prescription[];
  role?: string;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
}

// --- Data Processing Helpers ---
const getTopN = (items: (string | undefined)[], n: number) => {
  const counts = new Map<string, number>();
  items.forEach(item => { if (item) { counts.set(item, (counts.get(item) || 0) + 1); } });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }));
};

const formatDuration = (ms: number) => {
  if (isNaN(ms) || ms <= 0) return 'N/A';
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${(hours * 60).toFixed(0)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
};

// --- Reusable UI Components ---
const ChartWrapper = ({ title, children, onClick }: { title: string, children: React.ReactNode, onClick?: () => void }) => (
  <div 
    className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-[400px] flex flex-col transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-2xl hover:border-green-300 hover:-translate-y-1' : ''}`}
    onClick={onClick}
  >
    <h3 className="text-md font-bold text-gray-800 mb-4">{title}</h3>
    <div className="flex-grow w-full h-full">{children}</div>
  </div>
);

const KpiCard = ({ title, value, subValue, icon, color, onClick }: { title: string, value: string | number, subValue?: string, icon: React.ReactNode, color: string, onClick?: () => void }) => (
  <div className={`bg-white p-5 rounded-xl shadow-lg border border-gray-200 flex items-center gap-5 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-2xl hover:border-green-300 hover:-translate-y-1' : ''}`} onClick={onClick}>
    <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

const Top5List = ({ title, data, color, icon, onClick }: { title: string, data: { name: string, value: number }[], color: string, icon: React.ReactNode, onClick?: () => void }) => (
    <div className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-full flex flex-col transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-2xl hover:border-green-300 hover:-translate-y-1' : ''}`} onClick={onClick}>
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
            <h3 className="text-md font-bold text-gray-800">{title}</h3>
        </div>
        <div className="space-y-3">
            {data.length > 0 ? data.map((item, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                    <span className="text-sm font-medium text-gray-700 truncate">{index + 1}. {item.name}</span>
                    <span className={`text-sm font-bold text-white px-2 py-0.5 rounded-full ${color}`}>{item.value}</span>
                </div>
            )) : <NoDataDisplay />}
        </div>
    </div>
);

const NoDataDisplay = () => <div className="flex items-center justify-center h-full text-gray-400">No data for this period.</div>;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700 text-sm"><p className="font-bold mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (<div key={index} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div><span>{`${entry.name}: ${entry.value}`}</span></div>))}
      </div>);
  }
  return null;
};

const FilterControls = ({ selectedMonth, onMonthChange, selectedYear, onYearChange }: any) => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">Month:</label>
        <select 
          value={selectedMonth} 
          onChange={(e) => onMonthChange(parseInt(e.target.value))} 
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-green-200 focus:border-green-500 outline-none shadow-sm transition-colors hover:border-gray-400"
        >
          <option value={-1}>All Months</option>
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">Year:</label>
        <select 
          value={selectedYear} 
          onChange={(e) => onYearChange(parseInt(e.target.value))} 
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-green-200 focus:border-green-500 outline-none shadow-sm transition-colors hover:border-gray-400"
        >
          <option value={0}>All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
};


// --- Main Component ---
const StatsChart: React.FC<StatsChartProps> = ({ data, allData, selectedMonth, onMonthChange, selectedYear, onYearChange }) => {
  const [activeTab, setActiveTab] = useState('General');
  const [modeFilter, setModeFilter] = useState<'All' | 'adult' | 'pediatric'>('All');
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; data: Prescription[]; title: string }>({ isOpen: false, data: [], title: '' });
  
  const handleModalClose = () => setModalConfig({ isOpen: false, data: [], title: '' });
  
  const modeFilteredData = useMemo(() => {
    let filtered = data;
    
    // Apply Date Filter
    filtered = filtered.filter(item => {
      const d = item.req_date ? new Date(item.req_date) : new Date(item.created_at || Date.now());
      const mMatch = selectedMonth === -1 || d.getMonth() === selectedMonth;
      const yMatch = selectedYear === 0 || d.getFullYear() === selectedYear;
      return mMatch && yMatch;
    });

    if (modeFilter === 'All') return filtered;
    return filtered.filter(d => d.mode === modeFilter);
  }, [data, modeFilter, selectedMonth, selectedYear]);

  // --- Data Processing for each Tab ---
  const processedData = useMemo(() => {
    const source = modeFilteredData;
    // Subsets
    const restrictedData = source.filter(d => d.drug_type === DrugType.RESTRICTED);
    const monitoredData = source.filter(d => d.drug_type === DrugType.MONITORED);
    const pharmacyHandled = source.filter(d => PHARMACISTS.includes(d.requested_by)); // simplified
    const idsHandled = source.filter(d => IDS_SPECIALISTS.includes(d.dispensed_by || ''));
    
    // General
    const approvedItems = source.filter(i => i.status === PrescriptionStatus.APPROVED);
    const finalizedItems = source.filter(i => i.status === PrescriptionStatus.APPROVED || i.status === PrescriptionStatus.DISAPPROVED);
    const approvalRate = finalizedItems.length > 0 ? (approvedItems.length / finalizedItems.length * 100).toFixed(1) + '%' : 'N/A';
    
    // Pharmacy
    const pharmacistTimes = source.filter(i => i.dispensed_date && i.created_at).map(i => new Date(i.dispensed_date!).getTime() - new Date(i.created_at!).getTime());
    const avgPharmacistTime = pharmacistTimes.length > 0 ? formatDuration(pharmacistTimes.reduce((a, b) => a + b, 0) / pharmacistTimes.length) : 'N/A';
    const pharmacistDecisions = [
        { name: 'Approved Monitored', value: pharmacyHandled.filter(p => p.drug_type === DrugType.MONITORED && p.status === PrescriptionStatus.APPROVED).length },
        { name: 'Forwarded Restricted', value: pharmacyHandled.filter(p => p.drug_type === DrugType.RESTRICTED && p.status === PrescriptionStatus.FOR_IDS_APPROVAL).length },
    ];
    
    // IDS
    const idsConsults = source.filter(i => (i.ids_approved_at || i.ids_disapproved_at) && i.dispensed_date);
    const idsTimes = idsConsults.map(i => new Date(i.ids_approved_at || i.ids_disapproved_at!).getTime() - new Date(i.dispensed_date!).getTime());
    const avgIdsTime = idsTimes.length > 0 ? formatDuration(idsTimes.reduce((a, b) => a + b, 0) / idsTimes.length) : 'N/A';
    const idsOutcomes = [
      { name: 'Approved', value: idsHandled.filter(i => i.status === PrescriptionStatus.APPROVED).length },
      { name: 'Disapproved', value: idsHandled.filter(i => i.status === PrescriptionStatus.DISAPPROVED).length }
    ];
    const avgTimePerIds = Object.entries(idsConsults.reduce((acc, curr) => {
        if (curr.dispensed_by) {
            const time = new Date(curr.ids_approved_at || curr.ids_disapproved_at!).getTime() - new Date(curr.dispensed_date!).getTime();
            if (!acc[curr.dispensed_by]) acc[curr.dispensed_by] = [];
            acc[curr.dispensed_by].push(time);
        }
        return acc;
    }, {} as Record<string, number[]>)).map(([name, times]) => ({ name, value: (times.reduce((a,b)=>a+b,0)/times.length)/(1000*60*60) }));


    return {
      general: {
        totalRequests: source.length, approvalRate,
        adultCount: source.filter(p => p.mode === 'adult').length,
        pediaCount: source.filter(p => p.mode === 'pediatric').length,
        approvedTypeData: [{ name: DrugType.MONITORED, value: approvedItems.filter(i => i.drug_type === DrugType.MONITORED).length },{ name: DrugType.RESTRICTED, value: approvedItems.filter(i => i.drug_type === DrugType.RESTRICTED).length }],
        topAntimicrobials: getTopN(source.map(i => i.antimicrobial), 5),
      },
      restricted: {
        total: restrictedData.length,
        approvalRate: (idsOutcomes[0].value / (idsOutcomes[0].value + idsOutcomes[1].value) * 100 || 0).toFixed(1) + '%',
        avgIdsTime,
        topDrugs: getTopN(restrictedData.map(d => d.antimicrobial), 5),
        topIndications: getTopN(restrictedData.map(d => d.indication), 5),
        idsOutcomes,
      },
      monitored: {
        total: monitoredData.length,
        approvalRate: (monitoredData.filter(d => d.status === PrescriptionStatus.APPROVED).length / monitoredData.length * 100 || 0).toFixed(1) + '%',
        avgPharmacistTime,
        topDrugs: getTopN(monitoredData.map(d => d.antimicrobial), 5),
        topWards: getTopN(monitoredData.map(d => d.ward), 5),
      },
      pharmacy: {
        totalHandled: pharmacyHandled.length, avgPharmacistTime,
        topPharmacists: getTopN(pharmacyHandled.map(p => p.requested_by), 5),
        decisions: pharmacistDecisions,
      },
      ids: {
        totalConsults: idsHandled.length, avgIdsTime,
        approvalRate: (idsOutcomes[0].value / (idsOutcomes[0].value + idsOutcomes[1].value) * 100 || 0).toFixed(1) + '%',
        topConsultants: getTopN(idsHandled.map(p => p.dispensed_by), 5),
        outcomes: idsOutcomes,
        avgTimePerConsultant: avgTimePerIds
      }
    };
  }, [modeFilteredData]);

  const renderDashboard = () => {
    switch(activeTab) {
      case 'Restricted':
        const r = processedData.restricted;
        return <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard title="Total Restricted Requests" value={r.total} color="bg-purple-100 text-purple-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.RESTRICTED), title: 'All Restricted Requests'})}/>
                <KpiCard title="IDS Approval Rate" value={r.approvalRate} color="bg-yellow-100 text-yellow-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => IDS_SPECIALISTS.includes(d.dispensed_by || '')), title: 'All IDS Consults'})}/>
                <KpiCard title="Avg. IDS Review Time" value={r.avgIdsTime} color="bg-yellow-100 text-yellow-700" icon={<></>}/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Top5List title="Top 5 Restricted Antimicrobials" data={r.topDrugs} color="bg-purple-200 text-purple-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.RESTRICTED), title: 'All Restricted Requests'})} />
                <Top5List title="Top 5 Indications for Restricted Drugs" data={r.topIndications} color="bg-purple-200 text-purple-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.RESTRICTED && d.indication), title: 'All Restricted Requests with Indication'})}/>
                <ChartWrapper title="IDS Review Outcomes"><ResponsiveContainer><PieChart><Pie data={r.idsOutcomes} dataKey="value" nameKey="name" outerRadius={80} label><Cell fill="#16a34a"/><Cell fill="#ef4444"/></Pie><Tooltip content={<CustomTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartWrapper>
            </div>
        </div>
      case 'Monitored':
        const m = processedData.monitored;
        return <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard title="Total Monitored Requests" value={m.total} color="bg-blue-100 text-blue-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.MONITORED), title: 'All Monitored Requests'})}/>
                <KpiCard title="Approval Rate (by Pharmacy)" value={m.approvalRate} color="bg-blue-100 text-blue-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.MONITORED), title: 'All Monitored Requests'})}/>
                <KpiCard title="Avg. Pharmacist Review Time" value={m.avgPharmacistTime} color="bg-blue-100 text-blue-700" icon={<></>}/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Top5List title="Top 5 Monitored Antimicrobials" data={m.topDrugs} color="bg-blue-200 text-blue-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.MONITORED), title: 'All Monitored Requests'})}/>
                <Top5List title="Top 5 Wards for Monitored Drugs" data={m.topWards} color="bg-blue-200 text-blue-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.drug_type === DrugType.MONITORED && d.ward), title: 'All Monitored Requests with Ward'})}/>
            </div>
        </div>
      case 'Pharmacy':
        const p = processedData.pharmacy;
        return <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <KpiCard title="Total Requests Handled" value={p.totalHandled} color="bg-green-100 text-green-700" icon={<></>} />
                <KpiCard title="Avg. First Action Time" value={p.avgPharmacistTime} color="bg-green-100 text-green-700" icon={<></>} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Top5List title="Top 5 Pharmacists by Activity" data={p.topPharmacists} color="bg-green-200 text-green-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => PHARMACISTS.includes(d.requested_by)), title: 'All Pharmacy Activity'})} />
                <ChartWrapper title="Pharmacist Decisions"><ResponsiveContainer><PieChart><Pie data={p.decisions} dataKey="value" nameKey="name" outerRadius={80} label><Cell fill="#3b82f6"/><Cell fill="#a855f7"/></Pie><Tooltip content={<CustomTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartWrapper>
            </div>
        </div>
      case 'IDS':
        const i = processedData.ids;
        return <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard title="Total IDS Consults" value={i.totalConsults} color="bg-teal-100 text-teal-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => IDS_SPECIALISTS.includes(d.dispensed_by || '')), title: 'All IDS Consults'})}/>
                <KpiCard title="IDS Approval Rate" value={i.approvalRate} color="bg-teal-100 text-teal-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => IDS_SPECIALISTS.includes(d.dispensed_by || '')), title: 'All IDS Consults'})}/>
                <KpiCard title="Avg. IDS Turnaround Time" value={i.avgIdsTime} color="bg-teal-100 text-teal-700" icon={<></>} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Top5List title="Top 5 IDS Consultants by Reviews" data={i.topConsultants} color="bg-teal-200 text-teal-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => IDS_SPECIALISTS.includes(d.dispensed_by || '')), title: 'All IDS Consults'})}/>
                <ChartWrapper title="IDS Decision Outcomes"><ResponsiveContainer><PieChart><Pie data={i.outcomes} dataKey="value" nameKey="name" outerRadius={80} label><Cell fill="#16a34a"/><Cell fill="#ef4444"/></Pie><Tooltip content={<CustomTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartWrapper>
                <ChartWrapper title="Average time chart per IDS" onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.ids_approved_at || d.ids_disapproved_at), title: 'All IDS Consults'})}>
                  <ResponsiveContainer>
                    <BarChart data={i.avgTimePerConsultant} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                      <XAxis type="number" domain={[0, 'dataMax + 2']} />
                      <YAxis type="category" dataKey="name" tick={{fontSize: 12}} />
                      <Tooltip content={<CustomTooltip />} formatter={(value) => `${Number(value).toFixed(1)} hrs`}/>
                      <Bar dataKey="value" name="Avg. Hours" fill="#0d9488" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrapper>
            </div>
        </div>
      default: // General
        const g = processedData.general;
        return <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiCard title="Total Requests" value={g.totalRequests} color="bg-gray-100 text-gray-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData, title: 'All Requests'})} />
              <KpiCard title="Overall Approval Rate" value={g.approvalRate} color="bg-gray-100 text-gray-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d=>d.status === 'approved' || d.status === 'disapproved'), title: 'All Finalized Requests'})} />
              <KpiCard title="Adult vs. Pedia Caseload" value={`${g.adultCount} / ${g.pediaCount}`} subValue="Adult / Pedia" color="bg-gray-100 text-gray-700" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData, title: 'All Requests'})} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartWrapper title="Approved: Monitored vs Restricted" onClick={() => setModalConfig({isOpen: true, data: modeFilteredData.filter(d => d.status === 'approved'), title: 'All Approved Requests'})}><ResponsiveContainer><PieChart><Pie data={g.approvedTypeData} dataKey="value" nameKey="name" outerRadius={80} label><Cell fill="#3b82f6"/><Cell fill="#a855f7"/></Pie><Tooltip content={<CustomTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartWrapper>
              <Top5List title="Top 5 Antimicrobials (Overall)" data={g.topAntimicrobials} color="bg-gray-200 text-gray-800" icon={<></>} onClick={() => setModalConfig({isOpen: true, data: modeFilteredData, title: 'All Requests'})} />
            </div>
        </div>
    }
  }

  const tabs = ['General', 'Restricted', 'Monitored', 'Pharmacy', 'IDS'];

  return (
    <div className="space-y-8">
      <ChartDetailModal isOpen={modalConfig.isOpen} onClose={handleModalClose} data={modalConfig.data} title={modalConfig.title} />
      
      {/* Unified Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-sm font-bold text-gray-600 mr-2">Patient Mode:</span>
            {(['All', 'adult', 'pediatric'] as const).map(mode => (
                <button key={mode} onClick={() => setModeFilter(mode)} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${modeFilter === mode ? 'bg-green-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
            ))}
        </div>
        <FilterControls 
            selectedMonth={selectedMonth}
            onMonthChange={onMonthChange}
            selectedYear={selectedYear}
            onYearChange={onYearChange}
        />
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>
          ))}
        </nav>
      </div>

      {renderDashboard()}

    </div>
  );
};

export default StatsChart;