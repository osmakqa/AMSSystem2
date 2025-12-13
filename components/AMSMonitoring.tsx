
import React, { useState, useEffect } from 'react';
import { MonitoringPatient, User } from '../types';
import { fetchMonitoringPatients, createMonitoringPatient } from '../services/dataService';
import MonitoringPatientCard from './MonitoringPatientCard';
import MonitoringDetailModal from './MonitoringDetailModal';
import { WARDS } from '../constants';

type TabType = 'Active' | 'Discharged' | 'Expired';

interface AMSMonitoringProps {
    user: User | null;
}

const AMSMonitoring: React.FC<AMSMonitoringProps> = ({ user }) => {
  const [currentTab, setCurrentTab] = useState<TabType>('Active');
  const [patients, setPatients] = useState<MonitoringPatient[]>([]);
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

  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    // Map tab to DB status
    const statusMap: Record<TabType, string> = {
        'Active': 'Admitted',
        'Discharged': 'Discharged',
        'Expired': 'Expired'
    };
    
    const { data, error } = await fetchMonitoringPatients(statusMap[currentTab]);
    
    if (error) {
        if (error === "Monitoring Table Missing") {
            setError("Database table 'monitoring_patients' missing. Please contact the administrator.");
        } else {
            console.error("Failed to load monitoring patients", error);
        }
        setPatients([]);
    } else {
        setPatients(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPatients();
  }, [currentTab]); // Reload when tab changes

  // Sync selectedPatient with updated patients list
  useEffect(() => {
    if (selectedPatient) {
      const updatedData = patients.find(p => p.id === selectedPatient.id);
      if (updatedData) {
        setSelectedPatient(updatedData);
      }
    }
  }, [patients]);

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
          if (currentTab === 'Active') loadPatients();
          else setCurrentTab('Active');
      } catch (e) {
          console.error(e);
          alert("Failed to add patient.");
      }
  };

  return (
    <div className="space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div>
                <h2 className="text-xl font-bold text-gray-800">AMS Monitoring Dashboard</h2>
                <p className="text-sm text-gray-500">Track active patients and antimicrobial therapy duration.</p>
            </div>
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Add Patient
            </button>
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
                {(['Active', 'Discharged', 'Expired'] as TabType[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setCurrentTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            currentTab === tab 
                            ? 'bg-white text-blue-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {tab} Patients
                    </button>
                ))}
            </div>

            {/* Filter */}
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
        </div>

        {/* Patient Grid */}
        {loading ? (
            <div className="text-center py-20 text-gray-500 flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading patients...
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
                loadPatients();
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
