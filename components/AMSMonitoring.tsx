
import React, { useState, useEffect, useMemo } from 'react';
import { MonitoringPatient, User, MonitoringAntimicrobial, AdminLogEntry, TransferLog, ChangeLogEntry } from '../types';
import { createMonitoringPatient, fetchAllMonitoringPatients, updateMonitoringPatient } from '../services/dataService';
import MonitoringDetailModal from './MonitoringDetailModal';
import { WARDS, MONITORED_DRUGS, RESTRICTED_DRUGS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


type ViewType = 'Patient List' | 'Data Analysis';

interface AMSMonitoringProps {
    user: User | null;
}

// --- CONSTANTS ---
const STOP_REASONS = [
    "De-escalation",
    "Adverse Event / Toxicity",
    "No Infection",
    "Clinical Failure",
    "Resistant Organism",
    "Palliative / Comfort Care",
    "Patient Discharged / Expired",
    "Others (Specify)"
];

const SHIFT_REASONS = [
    "IV to PO Switch",
    "Escalation (Broadening)",
    "De-escalation (Narrowing)",
    "Renal Adjustment",
    "Adverse Event",
    "Others (Specify)"
];

const DOSE_CHANGE_REASONS = [
    "Renal Adjustment",
    "Hepatic Adjustment",
    "Clinical Improvement (De-escalation)",
    "Clinical Worsening (Escalation)",
    "Adverse Event",
    "Source Control Achieved",
    "Others (Specify)"
];

const MISSED_REASONS = ["Stock Out", "Patient Refused", "NPO", "IV Access Issue", "Patient out of ward", "Others (Specify)"];

// --- SVG ICONS for HUD & Red Flags ---
const KpiIcon = ({ path }: { path: string }) => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">{path}</svg>;

// --- Action Icons for Disposition Column ---
const TransferIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
const DischargeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const ExpiredIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>;
const ReAdmitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

const KpiCard = ({ title, value, subValue, icon, iconColor, isActive, onClick }: { title: string, value: string | number, subValue?: string, icon: React.ReactNode, iconColor: string, isActive: boolean, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${isActive ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-200 shadow-md' : 'bg-white border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-300'}`}
    >
      <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${iconColor}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
      </div>
    </div>
);

// --- Helper Functions ---
const toLocalISO = (dateStr?: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

const normalizeLogEntry = (entry: string | AdminLogEntry): AdminLogEntry => {
    if (typeof entry === 'string') return { time: entry, status: 'Given' };
    return entry;
};

const calculateDoseBasedDuration = (drug: MonitoringAntimicrobial): string => {
  const totalDosesGiven = drug.administration_log 
    ? Object.values(drug.administration_log)
        .flat()
// @ts-ignore
        .filter((entry: string | AdminLogEntry) => normalizeLogEntry(entry).status === 'Given')
        .length
    : 0;

  if (totalDosesGiven === 0) return "0 doses";
  if (!drug.frequency_hours || drug.frequency_hours <= 0) return `${totalDosesGiven} doses`;
  const dosesPerDay = Math.max(1, Math.floor(24 / drug.frequency_hours));
  if (dosesPerDay <= 1) return `Day ${totalDosesGiven}`;
  
  const fullDays = Math.floor(totalDosesGiven / dosesPerDay);
  const extraDoses = totalDosesGiven % dosesPerDay;
  if (extraDoses === 0 && fullDays > 0) return `Day ${fullDays}`;
  if (fullDays === 0) return `${extraDoses} doses`;
  return `Day ${fullDays} + ${extraDoses}`;
};

const calculateDayOfTherapy = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) + 1;
};

const calculateDay = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    start.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = now.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays >= 0 ? diffDays + 1 : 1; 
};

const getMaxTherapyDays = (patient: MonitoringPatient) => {
    let maxDays = 0;
    patient.antimicrobials.forEach(drug => {
        if (drug.status === 'Active') {
             const days = calculateDayOfTherapy(drug.start_date);
             if (days > maxDays) maxDays = days;
        }
    });
    return maxDays;
};

const to12h = (time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
};

// --- Admin Log Helpers (for Expansion Row) ---
const getDatesForLog = (startDate: string, stopDate?: string) => {
    const dates = [];
    const start = new Date(startDate);
    const end = stopDate ? new Date(stopDate) : new Date();
    start.setHours(0,0,0,0);
    const endLoop = new Date(end);
    endLoop.setHours(0,0,0,0);
    
    const safeStart = new Date(endLoop);
    safeStart.setDate(safeStart.getDate() - 30);
    const loopStart = start > safeStart ? start : safeStart;

    for (let dt = new Date(loopStart); dt <= endLoop; dt.setDate(dt.getDate() + 1)) {
        dates.push(new Date(dt));
    }
    return dates; 
};

const getDayNumber = (startDate: string, targetDate: Date) => {
    const start = new Date(startDate);
    start.setHours(0,0,0,0);
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays + 1 : 1;
};

// --- Grid Log Modal Component (Replaces Popover) ---
interface GridLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (time: string, status: 'Given' | 'Missed', reason?: string) => void;
    defaultTime: string;
    drugName: string;
    dateStr: string;
    doseLabel: string;
}

