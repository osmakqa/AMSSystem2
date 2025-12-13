
import React, { useState, useEffect, useMemo } from 'react';
import { MonitoringPatient, User } from '../types';
import { fetchMonitoringPatients, createMonitoringPatient, fetchAllMonitoringPatients } from '../services/dataService';
import MonitoringPatientCard from './MonitoringPatientCard';
import MonitoringDetailModal from './MonitoringDetailModal';
import { WARDS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


type TabType = 'Active' | 'Discharged' | 'Expired' | 'Data Analysis';

interface AMSMonitoringProps {
    user: User | null;
}

// Reusable UI Components for charts
const ChartWrapper = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 h-[350px] flex flex-col">
    <h3 className="text-sm font-bold text-gray-800 mb-4">{title}</h3>
    <div className="flex-grow w-full h-full">{children}</div>
  </div>
);

const KpiCard = ({ title, value, subValue, icon, color }: { title: string, value: string | number, subValue?: string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{title}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

const AMSMonitoring: React.FC<AMSMonitoringProps> = ({ user }) => {
  const [currentTab, setCurrentTab] = useState<TabType>('Active');
  const [patients, setPatients] = useState<MonitoringPatient[]>([]);
  const [analysisData, setAnalysisData] = useState<MonitoringPatient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<MonitoringPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [wardFilter, setWardFilter] = useState('All');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<MonitoringPatient | null>(null);

  // New Patient Form State
  const [newPatient, setNewPatient] = useState<Partial<MonitoringPatient>>({
      patient_name: '', hospital_number: '', ward: '', bed_number: '', 
      age: '', sex: '', date_of_admission: new Date().toISOString().split('T')[0],
      latest_creatinine: '', infectious_diagnosis: '', dialysis_status: 'No'
  });

  const loadPatientsForTab = async (tab: TabType) => {
    setLoading(true);
    setError(null);

    let result;
    if (tab === 'Data Analysis') {
        result = await fetchAllMonitoringPatients();
        if (result.error) {
            setError(result.error);
            setAnalysisData([]);
        } else {
            setAnalysisData(result.data);
        }
    } else {
        const statusMap: Record<TabType, string> = {
            'Active': 'Admitted',
            'Discharged': 'Discharged',
            'Expired': 'Expired',
            'Data Analysis': '' // Not used here
        };
        result = await fetchMonitoringPatients(statusMap[tab]);
        if (result.error) {
            setError(result.error);
            setPatients([]);
        } else {
            setPatients(result.data);
        }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadPatientsForTab(currentTab);
  }, [currentTab]);

  // Sync selectedPatient with updated patients list
  useEffect(() => {
    if (selectedPatient) {
      const updatedData = patients.find(p => p.id === selectedPatient.id);
      if (updatedData) {
        setSelectedPatient(updatedData);
      } else {
        // If patient status changed (e.g., discharged), they are no longer in the list.
        // We could close the modal or fetch them individually. For now, let's close it.
        const allPatientsForSync = currentTab === 'Data Analysis' ? analysisData : patients;
        const updatedPatientFromAll = allPatientsForSync.find(p => p.id === selectedPatient.id);
        if (updatedPatientFromAll) {
           setSelectedPatient(updatedPatientFromAll);
        } else {
           setSelectedPatient(null);
        }
      }
    }
  }, [patients, analysisData]);

  useEffect(() => {
    let result = patients;
    if (wardFilter !== 'All') result = result.filter(p => p.ward === wardFilter);
    setFilteredPatients(result);
  }, [patients, wardFilter]);

  const handleAddPatient = async () => {
      // Basic Validation
      if (!newPatient.patient_name || !newPatient.hospital_number || !newPatient.ward) {
          alert("Please fill required fields (Name, ID, Ward).");
          return;
      }
      
      // Auto-calc eGFR on add
      let egfr = "";
      if (newPatient.latest_creatinine && newPatient.age && newPatient.sex) {
          // Re-using basic logic
          const scr = parseFloat(newPatient.latest_creatinine) / 88.4;
          const age = parseFloat(newPatient.age);
          const k = newPatient.sex === "Female" ? 0.7 : 0.9;
          const alpha = newPatient.sex === "Female" ? -0.241 : -0.302;
          const minScr = Math.min(scr/k,1);
          const maxScr = Math.max(scr/k,1);
          const val = 142 * Math.pow(minScr,alpha) * Math.pow(maxScr,-1.2) * Math.pow(0.9938, age) * (newPatient.sex === "Female" ? 1.012 : 1);
          if (isFinite(val)) egfr = val.toFixed(1) + ' mL/min/1.73m²';
      }

      try {
          await createMonitoringPatient({
              ...newPatient,
              egfr,
              antimicrobials: [],
              status: 'Admitted',
              last_updated_by: user?.name
          });
          setIsAddModalOpen(false);
          setNewPatient({
            patient_name: '', hospital_number: '', ward: '', bed_number: '', 
            age: '', sex: '', date_of_admission: new Date().toISOString().split('T')[0],
            latest_creatinine: '', infectious_diagnosis: '', dialysis_status: 'No'
          });
          // Only reload if we are on Active tab, otherwise user won't see new patient immediately
          if (currentTab === 'Active') loadPatientsForTab('Active');
          else setCurrentTab('Active');
      } catch (e) {
          console.error(e);
          alert("Failed to add patient.");
      }
  };
  
  const analysisStats = useMemo(() => {
      if (analysisData.length === 0) return null;

      const activePatients = analysisData.filter(p => p.status === 'Admitted');
      const allAntimicrobials = analysisData.flatMap(p => p.antimicrobials);

      const activeDrugCounts = allAntimicrobials
          .filter(a => a.status === 'Active')
          .reduce((acc, drug) => {
              acc[drug.drug_name] = (acc[drug.drug_name] || 0) + 1;
              return acc;
          }, {} as Record<string, number>);

      const topActiveDrugs = Object.entries(activeDrugCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({ name, value }));

      const patientsByWard = activePatients.reduce((acc, patient) => {
          acc[patient.ward] = (acc[patient.ward] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);

      const topWards = Object.entries(patientsByWard)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, value]) => ({ name, value }));
      
      const completedTherapies = allAntimicrobials
          .filter(a => a.status === 'Completed' && a.completed_at && a.start_date);
      
      const therapyDurations = completedTherapies.map(a => {
          const start = new Date(a.start_date);
          const end = new Date(a.completed_at!);
          return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      });
      
      const avgTherapyDuration = therapyDurations.length > 0
          ? (therapyDurations.reduce((sum, d) => sum + d, 0) / therapyDurations.length).toFixed(1)
          : '0';

      return {
          totalActive: activePatients.length,
          totalDischarged: analysisData.filter(p => p.status === 'Discharged').length,
          totalExpired: analysisData.filter(p => p.status === 'Expired').length,
          avgTherapyDuration,
          topActiveDrugs,
          topWards,
      };
  }, [analysisData]);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];


  return (
    <div className="space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div>
                <h2 className="text-xl font-bold text-gray-800">AMS Monitoring Dashboard</h2>
                <p className="text-sm text-gray-500">Track active patients and antimicrobial therapy duration.</p>
            </div>
            {currentTab !== 'Data Analysis' && (
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Patient
                </button>
            )}
        </div>

        {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
                <p className="font-bold text-red-700">System Error</p>
                <p className="text-sm text-red-600">{error}</p>
            </div>
        )}

        {/* Tabs & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
                {(['Active', 'Discharged', 'Expired', 'Data Analysis'] as TabType[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setCurrentTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            currentTab === tab 
                            ? 'bg-white text-blue-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {tab === 'Data Analysis' ? 'Data Analysis' : `${tab} Patients`}
                    </button>
                ))}
            </div>

            {currentTab !== 'Data Analysis' && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-xs font-bold text-gray-500 uppercase pl-2">Filter Ward:</span>
                  <select 
                      value={wardFilter} 
                      onChange={(e) => setWardFilter(e.target.value)} 
                      className="border-none bg-transparent text-sm font-medium text-gray-800 focus:ring-0 cursor-pointer"
                  >
                      <option value="All">All Wards</option>
                      {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
              </div>
            )}
        </div>

        {/* Content Area */}
        {loading ? (
            <div className="text-center py-20 text-gray-500 flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading data...
            </div>
        ) : currentTab === 'Data Analysis' ? (
            <div className="space-y-6 animate-fade-in">
                {analysisStats ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="Active Patients" value={analysisStats.totalActive} color="bg-blue-100 text-blue-700" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>} />
                            <KpiCard title="Avg. Therapy Duration" value={`${analysisStats.avgTherapyDuration} days`} subValue="for completed therapies" color="bg-green-100 text-green-700" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>} />
                            <KpiCard title="Total Discharged" value={analysisStats.totalDischarged} color="bg-gray-100 text-gray-700" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" /></svg>} />
                            <KpiCard title="Total Expired" value={analysisStats.totalExpired} color="bg-red-100 text-red-700" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>} />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartWrapper title="Top 5 Active Antimicrobials">
                                <ResponsiveContainer>
                                    <BarChart data={analysisStats.topActiveDrugs} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" name="Count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartWrapper>
                            <ChartWrapper title="Active Patients by Ward">
                                <ResponsiveContainer>
                                    <BarChart data={analysisStats.topWards} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="value" name="Patients" fill="#10b981" radius={[4, 4, 0, 0]}>
                                            {analysisStats.topWards.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartWrapper>
                        </div>
                    </>
                ) : (
                     <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                        No data available for analysis.
                    </div>
                )}
            </div>
        ) : filteredPatients.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                No {currentTab.toLowerCase()} patients found for the selected ward.
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {filteredPatients.map(p => (
                    <MonitoringPatientCard 
                        key={p.id} 
                        patient={p} 
                        onClick={(patient) => setSelectedPatient(patient)} 
                    />
                ))}
            </div>
        )}

        {/* Details Modal */}
        <MonitoringDetailModal 
            isOpen={!!selectedPatient} 
            onClose={() => setSelectedPatient(null)} 
            patient={selectedPatient}
            user={user}
            onUpdate={() => {
                loadPatientsForTab(currentTab);
            }}
        />

        {/* Add Patient Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Add New Patient to Monitoring</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Patient Name</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.patient_name} onChange={e => setNewPatient({...newPatient, patient_name: e.target.value})} placeholder="Last, First" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Hospital ID</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.hospital_number} onChange={e => setNewPatient({...newPatient, hospital_number: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Date Admitted</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.date_of_admission} onChange={e => setNewPatient({...newPatient, date_of_admission: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Ward</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.ward} onChange={e => setNewPatient({...newPatient, ward: e.target.value})}>
                                <option value="">Select</option>
                                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Bed Number</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.bed_number} onChange={e => setNewPatient({...newPatient, bed_number: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Age</label>
                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Sex</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.sex} onChange={e => setNewPatient({...newPatient, sex: e.target.value})}>
                                <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">SCr (µmol/L)</label>
                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.latest_creatinine} onChange={e => setNewPatient({...newPatient, latest_creatinine: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Dialysis?</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.dialysis_status} onChange={e => setNewPatient({...newPatient, dialysis_status: e.target.value as any})}>
                                <option value="No">No</option><option value="Yes">Yes</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Infectious Disease Diagnosis</label>
                            <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" rows={2} value={newPatient.infectious_diagnosis} onChange={e => setNewPatient({...newPatient, infectious_diagnosis: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button onClick={handleAddPatient} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm transition-colors">Add Patient</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AMSMonitoring;
