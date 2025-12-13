import React, { useState, useEffect } from 'react';
import { MonitoringPatient, MonitoringAntimicrobial, TransferLog, User, AdminLogEntry, ChangeLogEntry } from '../types';
import { updateMonitoringPatient } from '../services/dataService';
import { WARDS, MONITORED_DRUGS, RESTRICTED_DRUGS } from '../constants';

interface MonitoringDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: MonitoringPatient | null;
  user: User | null;
  onUpdate: () => void;
}

// Helper to calc eGFR
const calculateEgfr = (age: number, sex: string, scr: number) => {
    if (!age || !scr) return "";
    const scrMgDl = scr / 88.4;
    const k = sex === "Female" ? 0.7 : 0.9;
    const alpha = sex === "Female" ? -0.241 : -0.302;
    const minScr = Math.min(scrMgDl/k,1);
    const maxScr = Math.max(scrMgDl/k,1);
    const egfr = 142 * Math.pow(minScr,alpha) * Math.pow(maxScr,-1.2) * Math.pow(0.9938, age) * (sex === "Female" ? 1.012 : 1);
    return isFinite(egfr) ? egfr.toFixed(1) + ' mL/min/1.73m²' : "";
};

// Time Helpers
const to12h = (time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
};

const toLocalISO = (dateStr?: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

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

const MISSED_REASONS = [
    "Stock Out",
    "Patient Refused",
    "NPO",
    "IV Access Issue",
    "Patient out of ward",
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

const MonitoringDetailModal: React.FC<MonitoringDetailModalProps> = ({ isOpen, onClose, patient, user, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'Details' | 'Antimicrobials'>('Details');
  const [formData, setFormData] = useState<Partial<MonitoringPatient>>({});
  
  // Transfer State
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferData, setTransferData] = useState({ to_ward: '', to_bed: '' });
  const [transferDate, setTransferDate] = useState('');
  const [editingTransferIndex, setEditingTransferIndex] = useState<number | null>(null);

  // New Drug Form State
  const [newDrug, setNewDrug] = useState<Partial<MonitoringAntimicrobial>>({});
  const [frequencyInput, setFrequencyInput] = useState<string>('');
  const [isAddingDrug, setIsAddingDrug] = useState(false);
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOtherRoute, setIsOtherRoute] = useState(false);

  // Administration Log State
  const [adminModal, setAdminModal] = useState<{
      isOpen: boolean;
      drugId: string;
      dateStr: string;
      slotIndex: number;
  } | null>(null);
  const [adminTime, setAdminTime] = useState('');
  const [adminStatus, setAdminStatus] = useState<'Given' | 'Missed'>('Given');
  const [adminMissReason, setAdminMissReason] = useState('');
  const [adminMissReasonOther, setAdminMissReasonOther] = useState('');

  // Status Change Modal State
  const [statusAction, setStatusAction] = useState<{
      type: 'Stopped' | 'Completed' | 'Shifted' | 'Continue' | 'Dose Change';
      drugId: string;
      isOpen: boolean;
  } | null>(null);
  const [actionDateTime, setActionDateTime] = useState('');
  const [statusReasonType, setStatusReasonType] = useState(''); // Selection
  const [statusReasonText, setStatusReasonText] = useState(''); // Text input for others
  const [continueResident, setContinueResident] = useState(''); // New state for Continue action
  const [newDoseValue, setNewDoseValue] = useState(''); // For Dose Change

  // Undo Confirmation State
  const [undoModal, setUndoModal] = useState<{ isOpen: boolean, drugId: string } | null>(null);

  // Sensitivity Modal State
  const [sensitivityModal, setSensitivityModal] = useState<{
      isOpen: boolean;
      drugId: string;
      info: string;
      date: string;
  } | null>(null);

  useEffect(() => {
    if (patient) {
        setFormData({ ...patient });
        resetNewDrugForm();
        setTransferData({ to_ward: patient.ward, to_bed: patient.bed_number });
    }
  }, [patient, isOpen]);

  const resetNewDrugForm = () => {
      setNewDrug({
          status: 'Active',
          start_date: new Date().toISOString().split('T')[0]
      });
      setFrequencyInput('');
      setEditingDrugId(null);
      setIsOtherRoute(false);
  };

  const initTransferForm = (isEdit: boolean, log?: TransferLog, index?: number) => {
      if (isEdit && log && index !== undefined) {
          setEditingTransferIndex(index);
          setTransferData({ to_ward: log.to_ward, to_bed: log.to_bed });
          setTransferDate(toLocalISO(log.date));
      } else {
          setEditingTransferIndex(null);
          setTransferData({ to_ward: '', to_bed: '' });
          setTransferDate(toLocalISO());
      }
      setIsTransferring(true);
  };
  
  const normalizeLogEntry = (entry: string | AdminLogEntry): AdminLogEntry => {
      if (typeof entry === 'string') return { time: entry, status: 'Given' };
      return entry;
  };

  const calculateTherapyDay = (drug: MonitoringAntimicrobial): string => {
    const totalDosesGiven = drug.administration_log 
      ? Object.values(drug.administration_log)
          .flat()
          .filter(entry => normalizeLogEntry(entry).status === 'Given')
          .length
      : 0;

    if (totalDosesGiven === 0) {
        return drug.status === 'Active' ? "Day 1" : "0 doses";
    }
    
    if (!drug.frequency_hours || drug.frequency_hours <= 0) {
        return `${totalDosesGiven} doses`;
    }
    
    const dosesPerDay = Math.floor(24 / drug.frequency_hours);

    if (dosesPerDay <= 1) {
        return `Day ${totalDosesGiven}`;
    } else {
        const fullDays = Math.floor(totalDosesGiven / dosesPerDay);
        const extraDoses = totalDosesGiven % dosesPerDay;

        if (extraDoses === 0) {
            return `Day ${fullDays}`;
        }
        if (fullDays === 0) {
            return `${extraDoses} doses`;
        }
        return `Day ${fullDays} + ${extraDoses}`;
    }
  };


  if (!isOpen || !patient) return null;

  const handlePatientUpdate = async () => {
      setLoading(true);
      try {
          const { id, created_at, antimicrobials, transfer_history, ...editableFields } = formData;
          const updates: Partial<MonitoringPatient> = { 
              ...editableFields, 
              last_updated_by: user?.name 
          };

          if (formData.latest_creatinine && formData.age && formData.sex) {
              const newEgfr = calculateEgfr(Number(formData.age), formData.sex, Number(formData.latest_creatinine));
              if (newEgfr) updates.egfr = newEgfr;
          }

          await updateMonitoringPatient(patient.id, updates);
          onUpdate();
          alert("Patient details updated.");
      } catch (e: any) {
          console.error("Update Monitoring Patient error:", JSON.stringify(e, null, 2));
          alert(`Update Monitoring Patient error:\n${e.message || "Unknown error"}`);
      } finally {
          setLoading(false);
      }
  };

  const handleTransfer = async () => {
      if (!transferData.to_ward || !transferData.to_bed || !transferDate) {
          alert("Please select destination ward, bed number, and date/time.");
          return;
      }
      setLoading(true);
      try {
        let newHistory = [...(patient.transfer_history || [])];
        if (editingTransferIndex !== null) {
            newHistory[editingTransferIndex] = {
                ...newHistory[editingTransferIndex],
                date: new Date(transferDate).toISOString(),
                to_ward: transferData.to_ward,
                to_bed: transferData.to_bed,
            };
        } else {
            const newLog: TransferLog = {
                date: new Date(transferDate).toISOString(),
                from_ward: patient.ward,
                to_ward: transferData.to_ward,
                from_bed: patient.bed_number,
                to_bed: transferData.to_bed
            };
            newHistory.push(newLog);
        }
        
        const updates: any = {
            transfer_history: newHistory,
            last_updated_by: user?.name
        };

        if (editingTransferIndex === null) {
            updates.ward = transferData.to_ward;
            updates.bed_number = transferData.to_bed;
        }
        
        await updateMonitoringPatient(patient.id, updates);
        setIsTransferring(false);
        setEditingTransferIndex(null);
        onUpdate();
        alert(editingTransferIndex !== null ? "Transfer details updated." : "Patient transferred successfully.");
      } catch (err: any) {
          alert("Error saving transfer: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDischarge = async (status: 'Discharged' | 'Expired') => {
      if (!confirm(`Mark patient as ${status}? This will remove them from the active monitoring list.`)) return;
      setLoading(true);
      try {
        await updateMonitoringPatient(patient.id, { 
            status: status, 
            discharged_at: new Date().toISOString(),
            last_updated_by: user?.name
        });
        onUpdate();
        onClose();
      } catch (err: any) {
          alert("Error: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSaveDrug = async () => {
      if (!newDrug.drug_name || !newDrug.dose || !newDrug.route || !newDrug.start_date || !frequencyInput) {
          alert("Please fill required drug fields (Name, Dose, Route, Frequency in Hours, Start Date).");
          return;
      }

      setLoading(true);
      try {
        let updatedList = [...(patient.antimicrobials || [])];

        const drugPayload: MonitoringAntimicrobial = {
            ...newDrug,
            frequency: `Every ${frequencyInput} Hours`,
            frequency_hours: parseInt(frequencyInput),
        } as MonitoringAntimicrobial;

        if (editingDrugId) {
            updatedList = updatedList.map(d => d.id === editingDrugId ? { ...d, ...drugPayload, id: editingDrugId, administration_log: d.administration_log, sensitivity_info: d.sensitivity_info, sensitivity_date: d.sensitivity_date, change_history: d.change_history } : d);
        } else {
            updatedList.push({
                ...drugPayload,
                id: Date.now().toString(),
                administration_log: {},
                change_history: []
            });
        }

        await updateMonitoringPatient(patient.id, { antimicrobials: updatedList, last_updated_by: user?.name });
        onUpdate();
        setIsAddingDrug(false);
        resetNewDrugForm();
      } catch (err: any) {
          alert("Error saving drug: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleEditDrug = (drug: MonitoringAntimicrobial) => {
      setNewDrug(drug);
      setFrequencyInput(drug.frequency_hours ? drug.frequency_hours.toString() : '');
      setEditingDrugId(drug.id);
      const knownRoutes = ['IV', 'IM', 'PO'];
      setIsOtherRoute(!knownRoutes.includes(drug.route || ''));
      setIsAddingDrug(true);
      document.querySelector('.scrollable-content')?.scrollTo(0, 0);
  };

  // Status Change Logic
  const initiateStatusChange = (drugId: string, type: 'Stopped' | 'Completed' | 'Shifted' | 'Continue' | 'Dose Change') => {
      setActionDateTime(toLocalISO());
      setStatusReasonType('');
      setStatusReasonText('');
      setContinueResident('');
      setNewDoseValue('');
      setStatusAction({ type, drugId, isOpen: true });
  };

  const confirmStatusChange = async () => {
      if (!statusAction || !actionDateTime) return;
      
      let finalReason = "";
      if (statusAction.type === 'Stopped' || statusAction.type === 'Shifted' || statusAction.type === 'Dose Change') {
          if (!statusReasonType) {
              alert("Please select a reason.");
              return;
          }
          if (statusReasonType === 'Others (Specify)' && !statusReasonText.trim()) {
              alert("Please specify the reason.");
              return;
          }
          finalReason = statusReasonType === 'Others (Specify)' ? statusReasonText : statusReasonType;
      }
      
      if (statusAction.type === 'Dose Change' && !newDoseValue.trim()) {
          alert("Enter new dose."); 
          return;
      }

      if (statusAction.type === 'Continue') {
          if (!continueResident.trim()) {
              alert("Please enter the name of the resident ordering the continuation.");
              return;
          }
      }

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
        if (statusAction.type === 'Continue') alert("Antimicrobial continued. Resident updated.");
        if (statusAction.type === 'Dose Change') alert("Dose updated successfully.");
        setStatusAction(null);
        onUpdate();
      } catch (err: any) {
          alert("Error updating status: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const initiateUndo = (drugId: string) => {
      setUndoModal({ isOpen: true, drugId });
  };

  const confirmUndo = async () => {
    if (!undoModal) return;
    setLoading(true);
    try {
        const updatedList = patient.antimicrobials.map(d => {
            if (d.id === undoModal.drugId) {
                const { stop_date, stop_reason, shifted_at, shift_reason, completed_at, ...rest } = d;
                return { ...rest, status: 'Active' } as MonitoringAntimicrobial;
            }
            return d;
        });

        await updateMonitoringPatient(patient.id, { 
            antimicrobials: updatedList, 
            last_updated_by: user?.name 
        });
        
        onUpdate();
        setUndoModal(null);
    } catch (err: any) {
        alert("Error undoing status: " + (err instanceof Error ? err.message : String(err)));
    } finally {
        setLoading(false);
    }
  };

  // Sensitivity Logic
  const openSensitivityModal = (drug: MonitoringAntimicrobial) => {
      setSensitivityModal({
          isOpen: true,
          drugId: drug.id,
          info: drug.sensitivity_info || '',
          date: drug.sensitivity_date || new Date().toISOString().split('T')[0]
      });
  };

  const saveSensitivity = async () => {
      if (!sensitivityModal) return;
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
        onUpdate();
      } catch (err: any) {
          alert("Error saving sensitivity: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  // Log Logic
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


  const countMissedDoses = (log: Record<string, (string | AdminLogEntry)[]>) => {
      if (!log) return 0;
      let count = 0;
      Object.values(log).forEach(dayLog => {
          dayLog.forEach(entry => {
              if (normalizeLogEntry(entry).status === 'Missed') count++;
          });
      });
      return count;
  };

  const handleAdminLogSave = async () => {
      if (!adminModal) return;
      if (adminStatus === 'Given' && !adminTime) return;
      if (adminStatus === 'Missed' && (!adminMissReason || (adminMissReason === 'Others (Specify)' && !adminMissReasonOther))) return;

      const { drugId, dateStr } = adminModal;
      const formattedTime = adminStatus === 'Given' ? to12h(adminTime) : 'Missed';
      
      const newEntry: AdminLogEntry = {
          time: formattedTime,
          status: adminStatus,
          reason: adminStatus === 'Missed' ? (adminMissReason === 'Others (Specify)' ? adminMissReasonOther : adminMissReason) : undefined
      };

      setLoading(true);
      try {
        const updatedList = patient.antimicrobials.map(d => {
            if (d.id === drugId) {
                const currentLog = d.administration_log || {};
                const dayLog = currentLog[dateStr] || [];
                const newDayLog = [...dayLog, newEntry].sort((a,b) => {
                    const tA = normalizeLogEntry(a).time;
                    const tB = normalizeLogEntry(b).time;
                    if (tA === 'Missed') return 1;
                    if (tB === 'Missed') return -1;
                    return tA.localeCompare(tB);
                });
                return { ...d, administration_log: { ...currentLog, [dateStr]: newDayLog } };
            }
            return d;
        });

        await updateMonitoringPatient(patient.id, { antimicrobials: updatedList, last_updated_by: user?.name });
        setAdminModal(null);
        setAdminTime('');
        setAdminStatus('Given');
        setAdminMissReason('');
        setAdminMissReasonOther('');
        onUpdate();
      } catch (err: any) {
          alert("Error saving log: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteLogTime = async (drugId: string, dateStr: string, indexToDelete: number) => {
      if(!confirm("Remove this entry?")) return;
      setLoading(true);
      try {
        const updatedList = patient.antimicrobials.map(d => {
            if (d.id === drugId) {
                const currentLog = d.administration_log || {};
                const newDayLog = (currentLog[dateStr] || []).filter((_, idx) => idx !== indexToDelete);
                return { ...d, administration_log: { ...currentLog, [dateStr]: newDayLog } };
            }
            return d;
        });
        await updateMonitoringPatient(patient.id, { antimicrobials: updatedList, last_updated_by: user?.name });
        onUpdate();
      } catch (err: any) {
          alert("Error deleting log: " + err.message);
      } finally {
          setLoading(false);
      }
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

  const getDayNumber = (startDate: string, targetDate: Date) => {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const target = new Date(targetDate);
      target.setHours(0,0,0,0);
      const diffTime = target.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 ? diffDays + 1 : 1;
  };

  const getDrugClassification = (name: string) => {
      if (!name) return null;
      const cleanName = name.trim();
      const isAdult = patient && parseInt(patient.age) >= 19;

      const inRestricted = RESTRICTED_DRUGS.some(d => d.toLowerCase() === cleanName.toLowerCase());
      const inMonitored = MONITORED_DRUGS.some(d => d.toLowerCase() === cleanName.toLowerCase());
      
      let tag = null;
      if (isAdult) {
          if (inRestricted) tag = 'Restricted';
          if (inMonitored) tag = 'Monitored';
      } else { // Pediatric
          // Placeholder for pediatric rules if they differ
          if (inRestricted) tag = 'Restricted';
          if (inMonitored) tag = 'Monitored';
      }

      if (tag === 'Restricted') return { type: 'Restricted', color: 'bg-red-100 text-red-800 border-red-200' };
      if (tag === 'Monitored') return { type: 'Monitored', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      
      return null;
  };


  // Sorting
  const sortedAntimicrobials = [...(patient.antimicrobials || [])].sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      const dateA = a.stop_date || a.shifted_at || a.completed_at || a.start_date;
      const dateB = b.stop_date || b.shifted_at || b.completed_at || b.start_date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 p-5 text-white flex justify-between items-center shadow-lg shrink-0">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{patient.patient_name}</h2>
                <div className="flex items-center gap-4 mt-1 text-blue-100 text-sm">
                    <span className="font-mono bg-blue-900/30 px-2 py-0.5 rounded">{patient.hospital_number}</span>
                    <span>{patient.ward} • Bed {patient.bed_number}</span>
                    <span>{patient.age}y / {patient.sex}</span>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {patient.last_updated_by && <span className="text-[10px] text-blue-200">Last updated by: {patient.last_updated_by}</span>}
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 px-6 pt-2 shrink-0">
            {['Details', 'Antimicrobials'].map(tab => (
                <button 
                    key={tab}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                    onClick={() => setActiveTab(tab as any)}
                >
                    {tab === 'Antimicrobials' ? 'Antimicrobial Sheet' : 'Patient Details'}
                </button>
            ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50 scrollable-content">
            {activeTab === 'Details' && (
                <div className="space-y-4 max-w-4xl mx-auto">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        {/* Vitals Form */}
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2 mb-4">Location & Vitals</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Ward</label>
                                <input className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-gray-100 text-gray-600" readOnly value={formData.ward} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Bed</label>
                                <input className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-gray-100 text-gray-600" readOnly value={formData.bed_number} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Age</label>
                                <input type="number" className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Sex</label>
                                <select className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})}>
                                    <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">SCr (µmol/L)</label>
                                <input type="number" className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500" value={formData.latest_creatinine} onChange={e => setFormData({...formData, latest_creatinine: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">eGFR</label>
                                <input type="text" className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-gray-100 text-gray-600" readOnly value={formData.egfr} />
                            </div>
                             <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Dialysis?</label>
                                <select className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500" value={formData.dialysis_status} onChange={e => setFormData({...formData, dialysis_status: e.target.value as any})}>
                                    <option value="No">No</option><option value="Yes">Yes</option>
                                </select>
                            </div>
                            <div className="md:col-span-3 lg:col-span-4">
                                <label className="text-xs font-bold text-gray-500 uppercase">Infectious Disease Diagnosis</label>
                                <textarea className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500" rows={2} value={formData.infectious_diagnosis} onChange={e => setFormData({...formData, infectious_diagnosis: e.target.value})} />
                            </div>
                        </div>

                        {/* Transfer History inside the same box */}
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ward Transfer History</h3>
                                {!isTransferring && (
                                    <button onClick={() => initTransferForm(false)} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded border border-blue-100">
                                        Transfer
                                    </button>
                                )}
                            </div>
                            {isTransferring && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                                        <div><label className="text-xs font-bold text-gray-500">Date & Time</label><input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm mt-1 bg-white" value={transferDate} onChange={e => setTransferDate(e.target.value)}/></div>
                                        <div><label className="text-xs font-bold text-gray-500">New Ward</label><select className="w-full border rounded px-2 py-1 text-sm mt-1 bg-white" value={transferData.to_ward} onChange={e => setTransferData({...transferData, to_ward: e.target.value})}><option value="">Select</option>{WARDS.map(w => <option key={w} value={w}>{w}</option>)}</select></div>
                                        <div><label className="text-xs font-bold text-gray-500">New Bed</label><input type="text" className="w-full border rounded px-2 py-1 text-sm mt-1 bg-white" value={transferData.to_bed} onChange={e => setTransferData({...transferData, to_bed: e.target.value})} /></div>
                                    </div>
                                    <div className="flex justify-end gap-2"><button onClick={() => setIsTransferring(false)} className="px-3 py-1 bg-white border rounded text-xs font-bold">Cancel</button><button onClick={handleTransfer} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold">Confirm</button></div>
                                </div>
                            )}
                            <div className="space-y-2">
                                {patient.transfer_history && patient.transfer_history.length > 0 ? patient.transfer_history.map((log, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded border group">
                                        <div><span className="font-semibold">{log.from_ward} ({log.from_bed})</span> <span className="text-gray-400 mx-1">→</span> <span className="font-semibold">{log.to_ward} ({log.to_bed})</span></div>
                                        <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{new Date(log.date).toLocaleString()}</span><button onClick={() => initTransferForm(true, log, idx)} className="text-blue-500 opacity-0 group-hover:opacity-100"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button></div>
                                    </div>
                                )) : <p className="text-sm text-gray-400 italic">No transfer history.</p>}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <div className="flex gap-3">
                            <button onClick={() => handleDischarge('Discharged')} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors bg-white">Discharged</button>
                            <button onClick={() => handleDischarge('Expired')} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors bg-white">Expired</button>
                        </div>
                        <button onClick={handlePatientUpdate} disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-md hover:shadow-lg transition-all">Save Changes</button>
                    </div>
                </div>
            )}

            {activeTab === 'Antimicrobials' && (
                <div className="space-y-6 max-w-6xl mx-auto">
                    {/* Add/Edit Drug Form */}
                    {isAddingDrug ? (
                        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-lg animate-fade-in ring-4 ring-blue-50">
                            <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">Rx</span>
                                {editingDrugId ? 'Edit Antimicrobial' : 'Register New Antimicrobial'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Drug Name</label>
                                    <div className="relative">
                                        <input 
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={newDrug.drug_name || ''} 
                                            onChange={e => setNewDrug({...newDrug, drug_name: e.target.value})} 
                                            placeholder="Type to search..." 
                                            list="drug-options"
                                        />
                                        <datalist id="drug-options">
                                            {[...MONITORED_DRUGS, ...RESTRICTED_DRUGS].sort().map(d => <option key={d} value={d} />)}
                                        </datalist>
                                        {newDrug.drug_name && getDrugClassification(newDrug.drug_name) && (
                                            <div className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded border ${getDrugClassification(newDrug.drug_name)?.color}`}>
                                                {getDrugClassification(newDrug.drug_name)?.type}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Dose</label>
                                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newDrug.dose || ''} onChange={e => setNewDrug({...newDrug, dose: e.target.value})} placeholder="e.g. 1g" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Route</label>
                                     <div className="flex gap-2">
                                        <select
                                            value={isOtherRoute ? 'Others' : newDrug.route}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === 'Others') {
                                                    setIsOtherRoute(true);
                                                    setNewDrug({...newDrug, route: ''});
                                                } else {
                                                    setIsOtherRoute(false);
                                                    setNewDrug({...newDrug, route: val});
                                                }
                                            }}
                                            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none ${isOtherRoute ? 'w-1/2' : 'w-full'}`}
                                        >
                                            <option value="">Select</option>
                                            <option value="IV">IV</option>
                                            <option value="IM">IM</option>
                                            <option value="PO">PO</option>
                                            <option value="Others">Others</option>
                                        </select>
                                        {isOtherRoute && (
                                            <input 
                                                className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newDrug.route}
                                                onChange={e => setNewDrug({...newDrug, route: e.target.value})}
                                                placeholder="Specify..."
                                            />
                                        )}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Frequency (Hours only)</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={frequencyInput} 
                                        onChange={e => setFrequencyInput(e.target.value)} 
                                        placeholder="e.g. 8" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Start Date</label>
                                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newDrug.start_date || ''} onChange={e => setNewDrug({...newDrug, start_date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Plan (Days)</label>
                                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newDrug.planned_duration || ''} onChange={e => setNewDrug({...newDrug, planned_duration: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Resident</label>
                                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newDrug.requesting_resident || ''} onChange={e => setNewDrug({...newDrug, requesting_resident: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">IDS In-charge</label>
                                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={newDrug.ids_in_charge || ''} onChange={e => setNewDrug({...newDrug, ids_in_charge: e.target.value})} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-blue-100">
                                <button onClick={() => { setIsAddingDrug(false); resetNewDrugForm(); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-200">Cancel</button>
                                <button onClick={handleSaveDrug} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">{editingDrugId ? 'Update Drug' : 'Register Drug'}</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setIsAddingDrug(true)} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group bg-white">
                            <div className="w-8 h-8 rounded-full bg-gray-200 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            Register New Antimicrobial
                        </button>
                    )}

                    {/* Active List */}
                    <div className="space-y-6">
                        {sortedAntimicrobials.map((drug, idx) => {
                            const isStopped = drug.status === 'Stopped';
                            const isShifted = drug.status === 'Shifted';
                            const isActive = drug.status === 'Active';
                            const statusBg = isActive ? 'bg-green-100 text-green-700' : isStopped ? 'bg-red-100 text-red-700' : isShifted ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';
                            
                            const currentDay = calculateDay(drug.start_date);
                            const plannedDays = parseInt(drug.planned_duration || '0');
                            const canContinue = isActive && currentDay >= plannedDays;
                            const missedCount = countMissedDoses(drug.administration_log || {});
                            
                            const therapyDay = calculateTherapyDay(drug);

                            return (
                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                                {/* Header Row */}
                                <div className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-gray-100 bg-gray-50/50">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-bold text-xl text-gray-800">{drug.drug_name}</h4>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusBg}`}>
                                            {drug.status}
                                        </span>
                                        {missedCount > 0 && (
                                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                                                {missedCount} Missed
                                            </span>
                                        )}
                                        {isActive && (
                                            <button onClick={() => handleEditDrug(drug)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase">Therapy Duration</span>
                                            <span className="font-mono font-bold text-blue-700 text-lg">{therapyDay}</span>
                                        </div>
                                        {drug.sensitivity_info && (
                                            <div className="text-right border-l pl-4 border-gray-200">
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase">Sensitivity</span>
                                                <span className="text-xs font-bold text-purple-700 block max-w-[150px] truncate" title={drug.sensitivity_info}>{drug.sensitivity_info}</span>
                                                <span className="text-[10px] text-gray-500">{drug.sensitivity_date}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                                    <div className="lg:col-span-1 p-3 bg-white flex flex-col justify-between">
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                                            <div className="col-span-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Regimen</span>
                                                <p className="font-bold text-gray-800 text-sm">{drug.dose} {drug.route} {drug.frequency}</p>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Start Date</span>
                                                <p className="font-bold text-gray-800 text-xs">{drug.start_date}</p>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Plan</span>
                                                <p className="font-bold text-gray-800 text-xs">{drug.planned_duration ? `${drug.planned_duration} Days` : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Resident</span>
                                                <p className="font-medium text-gray-800 truncate text-xs">{drug.requesting_resident || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase block">IDS In-charge</span>
                                                <p className="font-medium text-gray-800 truncate text-xs">{drug.ids_in_charge || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {(isStopped || isShifted) && (
                                            <div className="mt-2 pt-2 border-t border-red-100 bg-red-50/50 -mx-3 px-3 pb-2">
                                                <span className="text-[9px] font-bold text-red-400 uppercase block">Reason</span>
                                                <p className="text-xs font-bold text-red-800">{isStopped ? drug.stop_reason : drug.shift_reason || 'N/A'}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(drug.stop_date || drug.shifted_at || '').toLocaleString()}</p>
                                            </div>
                                        )}

                                        {isActive ? (
                                            <div className="mt-3 pt-2 border-t border-gray-100">
                                                <div className="flex justify-end mb-2"><button onClick={() => openSensitivityModal(drug)} className="text-xs text-blue-600 font-bold hover:underline"> {drug.sensitivity_info ? 'Edit' : '+'} Sensitivity</button></div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {canContinue && <button onClick={() => initiateStatusChange(drug.id, 'Continue')} className="py-1.5 bg-blue-600 text-white rounded text-[10px] font-bold col-span-2">Continue</button>}
                                                    <button onClick={() => initiateStatusChange(drug.id, 'Dose Change')} className="py-1.5 bg-teal-600 text-white rounded text-[10px] font-bold">Dose Changed</button>
                                                    <button onClick={() => initiateStatusChange(drug.id, 'Shifted')} className="py-1.5 bg-amber-500 text-white rounded text-[10px] font-bold">Shifted</button>
                                                    <button onClick={() => initiateStatusChange(drug.id, 'Completed')} className="py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold">Complete</button>
                                                    <button onClick={() => initiateStatusChange(drug.id, 'Stopped')} className="py-1.5 bg-red-600 text-white rounded text-[10px] font-bold">Stop Order</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-2 pt-2 border-t border-gray-100"><button onClick={() => setUndoModal({ isOpen: true, drugId: drug.id })} className="text-xs text-blue-500 hover:text-blue-700 font-medium underline">Undo Status Change</button></div>
                                        )}
                                    </div>

                                    <div className="lg:col-span-1 bg-gray-50 flex flex-col h-full overflow-hidden" style={{ maxHeight: '22rem' }}>
                                        <div className="p-3 border-b border-gray-200 bg-gray-100 flex justify-between items-center shrink-0"><span className="text-xs font-bold text-gray-500 uppercase">Administration Log</span></div>
                                        <div className="flex-1 overflow-y-auto p-3 space-y-0">
                                            {getDatesForLog(drug.start_date, drug.stop_date || drug.completed_at || drug.shifted_at).sort((a, b) => b.getTime() - a.getTime()).slice(0, 6).map((dateObj, i) => {
                                                const dateStr = dateObj.toISOString().split('T')[0];
                                                const logs = drug.administration_log?.[dateStr] || [];
                                                const dayNum = getDayNumber(drug.start_date, dateObj);
                                                const slots = drug.frequency_hours ? Math.floor(24 / drug.frequency_hours) : 1;
                                                const slotArray = Array.from({length: slots});

                                                return (
                                                    <div key={dateStr} className="flex items-center text-sm border-b border-gray-200 py-3 last:border-0 hover:bg-gray-100/50 transition-colors px-2">
                                                        <div className="w-20 shrink-0 text-right border-r border-gray-300 pr-3"><span className="block font-bold text-gray-700 text-xs">Day {dayNum}</span><span className="block text-[10px] text-gray-500">{dateObj.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}</span></div>
                                                        <div className="flex-1 flex flex-wrap gap-2 items-center pl-3">
                                                            {slotArray.map((_, sIdx) => {
                                                                const entry = logs[sIdx];
                                                                const logData = entry ? normalizeLogEntry(entry) : null;
                                                                if (logData) {
                                                                    const isMissed = logData.status === 'Missed';
                                                                    return (<div key={sIdx} className={`relative group inline-flex items-center gap-1 border px-2 py-1 rounded text-xs font-mono shadow-sm cursor-default ${isMissed ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`}>{isMissed ? 'Missed' : logData.time}{isActive && <button onClick={() => handleDeleteLogTime(drug.id, dateStr, sIdx)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1">&times;</button>}{isMissed && logData.reason && (<div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] p-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">{logData.reason}</div>)}</div>);
                                                                } else {
                                                                    return isActive ? (<button key={sIdx} onClick={() => {setAdminModal({ isOpen: true, drugId: drug.id, dateStr, slotIndex: sIdx }); setAdminTime(''); setAdminStatus('Given');}} className="w-16 h-6 border border-dashed border-gray-300 rounded bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center text-gray-400 hover:text-blue-500"><span className="text-[10px]">+</span></button>) : <span key={sIdx} className="w-16 h-6 border border-transparent"></span>;
                                                                }
                                                            })}
                                                        </div>
                                                    </div>);
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>

    {/* Admin Log Modal */}
    {adminModal && adminModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Record Administration</h3>
                
                <div className="space-y-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setAdminStatus('Given')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${adminStatus === 'Given' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Given</button>
                        <button onClick={() => setAdminStatus('Missed')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${adminStatus === 'Missed' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Missed</button>
                    </div>

                    {adminStatus === 'Given' ? (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Time Given</label>
                            <input type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={adminTime} onChange={(e) => setAdminTime(e.target.value)} />
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Reason for Missing</label>
                            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white" value={adminMissReason} onChange={(e) => setAdminMissReason(e.target.value)}>
                                <option value="">Select Reason</option>
                                {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {adminMissReason === 'Others (Specify)' && (
                                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Specify..." value={adminMissReasonOther} onChange={(e) => setAdminMissReasonOther(e.target.value)} />
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={() => setAdminModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium bg-white border border-gray-200">Cancel</button>
                    <button onClick={handleAdminLogSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">Save</button>
                </div>
            </div>
        </div>
    )}

    {/* Status Change Sub-Modal */}
    {statusAction && statusAction.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-2">Confirm {statusAction.type}</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Date & Time</label>
                        <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={actionDateTime} onChange={(e) => setActionDateTime(e.target.value)} />
                    </div>

                    {statusAction.type === 'Dose Change' && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">New Dose</label>
                            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. 500mg" value={newDoseValue} onChange={(e) => setNewDoseValue(e.target.value)} />
                            <label className="text-xs font-bold text-gray-500 uppercase block mt-2 mb-1">Reason for Change</label>
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white text-gray-900"
                                value={statusReasonType}
                                onChange={(e) => setStatusReasonType(e.target.value)}
                            >
                                <option value="">Select Reason</option>
                                {DOSE_CHANGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {statusReasonType === 'Others (Specify)' && (
                                <input 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none mt-2" 
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
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white text-gray-900"
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
                    <button onClick={() => setStatusAction(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium bg-white border border-gray-200">Cancel</button>
                    <button onClick={confirmStatusChange} disabled={!actionDateTime || loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">Confirm</button>
                </div>
            </div>
        </div>
    )}

    {/* Undo Status Confirmation Modal */}
    {undoModal && undoModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border-t-4 border-amber-500">
                <div className="flex items-start gap-4 mb-4">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Undo Status Change?</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            This will revert the status to <strong>Active</strong>. Recorded stop dates and reasons will be cleared.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setUndoModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                    <button onClick={confirmUndo} disabled={loading} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-amber-600 transition-colors">Yes, Undo Change</button>
                </div>
            </div>
        </div>
    )}

    {/* Sensitivity Sub-Modal */}
    {sensitivityModal && sensitivityModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={sensitivityModal.date}
                            onChange={(e) => setSensitivityModal({...sensitivityModal, date: e.target.value})}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={() => setSensitivityModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium bg-white border border-gray-200">Cancel</button>
                    <button onClick={saveSensitivity} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors">Save</button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default MonitoringDetailModal;