const GridLogModal: React.FC<GridLogModalProps> = ({ isOpen, onClose, onSave, defaultTime, drugName, dateStr, doseLabel }) => {
    const [time, setTime] = useState(defaultTime);
    const [status, setStatus] = useState<'Given' | 'Missed'>('Given');
    const [reason, setReason] = useState('');
    const [otherReason, setOtherReason] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        if (status === 'Given' && !time) {
            alert("Time is required");
            return;
        }
        if (status === 'Missed' && !reason) {
            alert("Reason is required");
            return;
        }
        const finalReason = reason === 'Others (Specify)' ? otherReason : reason;
        if (status === 'Missed' && reason === 'Others (Specify)' && !finalReason) {
            alert("Please specify the reason.");
            return;
        }
        onSave(to12h(time), status, finalReason);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[160] p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                <div className="bg-blue-600 px-6 py-4 border-b border-blue-700 flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-white text-lg">{drugName}</h3>
                        <p className="text-blue-100 text-sm mt-1">{doseLabel} • {new Date(dateStr).toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="text-blue-200 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                
                <div className="p-6 space-y-5">
                    {/* Status Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setStatus('Given')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${status === 'Given' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Given</button>
                        <button onClick={() => setStatus('Missed')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${status === 'Missed' ? 'bg-white text-red-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Missed</button>
                    </div>

                    {status === 'Given' ? (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Administration Time</label>
                            <input type="time" className="w-full border rounded-lg px-3 py-2 text-base text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={time} onChange={(e) => setTime(e.target.value)} autoFocus />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Reason for Missed Dose</label>
                                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-red-500 outline-none" value={reason} onChange={(e) => setReason(e.target.value)}>
                                    <option value="">Select Reason...</option>
                                    {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {reason === 'Others (Specify)' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Specify Reason</label>
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 outline-none" placeholder="Enter reason..." value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-100">Cancel</button>
                    <button onClick={handleSave} className={`px-4 py-2 text-white rounded-lg text-sm font-bold shadow-sm transition-colors ${status === 'Given' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        {status === 'Given' ? 'Log Dose' : 'Log Missed'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Edit Drug Modal Component ---
interface EditDrugModalProps {
    drug: MonitoringAntimicrobial;
    onSave: (updatedDrug: MonitoringAntimicrobial) => void;
    onClose: () => void;
}

const EditDrugModal: React.FC<EditDrugModalProps> = ({ drug, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<MonitoringAntimicrobial>>(drug);
    const [freqInput, setFreqInput] = useState(drug.frequency_hours ? drug.frequency_hours.toString() : '');

    const handleSave = () => {
        if (!formData.drug_name || !formData.dose) {
            alert("Drug Name and Dose are required");
            return;
        }
        const updated: MonitoringAntimicrobial = {
            ...drug,
            ...formData,
            frequency_hours: parseInt(freqInput),
            frequency: `Every ${freqInput} hours`
        } as MonitoringAntimicrobial;
        onSave(updated);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[160] p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">Rx</span>
                        Edit Antimicrobial
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Drug Name</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.drug_name} onChange={e => setFormData({...formData, drug_name: e.target.value})} list="drugs" />
                            <datalist id="drugs">{[...MONITORED_DRUGS, ...RESTRICTED_DRUGS].sort().map(d => <option key={d} value={d} />)}</datalist>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Dose</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.dose} onChange={e => setFormData({...formData, dose: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Route</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white [color-scheme:light]" value={formData.route} onChange={e => setFormData({...formData, route: e.target.value})}>
                                <option value="IV">IV</option><option value="PO">PO</option><option value="IM">IM</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Freq (Hours)</label>
                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={freqInput} onChange={e => setFreqInput(e.target.value)} placeholder="e.g. 8" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Start Date</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm [color-scheme:light]" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Plan (Days)</label>
                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.planned_duration} onChange={e => setFormData({...formData, planned_duration: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Resident</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.requesting_resident} onChange={e => setFormData({...formData, requesting_resident: e.target.value})} />
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

// --- Expansion Row Component ---
interface ExpansionRowProps {
    patient: MonitoringPatient;
    onAddLog: (patientId: number, drugId: string, dateStr: string, time: string, status: 'Given' | 'Missed', reason?: string) => Promise<void>;
    onViewFullSheet: () => void;
    onStatusAction: (drugId: string, action: 'Stopped' | 'Completed' | 'Shifted' | 'Continue' | 'Dose Change') => void;
    onSensitivityAction: (drug: MonitoringAntimicrobial) => void;
    onEditDrug: (drug: MonitoringAntimicrobial) => void;
}
const ExpansionRow: React.FC<ExpansionRowProps> = ({ patient, onAddLog, onViewFullSheet, onStatusAction, onSensitivityAction, onEditDrug }) => {
    const activeDrugs = patient.antimicrobials.filter(drug => drug.status === 'Active');
    const [selectedSlot, setSelectedSlot] = useState<{ drugId: string, dateStr: string, drugName: string, doseLabel: string } | null>(null);

    const handleLogSave = async (time: string, status: 'Given' | 'Missed', reason?: string) => {
        if (selectedSlot) {
            await onAddLog(patient.id, selectedSlot.drugId, selectedSlot.dateStr, time, status, reason);
            setSelectedSlot(null);
        }
    };

    const actionBtnClass = "w-24 py-1.5 rounded text-[10px] font-bold transition-all border-2 shadow-sm text-center flex items-center justify-center hover:shadow-md hover:-translate-y-0.5 active:translate-y-0";

    return (
        <div className="p-4 bg-slate-50 border-t-2 border-blue-200 animate-fade-in relative shadow-inner">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-sm text-gray-700">Active Therapies & Quick Actions</h4>
                <button 
                    onClick={onViewFullSheet} 
                    className="bg-white border-2 border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1 hover:shadow-md"
                >
                    View Full Details
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
            </div>

            {activeDrugs.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4">No active antimicrobials to log.</p>}

            <div className="space-y-6 overflow-x-auto pb-2">
                {activeDrugs.map(drug => {
                    const dates = getDatesForLog(drug.start_date, drug.stop_date || drug.completed_at || drug.shifted_at).sort((a, b) => a.getTime() - b.getTime());
                    const slots = drug.frequency_hours ? Math.max(1, Math.floor(24 / drug.frequency_hours)) : 1;
                    const slotIndices = Array.from({length: slots}, (_, i) => i);
                    
                    const plannedDays = parseInt(drug.planned_duration || '0');
                    const canContinue = calculateDay(drug.start_date) >= plannedDays;

                    return (
                        <div key={drug.id} className="min-w-max">
                            <div className="flex items-center gap-4 mb-2 sticky left-0 bg-slate-50 z-10 py-1">
                                <h5 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                                    {drug.drug_name}
                                    <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">{drug.dose} {drug.route} {drug.frequency}</span>
                                </h5>
                                
                                {/* Quick Actions Toolbar */}
                                <div className="flex items-center gap-2">
                                    <button onClick={() => onEditDrug(drug)} className={`w-auto px-3 py-1.5 rounded text-[10px] font-bold transition-all border-2 shadow-sm text-center flex items-center justify-center hover:shadow-md hover:-translate-y-0.5 bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300 gap-1`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                        Edit Details
                                    </button>
                                    <div className="h-4 w-px bg-gray-300 mx-1"></div>
                                    <button onClick={() => onStatusAction(drug.id, 'Dose Change')} className={`${actionBtnClass} bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200`}>Dose Change</button>
                                    <button onClick={() => onStatusAction(drug.id, 'Shifted')} className={`${actionBtnClass} bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200`}>Shift</button>
                                    {canContinue && <button onClick={() => onStatusAction(drug.id, 'Continue')} className={`${actionBtnClass} bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200`}>Continue</button>}
                                    <button onClick={() => onStatusAction(drug.id, 'Completed')} className={`${actionBtnClass} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200`}>Complete</button>
                                    <button onClick={() => onStatusAction(drug.id, 'Stopped')} className={`${actionBtnClass} bg-red-50 text-red-700 hover:bg-red-100 border-red-200`}>Stop</button>
                                    <button 
                                        onClick={() => onSensitivityAction(drug)} 
                                        className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:text-indigo-700 border-2 border-indigo-200 shadow-sm flex items-center justify-center transition-all hover:shadow-md"
                                        title="Sensitivity Data"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a4 4 0 00-2.17-.102l1.027-1.028A3 3 0 009 8.172zM11.332 14.21a2.001 2.001 0 01-2.664 0l-.133-.089a2 2 0 00-2.223.036l-.372.248C5.232 14.877 5.727 16 6.586 16h6.828c.859 0 1.354-1.123.646-1.595l-.372-.248a2 2 0 00-2.223-.036l-.133.089z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-2 bg-gray-100 border-b border-r border-gray-200 sticky left-0 z-10 w-[50px] text-center font-bold text-gray-500">#</th>
                                            {dates.map(dateObj => {
                                                const dayNum = getDayNumber(drug.start_date, dateObj);
                                                return (
                                                    <th key={dateObj.toISOString()} className="p-2 bg-gray-50 border-b border-r border-gray-200 min-w-[70px] text-center">
                                                        <div className="font-bold text-gray-700">D{dayNum}</div>
                                                        <div className="text-[9px] text-gray-400 font-normal uppercase">{dateObj.toLocaleDateString('en-US', {month:'short', day:'numeric'})}</div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {slotIndices.map(slotIdx => (
                                            <tr key={slotIdx}>
                                                <td className="p-2 bg-gray-50 border-r border-b border-gray-200 sticky left-0 z-10 font-bold text-gray-500 text-center text-[10px]">
                                                    Dose {slotIdx + 1}
                                                </td>
                                                {dates.map(dateObj => {
                                                    const dateStr = dateObj.toISOString().split('T')[0];
                                                    const logs = drug.administration_log?.[dateStr] || [];
                                                    const entry = logs[slotIdx];
                                                    const logData = entry ? normalizeLogEntry(entry) : null;
                                                    
                                                    return (
                                                        <td key={dateStr} className="p-1 border-r border-b border-gray-100 text-center align-middle hover:bg-blue-50 transition-colors relative">
                                                            {logData ? (
                                                                <div className="flex flex-col items-center justify-center min-h-[28px]">
                                                                    {logData.status === 'Missed' ? (
                                                                        <span className="text-base leading-none" title={logData.reason || 'Missed'}>❌</span>
                                                                    ) : (
                                                                        <>
                                                                            <span className="text-base leading-none text-green-500">✅</span>
                                                                            <span className="text-[9px] font-mono text-gray-600 leading-tight">{logData.time}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => setSelectedSlot({ 
                                                                        drugId: drug.id, 
                                                                        dateStr,
                                                                        drugName: drug.drug_name,
                                                                        doseLabel: `Dose ${slotIdx + 1}`
                                                                    })} 
                                                                    className="w-full h-full min-h-[28px] rounded hover:bg-blue-100 text-gray-300 hover:text-blue-500 flex items-center justify-center transition-colors"
                                                                >
                                                                    <span className="text-base leading-none">+</span>
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Grid Log Modal Triggered by Cell Click */}
            {selectedSlot && (
                <GridLogModal 
                    isOpen={!!selectedSlot}
                    onClose={() => setSelectedSlot(null)}
                    onSave={handleLogSave}
                    defaultTime={new Date().toTimeString().slice(0, 5)}
                    drugName={selectedSlot.drugName}
                    dateStr={selectedSlot.dateStr}
                    doseLabel={selectedSlot.doseLabel}
                />
            )}
        </div>
    );
}


const AMSMonitoring: React.FC<AMSMonitoringProps> = ({ user }) => {
  const [currentView, setCurrentView] = useState<ViewType>('Patient List');
  const [patients, setPatients] = useState<MonitoringPatient[]>([]);
  const [analysisData, setAnalysisData] = useState<MonitoringPatient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<MonitoringPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('Admitted');
  const [wardFilter, setWardFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth());
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Replaces redFlagFilterActive with robust KPI filter
  const [kpiFilter, setKpiFilter] = useState<'All' | 'RedFlag' | 'New' | 'NearingStop'>('All');

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof MonitoringPatient | 'days_on_therapy', direction: 'asc' | 'desc' }>({ key: 'patient_name', direction: 'asc' });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<MonitoringPatient | null>(null);
  const [adminModal, setAdminModal] = useState<{ isOpen: boolean; patientId: number; drugId: string; dateStr: string; } | null>(null); 
  const [adminTime, setAdminTime] = useState('');
  const [adminStatus, setAdminStatus] = useState<'Given' | 'Missed'>('Given');
  const [adminMissReason, setAdminMissReason] = useState('');
  const [adminMissReasonOther, setAdminMissReasonOther] = useState('');
  const [dispositionAction, setDispositionAction] = useState<{
    patient: MonitoringPatient;
    action: 'Discharge' | 'Expire' | 'Re-admit';
  } | null>(null);
  const [transferAction, setTransferAction] = useState<{ patient: MonitoringPatient } | null>(null);
  const [transferInputs, setTransferInputs] = useState({ to_ward: '', to_bed: '', date: '' });
  
  // Expanded Row State
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Status Change Logic State (Lifted from Modal)
  const [statusAction, setStatusAction] = useState<{
      type: 'Stopped' | 'Completed' | 'Shifted' | 'Continue' | 'Dose Change';
      drugId: string;
      patientId: number; // Need patient ID for row actions
      isOpen: boolean;
  } | null>(null);
  const [actionDateTime, setActionDateTime] = useState('');
  const [statusReasonType, setStatusReasonType] = useState('');
  const [statusReasonText, setStatusReasonText] = useState('');
  const [continueResident, setContinueResident] = useState('');
  const [newDoseValue, setNewDoseValue] = useState('');

  // Sensitivity State (Lifted)
  const [sensitivityModal, setSensitivityModal] = useState<{
      isOpen: boolean;
      drugId: string;
      patientId: number;
      info: string;
      date: string;
  } | null>(null);

  // Edit Drug Modal State
  const [drugToEdit, setDrugToEdit] = useState<{ patientId: number, drug: MonitoringAntimicrobial } | null>(null);

  // Edit Patient State
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);

  const initialNewPatientState: Partial<MonitoringPatient> = {
      patient_name: '', hospital_number: '', ward: '', bed_number: '', 
      age: '', sex: '', date_of_admission: new Date().toISOString().split('T')[0],
      latest_creatinine: '', infectious_diagnosis: '', dialysis_status: 'No'
  };
  const [newPatient, setNewPatient] = useState<Partial<MonitoringPatient>>(initialNewPatientState);

  // ... (ChartWrapper, NoDataDisplay, CustomTooltip, DataList components - same as before) ...
  const ChartWrapper = ({ title, children }: { title: string, children: React.ReactNode }) => (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-[350px] flex flex-col">
        <h3 className="text-md font-bold text-gray-800 mb-4">{title}</h3>
        <div className="flex-grow w-full h-full">{children}</div>
      </div>
  );
  const NoDataDisplay = () => <div className="flex items-center justify-center h-full text-gray-400">No data available for this period.</div>;
  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700 text-sm">
            <p className="font-bold mb-1">{label}</p>
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span>{`${entry.name}: ${entry.value}`}</span>
              </div>
            ))}
          </div>
        );
      }
      return null;
  };

  const DataList = ({ title, data, color, icon }: { title: string, data: { name: string, value: number }[], color: string, icon: React.ReactNode }) => (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-[350px] flex flex-col">
          <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
              <h3 className="text-md font-bold text-gray-800">{title}</h3>
          </div>
          <div className="space-y-3 overflow-y-auto">
              {data.length > 0 ? data.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                      <span className="text-sm font-medium text-gray-700 truncate">{index + 1}. {item.name}</span>
                      <span className={`text-sm font-bold text-white px-2 py-0.5 rounded-full ${color}`}>{item.value}</span>
                  </div>
              )) : <NoDataDisplay />}
          </div>
      </div>
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchAllMonitoringPatients();
    if (result.error) {
        setError(result.error);
        setPatients([]);
        setAnalysisData([]);
    } else {
        setPatients(result.data);
        setAnalysisData(result.data); 
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedPatient) {
      const updatedData = patients.find(p => p.id === selectedPatient.id);
      if (updatedData) setSelectedPatient(updatedData);
      else setSelectedPatient(null);
    }
  }, [patients]);
  
  const getRedFlagStatus = (patient: MonitoringPatient) => {
    const hasMissedDoses = patient.antimicrobials.some(drug => 
      Object.values(drug.administration_log || {}).flat().some(entry => normalizeLogEntry(entry).status === 'Missed')
    );
    const hasRenalAlert = patient.egfr && parseFloat(patient.egfr) < 30;
    const hasProlongedTherapy = patient.antimicrobials.some(drug => 
      drug.status === 'Active' && calculateDayOfTherapy(drug.start_date) > 14
    );
    return { hasMissedDoses, hasRenalAlert, hasProlongedTherapy };
  };

  const kpiStats = useMemo(() => {
    const active = patients.filter(p => p.status === 'Admitted');
    const redFlagPatients = active.filter(p => {
        const flags = getRedFlagStatus(p);
        return flags.hasMissedDoses || flags.hasRenalAlert || flags.hasProlongedTherapy;
    });
    const newPatients = active.filter(p => p.created_at && (new Date().getTime() - new Date(p.created_at).getTime()) < 24 * 60 * 60 * 1000);
    const nearingCompletion = active.filter(p => p.antimicrobials.some(drug => {
        if (!drug.planned_duration || drug.status !== 'Active') return false;
        const planned = parseInt(drug.planned_duration);
        const currentDay = calculateDayOfTherapy(drug.start_date);
        return planned > 0 && planned - currentDay <= 2;
    }));
    return {
      activeCount: active.length,
      redFlagCount: redFlagPatients.length,
      newCount: newPatients.length,
      nearingStopCount: nearingCompletion.length,
    };
  }, [patients]);

  useEffect(() => {
    let result = patients;
    
    // 1. Apply KPI Filter
    if (kpiFilter === 'RedFlag') {
      result = result.filter(p => {
        const flags = getRedFlagStatus(p);
        return flags.hasMissedDoses || flags.hasRenalAlert || flags.hasProlongedTherapy;
      });
    } else if (kpiFilter === 'New') {
        result = result.filter(p => p.created_at && (new Date().getTime() - new Date(p.created_at).getTime()) < 24 * 60 * 60 * 1000);
    } else if (kpiFilter === 'NearingStop') {
        result = result.filter(p => p.antimicrobials.some(drug => {
            if (!drug.planned_duration || drug.status !== 'Active') return false;
            const planned = parseInt(drug.planned_duration);
            const currentDay = calculateDayOfTherapy(drug.start_date);
            return planned > 0 && planned - currentDay <= 2;
        }));
    }

    // 2. Search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.patient_name.toLowerCase().includes(lowerQuery) || 
        p.hospital_number.toLowerCase().includes(lowerQuery)
      );
    }
    
    // 3. Status Filter (from Dropdown)
    result = result.filter(p => p.status === statusFilter);
    
    // 4. Month/Year (History)
    if (statusFilter !== 'Admitted') {
        result = result.filter(p => {
            if (!p.discharged_at) return false;
            const eventDate = new Date(p.discharged_at);
            const monthMatch = monthFilter === -1 || eventDate.getMonth() === monthFilter;
            const yearMatch = yearFilter === 0 || eventDate.getFullYear() === yearFilter;
            return monthMatch && yearMatch;
        });
    }
    
    // 5. Ward Filter
    if (wardFilter !== 'All') result = result.filter(p => p.ward === wardFilter);
    
    setFilteredPatients(result);
  }, [patients, wardFilter, statusFilter, monthFilter, yearFilter, searchQuery, kpiFilter]);

  // Sorting Logic
  const sortedPatients = useMemo(() => {
    let sortableItems = [...filteredPatients];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'days_on_therapy') {
             aValue = getMaxTherapyDays(a);
             bValue = getMaxTherapyDays(b);
        } else {
             aValue = a[sortConfig.key];
             bValue = b[sortConfig.key];
        }

        // Handle string comparison case-insensitively
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredPatients, sortConfig]);

  const requestSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: any) => {
    if (sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };


  const handleAddPatient = async () => {
    if (!newPatient.patient_name || !newPatient.hospital_number || !newPatient.ward || !newPatient.age || !newPatient.sex || !newPatient.date_of_admission) {
        alert("Please fill all required fields: Name, Hospital No, Ward, Age, Sex, and Admission Date.");
        return;
    }
    setLoading(true);
    try {
        if (editingPatientId) {
            // Update Existing
            await updateMonitoringPatient(editingPatientId, {
                ...newPatient,
                last_updated_by: user?.name
            });
            alert("Patient details updated successfully.");
        } else {
            // Create New
            const payload: Partial<MonitoringPatient> = {
                ...newPatient,
                status: 'Admitted',
                antimicrobials: [],
                transfer_history: [],
                last_updated_by: user?.name
            };
            await createMonitoringPatient(payload);
            alert("Patient added successfully.");
        }
        
        setIsAddModalOpen(false);
        setNewPatient(initialNewPatientState);
        setEditingPatientId(null);
        loadData();
    } catch (e: any) {
        setError(e.message);
        alert(`Failed to save patient: ${e.message}`);
    } finally {
        setLoading(false);
    }
  };

  const openEditPatientModal = (patient: MonitoringPatient) => {
      setNewPatient({
          patient_name: patient.patient_name,
          hospital_number: patient.hospital_number,
          ward: patient.ward,
          bed_number: patient.bed_number,
          age: patient.age,
          sex: patient.sex,
          date_of_admission: patient.date_of_admission,
          latest_creatinine: patient.latest_creatinine,
          dialysis_status: patient.dialysis_status,
          infectious_diagnosis: patient.infectious_diagnosis,
          egfr: patient.egfr // Optional to carry over, though usually re-calc'd on update if needed
      });
      setEditingPatientId(patient.id);
      setIsAddModalOpen(true);
  };
  
  const updatePatientLog = async (patientId: number, drugId: string, dateStr: string, time: string, status: 'Given' | 'Missed', reason?: string) => {
    setLoading(true);
    try {
        const patientToUpdate = patients.find(p => p.id === patientId);
        if (!patientToUpdate) throw new Error("Patient not found");

        const updatedAntimicrobials = patientToUpdate.antimicrobials.map(drug => {
            if (drug.id === drugId) {
                const newLogEntry: AdminLogEntry = {
                    time: status === 'Given' ? time : '',
                    status: status,
                    reason: status === 'Missed' ? reason : undefined
                };

                const existingLog = drug.administration_log || {};
                const dayLog = [...(existingLog[dateStr] || [])];
                dayLog.push(newLogEntry);

                return {
                    ...drug,
                    administration_log: {
                        ...existingLog,
                        [dateStr]: dayLog
                    }
                };
            }
            return drug;
        });

        await updateMonitoringPatient(patientToUpdate.id, {
            antimicrobials: updatedAntimicrobials,
            last_updated_by: user?.name
        });
        
        loadData();
    } catch (e: any) {
        setError(e.message);
        alert(`Failed to save log: ${e.message}`);
    } finally {
        setLoading(false);
    }
  };

  const handleOpenAdminModal = (patientId: number, drugId: string, dateStr: string) => { 
    setAdminModal({ isOpen: true, patientId, drugId, dateStr }); 
  };
  
  const resetAdminModalState = () => {
    setAdminTime('');
    setAdminStatus('Given');
    setAdminMissReason('');
    setAdminMissReasonOther('');
  };

  const handleAdminLogSave = async () => {
    if (!adminModal) return;
    if (adminStatus === 'Given' && !adminTime) {
        alert("Please enter the time of administration.");
        return;
    }
    if (adminStatus === 'Missed' && !adminMissReason) {
        alert("Please select a reason for the missed dose.");
        return;
    }
    const finalReason = adminMissReason === 'Others (Specify)' ? adminMissReasonOther : adminMissReason;
    if (adminStatus === 'Missed' && adminMissReason === 'Others (Specify)' && !finalReason) {
        alert("Please specify the reason for the missed dose.");
        return;
    }

    await updatePatientLog(adminModal.patientId, adminModal.drugId, adminModal.dateStr, to12h(adminTime), adminStatus, finalReason);
    setAdminModal(null);
    resetAdminModalState();
    alert("Administration log updated.");
  };
  
  const confirmDisposition = async () => {
    if (!dispositionAction) return;
    setLoading(true);
    try {
      let updates: Partial<MonitoringPatient> = {};
      if (dispositionAction.action === 'Re-admit') {
        updates = { status: 'Admitted', discharged_at: null, last_updated_by: user?.name };
      } else {
        updates = {
          status: dispositionAction.action === 'Discharge' ? 'Discharged' : 'Expired',
          discharged_at: new Date().toISOString(),
          last_updated_by: user?.name
        };
      }
      await updateMonitoringPatient(dispositionAction.patient.id, updates);
      await loadData(); 
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    } finally {
      setLoading(false);
      setDispositionAction(null);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferAction || !transferInputs.to_ward || !transferInputs.to_bed || !transferInputs.date) {
        alert("Please fill all transfer details: Ward, Bed, and Date/Time.");
        return;
    }
    setLoading(true);
    try {
        const patientToUpdate = transferAction.patient;
        const newLog: TransferLog = {
            date: new Date(transferInputs.date).toISOString(),
            from_ward: patientToUpdate.ward,
            to_ward: transferInputs.to_ward,
            from_bed: patientToUpdate.bed_number,
            to_bed: transferInputs.to_bed
        };
        const newHistory = [...(patientToUpdate.transfer_history || []), newLog];
        const updates: Partial<MonitoringPatient> = {
            ward: transferInputs.to_ward,
            bed_number: transferInputs.to_bed,
            transfer_history: newHistory,
            last_updated_by: user?.name
        };
        await updateMonitoringPatient(patientToUpdate.id, updates);
        await loadData(); 
        alert("Patient transferred successfully.");
    } catch (e: any) {
        alert(`Transfer failed: ${e.message}`);
    } finally {
        setLoading(false);
        setTransferAction(null);
    }
  };

  // --- Handlers for Lifted State Logic (Row Actions) ---
  const initiateStatusChange = (drugId: string, patientId: number, type: 'Stopped' | 'Completed' | 'Shifted' | 'Continue' | 'Dose Change') => {
      setActionDateTime(toLocalISO());
      setStatusReasonType('');
      setStatusReasonText('');
      setContinueResident('');
      setNewDoseValue('');
      setStatusAction({ type, drugId, patientId, isOpen: true });
  };

  const confirmStatusChange = async () => {
      if (!statusAction || !actionDateTime) return;
      const patient = patients.find(p => p.id === statusAction.patientId);
      if (!patient) return;

      let finalReason = "";
      if (['Stopped', 'Shifted', 'Dose Change'].includes(statusAction.type)) {
          if (!statusReasonType) {
              alert("Please select a reason.");
              return;
          }
          finalReason = statusReasonType === 'Others (Specify)' ? statusReasonText : statusReasonType;
      }
      
      if (statusAction.type === 'Dose Change' && !newDoseValue.trim()) { alert("Enter new dose."); return; }
      if (statusAction.type === 'Continue' && !continueResident.trim()) { alert("Please enter resident name."); return; }

      setLoading(true);
      try {
        const updatedList = patient.antimicrobials.map(d => {
            if (d.id === statusAction.drugId) {
                if (statusAction.type === 'Dose Change') {
                    const newLog: ChangeLogEntry = {
                        date: actionDateTime,
                        type: 'Dose Change',
                        oldValue: d.dose,
                        newValue: newDoseValue,
                        reason: finalReason
                    };
                    return { ...d, dose: newDoseValue, change_history: [...(d.change_history || []), newLog] };
                }
                else if (statusAction.type === 'Continue') {
                    return { ...d, requesting_resident: continueResident };
                } else {
                    const extraFields: any = {};
                    if (statusAction.type === 'Stopped') {
                        extraFields.stop_date = actionDateTime;
                        extraFields.stop_reason = finalReason;
                    }
                    if (statusAction.type === 'Completed') extraFields.completed_at = actionDateTime;
                    if (statusAction.type === 'Shifted') {
                        extraFields.shifted_at = actionDateTime;
                        extraFields.shift_reason = finalReason;
                    }
                    return { ...d, status: statusAction.type, ...extraFields } as MonitoringAntimicrobial;
                }
            }
            return d;
        });

        await updateMonitoringPatient(patient.id, { antimicrobials: updatedList, last_updated_by: user?.name });
        setStatusAction(null);
        loadData();
      } catch (err: any) {
          alert("Error: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const openSensitivityModal = (drug: MonitoringAntimicrobial, patientId: number) => {
      setSensitivityModal({
          isOpen: true,
          drugId: drug.id,
          patientId: patientId,
          info: drug.sensitivity_info || '',
          date: drug.sensitivity_date || new Date().toISOString().split('T')[0]
      });
  };

  const saveSensitivity = async () => {
      if (!sensitivityModal) return;
      const patient = patients.find(p => p.id === sensitivityModal.patientId);
      if(!patient) return;

      setLoading(true);
      try {
        const updatedList = patient.antimicrobials.map(d => {
            if (d.id === sensitivityModal.drugId) {
                return { ...d, sensitivity_info: sensitivityModal.info, sensitivity_date: sensitivityModal.date };
            }
            return d;
        });
        await updateMonitoringPatient(patient.id, { antimicrobials: updatedList, last_updated_by: user?.name });
        setSensitivityModal(null);
        loadData();
      } catch (err: any) {
          alert("Error: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  // --- Handlers for Editing Drugs ---
  const handleSaveEditedDrug = async (updatedDrug: MonitoringAntimicrobial) => {
      if (!drugToEdit) return;
      setLoading(true);
      try {
          const patient = patients.find(p => p.id === drugToEdit.patientId);
          if (!patient) throw new Error("Patient not found");

          const updatedList = patient.antimicrobials.map(d => d.id === updatedDrug.id ? updatedDrug : d);
          await updateMonitoringPatient(patient.id, { antimicrobials: updatedList, last_updated_by: user?.name });
          setDrugToEdit(null);
          loadData();
      } catch (err: any) {
          alert("Error updating drug: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  
  const analysisStats = useMemo(() => {
    if (!analysisData || analysisData.length === 0) {
        return { topDrugs: [], discontinuationReasons: [], durationDistribution: [], missedDosesByDrug: [] };
    }
    const allAntimicrobials = analysisData.flatMap(p => p.antimicrobials);
    const drugCounts = allAntimicrobials.reduce((acc, drug) => { acc[drug.drug_name] = (acc[drug.drug_name] || 0) + 1; return acc; }, {} as Record<string, number>);
    const topDrugs = Object.entries(drugCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, value]) => ({ name, value }));
    const reasonCounts = allAntimicrobials.filter(drug => drug.stop_reason || drug.shift_reason).reduce((acc, drug) => {
            const reason = drug.stop_reason || drug.shift_reason;
            if (reason) { const normalizedReason = reason.toLowerCase().includes('others') ? 'Others' : reason; acc[normalizedReason] = (acc[normalizedReason] || 0) + 1; }
            return acc;
        }, {} as Record<string, number>);
    const discontinuationReasons = Object.entries(reasonCounts).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
    const durationBuckets = { '1-3 Days': 0, '4-7 Days': 0, '8-14 Days': 0, '> 14 Days': 0 };
    allAntimicrobials.filter(drug => drug.status !== 'Active' && (drug.stop_date || drug.completed_at || drug.shifted_at)).forEach(drug => {
            const start = new Date(drug.start_date);
            const end = new Date(drug.stop_date || drug.completed_at || drug.shifted_at!);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (duration < 1) return;
            if (duration <= 3) durationBuckets['1-3 Days']++;
            else if (duration <= 7) durationBuckets['4-7 Days']++;
            else if (duration <= 14) durationBuckets['8-14 Days']++;
            else durationBuckets['> 14 Days']++;
        });
    const durationDistribution = Object.entries(durationBuckets).map(([name, value]) => ({ name, value }));
    const missedDoseCounts = allAntimicrobials.reduce((acc, drug) => {
// @ts-ignore
        const missedCount = Object.values(drug.administration_log || {}).flat().filter(entry => normalizeLogEntry(entry).status === 'Missed').length;
        if (missedCount > 0) { acc[drug.drug_name] = (acc[drug.drug_name] || 0) + missedCount; }
        return acc;
    }, {} as Record<string, number>);
    const missedDosesByDrug = Object.entries(missedDoseCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, value]) => ({ name, value }));
    return { topDrugs, discontinuationReasons, durationDistribution, missedDosesByDrug };
}, [analysisData]);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Command Bar Components
  const CommandBar = () => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYearValue = new Date().getFullYear();
    const years = Array.from({length: 5}, (_, i) => currentYearValue - i);

    return (
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col lg:flex-row items-center gap-3">
                {/* Search & Filters (Left) */}
                <div className="flex flex-wrap items-center gap-3 w-full flex-1">
                    {/* Search */}
                    <div className="relative flex-grow min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search Patient..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Status Filter */}
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)} 
                        className="py-2 pl-3 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] cursor-pointer"
                    >
                        <option value="Admitted">Active</option>
                        <option value="Discharged">Discharged</option>
                        <option value="Expired">Expired</option>
                    </select>

                    {/* Conditional Month/Year Filters */}
                    {statusFilter !== 'Admitted' && (
                        <>
                            <select value={monthFilter} onChange={(e) => setMonthFilter(parseInt(e.target.value))} className="py-2 pl-3 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light]">
                                <option value={-1}>All Months</option>
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select value={yearFilter} onChange={(e) => setYearFilter(parseInt(e.target.value))} className="py-2 pl-3 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light]">
                                <option value={0}>All Years</option>
                                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </>
                    )}

                    {/* Ward Filter */}
                    <select 
                        value={wardFilter} 
                        onChange={(e) => setWardFilter(e.target.value)} 
                        className="py-2 pl-3 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] cursor-pointer max-w-[150px] truncate"
                    >
                        <option value="All">All Wards</option>
                        {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>

                {/* View Toggle (Right Side - pushed by auto margins if needed, or just flex order) */}
                <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 ml-auto">
                    <button 
                        onClick={() => setCurrentView('Patient List')} 
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${currentView === 'Patient List' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        List
                    </button>
                    <button 
                        onClick={() => setCurrentView('Data Analysis')} 
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${currentView === 'Data Analysis' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Analysis
                    </button>
                </div>
            </div>
        </div>
    );
  };
  
  const handleRowToggle = (patientId: number) => {
    setExpandedRowId(prevId => (prevId === patientId ? null : patientId));
  };


  return (
    <div className="space-y-6">
        {/* 1. Header: Title & Add Button - White Rectangle Style */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800">AMS Monitoring Dashboard</h2>
                <p className="text-sm text-gray-500">Track active patients and antimicrobial therapy duration.</p>
            </div>
            {currentView === 'Patient List' && (
                <button 
                    onClick={() => {
                        setEditingPatientId(null);
                        setNewPatient(initialNewPatientState);
                        setIsAddModalOpen(true);
                    }} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors whitespace-nowrap self-start md:self-auto"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Patient
                </button>
            )}
        </div>

        {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm"><p className="font-bold text-red-700">System Error</p><p className="text-sm text-red-600">{error}</p></div>}

        {/* 2. Filters (Command Bar) */}
        <CommandBar />

        {/* 3. KPI Cards (HUD) with Filtering */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
                title="Active Patients" 
                value={kpiStats.activeCount} 
                iconColor={kpiFilter === 'All' ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"}
                isActive={kpiFilter === 'All'}
                icon={<KpiIcon path="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />} 
                onClick={() => setKpiFilter('All')}
            />
            
            <div 
                onClick={() => setKpiFilter(kpiFilter === 'RedFlag' ? 'All' : 'RedFlag')} 
                className={`p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer ${kpiFilter === 'RedFlag' ? 'bg-red-50 border-red-500 ring-2 ring-red-200 shadow-md' : 'bg-white border-gray-200 shadow-sm hover:shadow-lg hover:border-red-300'}`}
            >
                <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${kpiFilter === 'RedFlag' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'}`}><KpiIcon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></div>
                <div><p className="text-xl font-bold text-gray-800">{kpiStats.redFlagCount}</p><p className="text-xs text-gray-500 font-medium">With Red Flags</p></div>
            </div>
            
            <KpiCard 
                title="New Patients (24h)" 
                value={kpiStats.newCount} 
                iconColor={kpiFilter === 'New' ? "bg-green-600 text-white" : "bg-green-100 text-green-700"}
                isActive={kpiFilter === 'New'}
                icon={<KpiIcon path="M10 3a1 1 0 011 1v5h5a1 1 0 11-2 0v-5H4a1 1 0 11-2 0v-5H4a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />} 
                onClick={() => setKpiFilter(kpiFilter === 'New' ? 'All' : 'New')}
            />
            
            <KpiCard 
                title="Therapies Nearing Stop" 
                value={kpiStats.nearingStopCount} 
                subValue="in next 48h" 
                iconColor={kpiFilter === 'NearingStop' ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-700"}
                isActive={kpiFilter === 'NearingStop'}
                icon={<KpiIcon path="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" />} 
                onClick={() => setKpiFilter(kpiFilter === 'NearingStop' ? 'All' : 'NearingStop')}
            />
        </div>

        {/* 4. Content (List / Analysis) */}
        {loading ? <div className="text-center py-20 text-gray-500">Loading...</div> : currentView === 'Data Analysis' ? ( 
            <div className="animate-fade-in space-y-6">
                {/* ... Analysis Charts ... */}
                {analysisStats.topDrugs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartWrapper title="Top 10 Antimicrobials Used">
                        <ResponsiveContainer>
                            <BarChart data={analysisStats.topDrugs} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" name="Count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartWrapper>
                    <ChartWrapper title="Therapy Duration Distribution">
                         <ResponsiveContainer>
                            <BarChart data={analysisStats.durationDistribution}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                                    {analysisStats.durationDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartWrapper>
                    <ChartWrapper title="Discontinuation Reasons">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={analysisStats.discontinuationReasons} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {analysisStats.discontinuationReasons.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartWrapper>
                    <DataList 
                        title="Top 5 Drugs with Missed Doses" 
                        data={analysisStats.missedDosesByDrug}
                        color="bg-red-500"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                </div>
                ) : (
                    <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-sm border">No data available for analysis.</div>
                )}
            </div>
        ) : (
            <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-20">
                            <tr>
                                <th onClick={() => requestSort('patient_name')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                                    Patient {getSortIcon('patient_name')}
                                </th>
                                <th onClick={() => requestSort('ward')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                                    Ward {getSortIcon('ward')}
                                </th>
                                <th onClick={() => requestSort(statusFilter === 'Admitted' ? 'date_of_admission' : 'discharged_at')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                                    Date {getSortIcon(statusFilter === 'Admitted' ? 'date_of_admission' : 'discharged_at')}
                                </th>
                                <th onClick={() => requestSort('days_on_therapy')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                                    Max Days {getSortIcon('days_on_therapy')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Antimicrobials
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Disposition / Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedPatients.map((patient) => {
                                const isExpanded = expandedRowId === patient.id;
                                const activeDrugNames = patient.antimicrobials
                                    .filter(d => d.status === 'Active')
                                    .map(d => ({ name: d.drug_name, status: 'Active' }));
                                const stoppedDrugNames = patient.antimicrobials
                                    .filter(d => d.status !== 'Active')
                                    .map(d => ({ name: d.drug_name, status: d.status }));
                                const allDisplayDrugs = [...activeDrugNames, ...stoppedDrugNames];

                                const maxDays = getMaxTherapyDays(patient);
                                const redFlags = getRedFlagStatus(patient);
                                
                                return (
                                    <React.Fragment key={patient.id}>
                                        <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center cursor-pointer" onClick={() => setSelectedPatient(patient)}>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                            {patient.patient_name}
                                                            {(redFlags.hasMissedDoses || redFlags.hasRenalAlert || redFlags.hasProlongedTherapy) && (
                                                                <span className="flex h-2 w-2 relative">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-mono">{patient.hospital_number}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-700">{patient.ward}</span>
                                                    <span className="text-xs">Bed {patient.bed_number}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {statusFilter === 'Admitted' 
                                                    ? new Date(patient.date_of_admission).toLocaleDateString()
                                                    : patient.discharged_at ? new Date(patient.discharged_at).toLocaleDateString() : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`font-bold ${maxDays > 7 ? 'text-orange-600' : 'text-gray-700'}`}>
                                                    {maxDays > 0 ? `Day ${maxDays}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {allDisplayDrugs.length > 0 ? allDisplayDrugs.map((d, i) => (
                                                        <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${d.status === 'Active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 line-through'}`}>
                                                            {d.name}
                                                        </span>
                                                    )) : <span className="text-gray-400 italic text-xs">None</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleRowToggle(patient.id)} className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${isExpanded ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`} title="Log Administration">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                    </button>
                                                    <button onClick={() => setSelectedPatient(patient)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors" title="View Details">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    </button>
                                                    
                                                    {statusFilter === 'Admitted' ? (
                                                        <>
                                                            <button onClick={() => openEditPatientModal(patient)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors" title="Edit Patient Details">
                                                                <EditIcon />
                                                            </button>
                                                            <button onClick={() => setTransferAction({ patient })} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-orange-600 transition-colors" title="Transfer">
                                                                <TransferIcon />
                                                            </button>
                                                            <button onClick={() => setDispositionAction({ patient, action: 'Discharge' })} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Discharge">
                                                                <DischargeIcon />
                                                            </button>
                                                            <button onClick={() => setDispositionAction({ patient, action: 'Expire' })} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors" title="Mark Expired">
                                                                <ExpiredIcon />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => setDispositionAction({ patient, action: 'Re-admit' })} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors" title="Re-admit">
                                                            <ReAdmitIcon />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={6} className="p-0 border-b border-gray-200">
                                                    <ExpansionRow 
                                                        patient={patient} 
                                                        onAddLog={updatePatientLog}
                                                        onViewFullSheet={() => setSelectedPatient(patient)}
                                                        onStatusAction={(drugId, action) => initiateStatusChange(drugId, patient.id, action)}
                                                        onSensitivityAction={(drug) => openSensitivityModal(drug, patient.id)}
                                                        onEditDrug={(drug) => setDrugToEdit({ patientId: patient.id, drug })}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
        )}

        {/* Modals */}
        {selectedPatient && (
            <MonitoringDetailModal 
                isOpen={!!selectedPatient} 
                onClose={() => setSelectedPatient(null)} 
                patient={selectedPatient} 
                user={user} 
                onUpdate={loadData}
                onOpenAdminModal={handleOpenAdminModal}
            />
        )}

        {/* Add Patient Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[120] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-fade-in border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                        {editingPatientId ? 'Edit Patient Details' : 'Add New Patient'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Patient Name</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none" value={newPatient.patient_name} onChange={e => setNewPatient({...newPatient, patient_name: e.target.value})} placeholder="Last Name, First Name" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Hospital No.</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={newPatient.hospital_number} onChange={e => setNewPatient({...newPatient, hospital_number: e.target.value})} placeholder="ID Number" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Ward</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white [color-scheme:light]" value={newPatient.ward} onChange={e => setNewPatient({...newPatient, ward: e.target.value})}>
                                <option value="">Select Ward</option>
                                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Bed No.</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={newPatient.bed_number} onChange={e => setNewPatient({...newPatient, bed_number: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Admission Date</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1 [color-scheme:light]" value={newPatient.date_of_admission} onChange={e => setNewPatient({...newPatient, date_of_admission: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Age</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Sex</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white [color-scheme:light]" value={newPatient.sex} onChange={e => setNewPatient({...newPatient, sex: e.target.value})}>
                                <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">SCr (µmol/L)</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={newPatient.latest_creatinine} onChange={e => setNewPatient({...newPatient, latest_creatinine: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Infectious Diagnosis</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={newPatient.infectious_diagnosis} onChange={e => setNewPatient({...newPatient, infectious_diagnosis: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                        <button onClick={() => { setIsAddModalOpen(false); setEditingPatientId(null); setNewPatient(initialNewPatientState); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold bg-white border border-gray-300">Cancel</button>
                        <button onClick={handleAddPatient} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">{editingPatientId ? 'Update Patient' : 'Add Patient'}</button>
                    </div>
                </div>
            </div>
        )}

        {/* ... Other modals (AdminLog, Status Change, etc.) reused or lifted ... */}
        {/* Reusing AdminLogModal logic but inline or via existing state */}
        {adminModal && adminModal.isOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[130] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Log Administration</h3>
                    {/* ... form content same as GridLogModal but adapted for main state ... */}
                    <div className="space-y-4">
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button onClick={() => setAdminStatus('Given')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adminStatus === 'Given' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Given</button>
                            <button onClick={() => setAdminStatus('Missed')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adminStatus === 'Missed' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Missed</button>
                        </div>
                        {adminStatus === 'Given' ? (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Time</label>
                                <input type="time" className="w-full border rounded-lg px-3 py-2 text-lg" value={adminTime} onChange={e => setAdminTime(e.target.value)} autoFocus />
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Reason</label>
                                <select className="w-full border rounded-lg px-3 py-2 text-sm mb-2" value={adminMissReason} onChange={e => setAdminMissReason(e.target.value)}>
                                    <option value="">Select...</option>
                                    {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                {adminMissReason === 'Others (Specify)' && <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Specify..." value={adminMissReasonOther} onChange={e => setAdminMissReasonOther(e.target.value)} />}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => { setAdminModal(null); resetAdminModalState(); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold border border-gray-300">Cancel</button>
                        <button onClick={handleAdminLogSave} className={`px-4 py-2 text-white rounded-lg text-sm font-bold shadow-sm ${adminStatus === 'Given' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>Save Log</button>
                    </div>
                </div>
            </div>
        )}

        {/* Transfer / Discharge Modals Reuse or implementation ... */}
        {dispositionAction && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[130] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border-t-4 border-gray-500">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm {dispositionAction.action}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Are you sure you want to {dispositionAction.action.toLowerCase()} <strong>{dispositionAction.patient.patient_name}</strong>?
                    </p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setDispositionAction(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button onClick={confirmDisposition} disabled={loading} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-900">Yes, Confirm</button>
                    </div>
                </div>
            </div>
        )}

        {transferAction && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[130] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-blue-200">
                    <h3 className="text-lg font-bold text-blue-800 mb-4">Transfer Patient</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Date & Time</label>
                            <input type="datetime-local" className="w-full border rounded-lg px-3 py-2 text-sm [color-scheme:light]" value={transferInputs.date} onChange={e => setTransferInputs({...transferInputs, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">To Ward</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white [color-scheme:light]" value={transferInputs.to_ward} onChange={e => setTransferInputs({...transferInputs, to_ward: e.target.value})}>
                                <option value="">Select Ward</option>
                                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">To Bed</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={transferInputs.to_bed} onChange={e => setTransferInputs({...transferInputs, to_bed: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setTransferAction(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold border border-gray-300">Cancel</button>
                        <button onClick={handleConfirmTransfer} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">Transfer</button>
                    </div>
                </div>
            </div>
        )}

        {/* Status Change Modal (Row Action) - Reusing logic from DetailModal but lifted */}
        {statusAction && statusAction.isOpen && (
             <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
                <div className="bg-white text-gray-900 rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-200 pb-2">Confirm {statusAction.type}</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Date & Time</label>
                            <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" value={actionDateTime} onChange={(e) => setActionDateTime(e.target.value)} />
                        </div>

                        {statusAction.type === 'Dose Change' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">New Dose</label>
                                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none text-gray-900" placeholder="e.g. 500mg" value={newDoseValue} onChange={(e) => setNewDoseValue(e.target.value)} />
                                <label className="text-xs font-bold text-gray-500 uppercase block mt-2 mb-1">Reason for Change</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white text-gray-900 [color-scheme:light]"
                                    value={statusReasonType}
                                    onChange={(e) => setStatusReasonType(e.target.value)}
                                >
                                    <option value="">Select Reason</option>
                                    {DOSE_CHANGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                {statusReasonType === 'Others (Specify)' && (
                                    <input 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none mt-2 text-gray-900" 
                                        placeholder="Specify reason..." 
                                        value={statusReasonText} 
                                        onChange={(e) => setStatusReasonText(e.target.value)} 
                                    />
                                )}
                            </div>
                        )}

                        {(statusAction.type === 'Stopped' || statusAction.type === 'Shifted') && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Reason</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white text-gray-900 [color-scheme:light]"
                                    value={statusReasonType}
                                    onChange={(e) => setStatusReasonType(e.target.value)}
                                >
                                    <option value="">Select Reason</option>
                                    {statusAction.type === 'Stopped' 
                                        ? STOP_REASONS.filter(r => r !== 'Course Completed').map(r => <option key={r} value={r}>{r}</option>)
                                        : SHIFT_REASONS.map(r => <option key={r} value={r}>{r}</option>)
                                    }
                                </select>
                                
                                {statusReasonType === 'Others (Specify)' && (
                                    <textarea 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        rows={3}
                                        placeholder="Specify reason..."
                                        value={statusReasonText}
                                        onChange={(e) => setStatusReasonText(e.target.value)}
                                    />
                                )}
                            </div>
                        )}

                        {statusAction.type === 'Continue' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ordered By (Resident Name)</label>
                                <input 
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Dr. Juan Dela Cruz"
                                    value={continueResident}
                                    onChange={(e) => setContinueResident(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setStatusAction(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium bg-white border border-gray-300">Cancel</button>
                        <button onClick={confirmStatusChange} disabled={!actionDateTime || loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">Confirm</button>
                    </div>
                </div>
            </div>
        )}

        {/* Sensitivity Sub-Modal */}
        {sensitivityModal && sensitivityModal.isOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
                <div className="bg-white text-gray-900 rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 1111.314 0z" clipRule="evenodd" /></svg>
                        Add Sensitivity Data
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Result / Pattern</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                rows={3}
                                placeholder="e.g. E.coli ESBL+, Sensitive to Meropenem"
                                value={sensitivityModal.info}
                                onChange={(e) => setSensitivityModal({...sensitivityModal, info: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Date Available</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]" 
                                value={sensitivityModal.date}
                                onChange={(e) => setSensitivityModal({...sensitivityModal, date: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setSensitivityModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium bg-white border border-gray-300">Cancel</button>
                        <button onClick={saveSensitivity} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors">Save</button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Drug Modal */}
        {drugToEdit && (
            <EditDrugModal 
                drug={drugToEdit.drug} 
                onClose={() => setDrugToEdit(null)} 
                onSave={handleSaveEditedDrug} 
            />
        )}

    </div>
  );
};

export default AMSMonitoring;
