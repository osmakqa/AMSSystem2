import React, { useState, useEffect } from 'react';
import { AMSAudit } from '../types';
import { createAudit, updateAudit } from '../services/dataService';
import { checkRenalDosing, verifyPediatricDosing, verifyWeightBasedDosing } from '../services/geminiService';
import { ADULT_MONOGRAPHS } from '../data/adultMonographs';
import { PEDIATRIC_MONOGRAPHS } from '../data/pediatricMonographs';

interface AMSAuditFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AMSAudit | null;
}

// Helper functions for eGFR
const calcCkdEpi2021 = (age: number, sex: string, scr: number) => {
  const k = sex === "Female" ? 0.7 : 0.9;
  const alpha = sex === "Female" ? -0.241 : -0.302;
  const minScr = Math.min(scr/k,1);
  const maxScr = Math.max(scr/k,1);

  return 142 *
    Math.pow(minScr,alpha) *
    Math.pow(maxScr,-1.2) *
    Math.pow(0.9938,age) *
    (sex === "Female" ? 1.012 : 1);
};

const calcCkidHeightBased = (ht: number, scr: number) => {
  return 0.413 * (ht / scr);
};

const AMSAuditForm: React.FC<AMSAuditFormProps> = ({ isOpen, onClose, initialData }) => {
  const [patientMode, setPatientMode] = useState<'adult' | 'pediatric'>('adult');
  
  const [audit, setAudit] = useState({
    date: new Date().toISOString().split('T')[0],
    auditor: '',
    area: '',
    shift: '',
    generalNote: ''
  });

  const [patient, setPatient] = useState({
    hospNo: '',
    dob: '',
    ageString: '',
    sex: '',
    weight: '',
    height: '',
    scr: '',
    egfr: ''
  });

  const [dx, setDx] = useState({
    biomarkerUsed: 'No',
    biomarkerType: '',
    biomarkerTypeOther: '',
    fluidSample: '',
    fluidSampleOther: '',
    cultureDone: 'No',
    cultureSpecimen: '',
    cultureSpecimenOther: ''
  });

  const [hist, setHist] = useState({
    prevHosp3mo: 'No',
    prevAbx1mo: 'No'
  });

  const [abx, setAbx] = useState<any[]>([]);
  const [activeAbxIndex, setActiveAbxIndex] = useState<number | null>(null);
  const [micro, setMicro] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<Record<number, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setAudit({
        date: initialData.audit_date ? new Date(initialData.audit_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        auditor: initialData.auditor,
        area: initialData.area,
        shift: initialData.shift,
        generalNote: initialData.general_audit_note || ''
      });
      setPatient({
        hospNo: initialData.patient_hosp_no,
        dob: initialData.patient_dob ? new Date(initialData.patient_dob).toISOString().split('T')[0] : '',
        ageString: initialData.patient_age_string,
        sex: initialData.diagnostics?.sex || '',
        weight: initialData.diagnostics?.weight || '',
        height: initialData.diagnostics?.height || '',
        scr: initialData.diagnostics?.scr || '',
        egfr: initialData.diagnostics?.egfr || ''
      });
      setDx({ ...initialData.diagnostics });
      setHist({ ...initialData.history });
      setAbx(initialData.antimicrobials || []);
      setMicro(initialData.microorganisms || []);
      if (initialData.diagnostics?.height) setPatientMode('pediatric');
    } else {
      setAudit({ date: new Date().toISOString().split('T')[0], auditor: '', area: '', shift: '', generalNote: '' });
      setPatient({ hospNo: '', dob: '', ageString: '', sex: '', weight: '', height: '', scr: '', egfr: '' });
      setDx({ biomarkerUsed: 'No', biomarkerType: '', biomarkerTypeOther: '', fluidSample: '', fluidSampleOther: '', cultureDone: 'No', cultureSpecimen: '', cultureSpecimenOther: '' });
      setHist({ prevHosp3mo: 'No', prevAbx1mo: 'No' });
      setAbx([]);
      setMicro([]);
      setPatientMode('adult');
    }
  }, [initialData, isOpen]);

  // Age Calculation
  useEffect(() => {
    if (patient.dob && audit.date) {
      const dobDate = new Date(patient.dob);
      const auditDate = new Date(audit.date);
      
      let years = auditDate.getFullYear() - dobDate.getFullYear();
      let months = auditDate.getMonth() - dobDate.getMonth();
      let days = auditDate.getDate() - dobDate.getDate();

      if (days < 0) {
        months--;
        const prevMonth = new Date(auditDate.getFullYear(), auditDate.getMonth(), 0);
        days += prevMonth.getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      const parts: string[] = [];
      if (years > 0) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
      if (months > 0) parts.push(`${months} mo${months > 1 ? 's' : ''}`);
      if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

      setPatient(prev => ({ ...prev, ageString: parts.join(' ') }));
    } else {
      setPatient(prev => ({ ...prev, ageString: '' }));
    }
  }, [patient.dob, audit.date]);

  // eGFR Calculation
  useEffect(() => {
    if (!patient.scr) {
      if (patient.egfr && patient.egfr !== '—' && patient.egfr !== 'Pending') {
         setPatient(prev => ({...prev, egfr: ''}));
      }
      return;
    }

    let egfrText = '—';
    const scrNum = parseFloat(patient.scr);
    
    if (isNaN(scrNum) || scrNum <= 0) {
       setPatient(prev => ({...prev, egfr: ''}));
       return;
    }
    
    const scrMgDl = scrNum / 88.4; 

    if (patientMode === 'adult') {
        if (patient.dob && audit.date && patient.sex) {
             const dobDate = new Date(patient.dob);
             const auditDate = new Date(audit.date);
             let ageYears = auditDate.getFullYear() - dobDate.getFullYear();
             const m = auditDate.getMonth() - dobDate.getMonth();
             if (m < 0 || (m === 0 && auditDate.getDate() < dobDate.getDate())) {
                 ageYears--;
             }

             if (ageYears >= 0) {
                 const egfr = calcCkdEpi2021(ageYears, patient.sex, scrMgDl);
                 egfrText = isFinite(egfr) ? egfr.toFixed(1) + ' mL/min/1.73m²' : '—';
             }
        }
    } else {
        const htNum = parseFloat(patient.height);
        if (!isNaN(htNum) && htNum > 0) {
             const egfr = calcCkidHeightBased(htNum, scrMgDl);
             egfrText = isFinite(egfr) ? egfr.toFixed(1) + ' mL/min/1.73m²' : '—';
        } else {
             egfrText = 'Enter Height';
        }
    }

    setPatient(prev => ({...prev, egfr: egfrText}));

  }, [patient.scr, patient.height, patient.sex, patient.dob, audit.date, patientMode]);

  // AI Guardrails
  useEffect(() => {
      if (activeAbxIndex === null) return;
      const currentIndex = activeAbxIndex;
      const currentDrug = abx[currentIndex];
      if (!currentDrug || !currentDrug.drug) return;

      const runChecks = async () => {
          let results: any = { ...aiAnalysis[currentIndex] };
          let hasChanges = false;

          const monograph = patientMode === 'adult' ? ADULT_MONOGRAPHS[currentDrug.drug] : PEDIATRIC_MONOGRAPHS[currentDrug.drug];
          if (patient.egfr && monograph?.renal) {
              const renalRes = await checkRenalDosing(currentDrug.drug, patient.egfr, monograph.renal);
              if (renalRes) {
                  results.renal = renalRes;
                  hasChanges = true;
              }
          }

          if (patient.weight && currentDrug.dose) {
              if (patientMode === 'pediatric') {
                  const pediaRes = await verifyPediatricDosing(currentDrug.drug, patient.weight, patient.ageString, currentDrug.dose, currentDrug.freq, PEDIATRIC_MONOGRAPHS[currentDrug.drug]?.dosing || '');
                  if (pediaRes) {
                      results.pediatric = pediaRes;
                      hasChanges = true;
                  }
              } else {
                   if (monograph?.weightBased) {
                       const weightRes = await verifyWeightBasedDosing('adult', currentDrug.drug, patient.weight, currentDrug.dose, currentDrug.freq, monograph.dosing);
                       if (weightRes) {
                           results.weight = weightRes;
                           hasChanges = true;
                       }
                   }
              }
          }

          if (hasChanges) {
              setAiAnalysis(prev => ({ ...prev, [currentIndex]: results }));
          }
      };

      const timer = setTimeout(() => {
          runChecks();
      }, 1500);
      return () => clearTimeout(timer);
  }, [activeAbxIndex, abx, patient.egfr, patient.weight, patientMode]);

  const handleSave = async () => {
      setIsSubmitting(true);
      try {
          const payload = {
              audit_date: new Date(audit.date).toISOString(),
              auditor: audit.auditor,
              area: audit.area,
              shift: audit.shift,
              patient_hosp_no: patient.hospNo,
              patient_dob: patient.dob,
              patient_age_string: patient.ageString,
              general_audit_note: audit.generalNote,
              diagnostics: { ...dx, sex: patient.sex, weight: patient.weight, height: patient.height, scr: patient.scr, egfr: patient.egfr },
              history: hist,
              antimicrobials: abx,
              microorganisms: micro,
              created_at: new Date().toISOString()
          };

          if (initialData?.id) {
              await updateAudit(initialData.id, payload);
          } else {
              await createAudit(payload);
          }
          onClose();
      } catch (err) {
          console.error(err);
          alert("Failed to save audit.");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
         <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
             <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Edit Audit Record' : 'New AMS Audit'}</h3>
             <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
         </div>

         <div className="flex-1 overflow-y-auto p-6 space-y-6">
             <div className="flex justify-center mb-4">
                 <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button type="button" onClick={() => setPatientMode('adult')} className={`px-4 py-2 text-sm font-medium border border-gray-200 rounded-l-lg ${patientMode === 'adult' ? 'bg-green-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-100'}`}>Adult</button>
                    <button type="button" onClick={() => setPatientMode('pediatric')} className={`px-4 py-2 text-sm font-medium border border-gray-200 rounded-r-lg ${patientMode === 'pediatric' ? 'bg-green-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-100'}`}>Pediatric</button>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 border rounded bg-gray-50">
                     <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">Audit Details</h4>
                     <label className="block text-sm font-medium text-gray-700">Date</label>
                     <input type="date" value={audit.date} onChange={e => setAudit({...audit, date: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                     <label className="block text-sm font-medium text-gray-700">Auditor</label>
                     <input type="text" value={audit.auditor} onChange={e => setAudit({...audit, auditor: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Area</label>
                            <input type="text" value={audit.area} onChange={e => setAudit({...audit, area: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Shift</label>
                            <input type="text" value={audit.shift} onChange={e => setAudit({...audit, shift: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                        </div>
                     </div>
                 </div>
                 <div className="p-4 border rounded bg-gray-50">
                     <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">Patient Details</h4>
                     <label className="block text-sm font-medium text-gray-700">Hospital Number</label>
                     <input type="text" value={patient.hospNo} onChange={e => setPatient({...patient, hospNo: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                     <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                     <input type="date" value={patient.dob} onChange={e => setPatient({...patient, dob: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                     <div className="text-xs font-semibold text-blue-600 mb-2">Age: {patient.ageString}</div>
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Sex</label>
                            <select value={patient.sex} onChange={e => setPatient({...patient, sex: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2">
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                            <input type="number" value={patient.weight} onChange={e => setPatient({...patient, weight: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                        </div>
                     </div>
                     {patientMode === 'pediatric' && (
                         <>
                             <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                             <input type="number" value={patient.height} onChange={e => setPatient({...patient, height: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-2" />
                         </>
                     )}
                     <label className="block text-sm font-medium text-gray-700">Serum Creatinine (µmol/L)</label>
                     <input type="number" value={patient.scr} onChange={e => setPatient({...patient, scr: e.target.value})} className="border border-gray-300 p-1.5 w-full rounded mb-1" />
                     <div className="text-xs font-semibold text-blue-600">eGFR: {patient.egfr}</div>
                 </div>
             </div>
             
             {/* Antibiotics Section */}
             <div className="p-4 border rounded bg-white shadow-sm">
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                    <h4 className="font-bold text-gray-800">Antimicrobials</h4>
                    <button onClick={() => setAbx([...abx, {drug: '', dose: '', freq: '', unitDose: '', unit: 'mg', route: 'IV', treatment: 'Empiric'}])} className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Add Drug</button>
                </div>
                {abx.length === 0 && <p className="text-gray-400 italic text-sm text-center py-4">No antimicrobials added.</p>}
                {abx.map((a, i) => (
                    <div key={i} className={`mb-3 p-3 border rounded-lg transition-colors ${activeAbxIndex === i ? 'ring-2 ring-blue-400 border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`} onClick={() => setActiveAbxIndex(i)}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                            <input placeholder="Drug Name" value={a.drug} onChange={e => {
                                const newAbx = [...abx];
                                newAbx[i].drug = e.target.value;
                                setAbx(newAbx);
                            }} className="border p-1.5 rounded" />
                            <input placeholder="Unit Dose" value={a.unitDose} onChange={e => {
                                const newAbx = [...abx];
                                newAbx[i].unitDose = e.target.value;
                                setAbx(newAbx);
                            }} className="border p-1.5 rounded" />
                             <input placeholder="Frequency (e.g. q8h)" value={a.freq} onChange={e => {
                                const newAbx = [...abx];
                                newAbx[i].freq = e.target.value;
                                setAbx(newAbx);
                            }} className="border p-1.5 rounded" />
                             <input placeholder="Full Dose (e.g. 1g)" value={a.dose} onChange={e => {
                                const newAbx = [...abx];
                                newAbx[i].dose = e.target.value;
                                setAbx(newAbx);
                            }} className="border p-1.5 rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <select value={a.treatment} onChange={e => {
                                 const newAbx = [...abx];
                                 newAbx[i].treatment = e.target.value;
                                 setAbx(newAbx);
                             }} className="border p-1.5 rounded text-sm">
                                 <option value="Empiric">Empiric</option>
                                 <option value="Targeted">Targeted</option>
                                 <option value="Prophylaxis">Prophylaxis</option>
                             </select>
                             <input placeholder="Diagnosis / Indication" value={a.diagnosis} onChange={e => {
                                const newAbx = [...abx];
                                newAbx[i].diagnosis = e.target.value;
                                setAbx(newAbx);
                            }} className="border p-1.5 rounded text-sm" />
                        </div>
                        
                        {/* AI Warning Display inside Drug Card */}
                        {aiAnalysis[i] && (
                            <div className="mt-2 space-y-1">
                                {aiAnalysis[i].renal && (
                                    <div className="text-xs bg-yellow-100 text-yellow-800 p-1.5 rounded border border-yellow-200">
                                        <strong>Renal Alert:</strong> {aiAnalysis[i].renal.recommendation}
                                    </div>
                                )}
                                {aiAnalysis[i].pediatric && (
                                    <div className={`text-xs p-1.5 rounded border ${aiAnalysis[i].pediatric.isSafe ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                        <strong>Pedia Check:</strong> {aiAnalysis[i].pediatric.message}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="mt-2 flex justify-end">
                            <button onClick={(e) => { e.stopPropagation(); setAbx(abx.filter((_, idx) => idx !== i)); }} className="text-red-500 text-xs underline">Remove</button>
                        </div>
                    </div>
                ))}
             </div>
             
             {/* General Note */}
             <div className="p-4 border rounded bg-white shadow-sm">
                 <h4 className="font-bold text-gray-700 mb-2">General Audit Note</h4>
                 <textarea value={audit.generalNote} onChange={e => setAudit({...audit, generalNote: e.target.value})} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" rows={3} placeholder="Overall comments..."></textarea>
             </div>
         </div>

         <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
             <button onClick={onClose} className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 font-medium">Cancel</button>
             <button onClick={handleSave} disabled={isSubmitting} className="px-5 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 font-medium flex items-center gap-2">
                 {isSubmitting ? 'Saving...' : 'Save Audit Record'}
             </button>
         </div>
      </div>
    </div>
  );
};

export default AMSAuditForm;