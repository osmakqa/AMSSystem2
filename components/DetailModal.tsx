import React, { useState, useEffect } from 'react';
import { Prescription, UserRole, PrescriptionStatus, DrugType, ActionType } from '../types';
import { IDS_SPECIALISTS } from '../constants'; 
import { PEDIATRIC_MONOGRAPHS } from '../data/pediatricMonographs';
import { verifyPediatricDosing } from '../services/geminiService';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Prescription | null;
  role?: string;
  onAction?: (id: number, action: ActionType) => void;
}

// --- Lifecycle Tracker Component ---
const LifecycleTracker: React.FC<{ item: Prescription }> = ({ item }) => {
  const stages = [
    {
      name: 'Request Created',
      isComplete: true,
      isInProgress: false,
      info: `By ${item.requested_by} on ${new Date(item.req_date).toLocaleDateString()}`
    },
    {
      name: 'Pharmacist Action',
      isComplete: item.status !== PrescriptionStatus.PENDING,
      isInProgress: item.status === PrescriptionStatus.PENDING,
      info: item.dispensed_date ? `Action on ${new Date(item.dispensed_date).toLocaleDateString()}` : (item.status === PrescriptionStatus.FOR_IDS_APPROVAL ? 'Forwarded to IDS' : 'Awaiting review...')
    },
    ...(item.drug_type === DrugType.RESTRICTED ? [{
      name: 'IDS Review',
      isComplete: !!item.ids_approved_at || !!item.ids_disapproved_at,
      isInProgress: item.status === PrescriptionStatus.FOR_IDS_APPROVAL,
      info: item.ids_approved_at ? `Approved ${new Date(item.ids_approved_at).toLocaleDateString()}` : (item.ids_disapproved_at ? `Disapproved ${new Date(item.ids_disapproved_at).toLocaleDateString()}`: 'Awaiting Specialist...')
    }] : []),
    {
      name: 'Finalized',
      isComplete: item.status === PrescriptionStatus.APPROVED || item.status === PrescriptionStatus.DISAPPROVED,
      isInProgress: false,
      info: item.status === PrescriptionStatus.APPROVED ? 'Approved' : (item.status === PrescriptionStatus.DISAPPROVED ? 'Disapproved' : 'In Progress')
    }
  ];

  const Icon = ({ isComplete, isInProgress }: { isComplete: boolean, isInProgress: boolean }) => {
    if (isComplete) {
      return (
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
      );
    }
    if (isInProgress) {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center relative">
           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
           <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-gray-300"></div>
    );
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
      <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider">Request Lifecycle</h4>
      <div className="flex justify-between items-start">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.name}>
            <div className="flex flex-col items-center text-center w-24">
              <Icon isComplete={stage.isComplete} isInProgress={stage.isInProgress} />
              <p className={`text-xs font-bold mt-2 ${stage.isComplete ? 'text-green-700' : 'text-gray-600'}`}>{stage.name}</p>
              <p className="text-[11px] text-gray-500">{stage.info}</p>
            </div>
            {index < stages.length - 1 && (
              <div className="flex-1 h-px bg-gray-300 mt-4 mx-2"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};


const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, item, role, onAction }) => {
  const [dosingCheck, setDosingCheck] = useState<{ isSafe: boolean; message: string } | null>(null);
  const [isCheckingDose, setIsCheckingDose] = useState(false);

  useEffect(() => {
    let active = true;
    const checkDose = async () => {
      if (item && item.mode === 'pediatric' && (role === UserRole.PHARMACIST || role === UserRole.AMS_ADMIN || role === UserRole.IDS)) {
        setIsCheckingDose(true);
        const monograph = PEDIATRIC_MONOGRAPHS[item.antimicrobial];
        if (monograph) {
          const result = await verifyPediatricDosing(
            item.antimicrobial, 
            item.weight_kg || '', 
            item.age || '', 
            item.dose || '', 
            item.frequency || '', 
            monograph.dosing
          );
          if (active && result) setDosingCheck(result);
        }
        if (active) setIsCheckingDose(false);
      } else {
        setDosingCheck(null);
      }
    };
    if (isOpen) {
      setDosingCheck(null);
      checkDose();
    }
    return () => { active = false; };
  }, [isOpen, item, role]);

  if (!isOpen || !item) return null;

  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const formatStatus = (status: string) => {
     if (!status) return 'N/A';
     if (status === 'for_ids_approval') return 'For IDS Approval';
     return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const SectionTitle = ({ title }: { title: string }) => <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider border-b border-green-100 pb-1 mb-3 mt-2">{title}</h3>;
  const InfoItem = ({ label, value, fullWidth = false }: { label: string, value?: any, fullWidth?: boolean }) => {
    let displayValue = value;
    if (typeof value === 'object' && value !== null) displayValue = JSON.stringify(value, null, 2).replace(/[{}"\[\]]/g, '');
    return <div className={fullWidth ? 'col-span-full' : ''}><p className="text-xs text-gray-500 uppercase font-semibold">{label}</p><p className="text-sm text-gray-900 font-medium break-words whitespace-pre-wrap">{displayValue || '-'}</p></div>;
  };
  
  const FormattedBlock = ({ label, value, colorClass = "bg-gray-50 border-gray-200 text-gray-800" }: { label: string, value?: any, colorClass?: string }) => {
    const renderOrganismsJSON = (val: any) => {
        try {
            const data = typeof val === 'string' && (val.startsWith('[') || val.startsWith('{')) ? JSON.parse(val) : val;
            if (Array.isArray(data) && data.length > 0 && data[0].hasOwnProperty('name') && data[0].hasOwnProperty('susceptibilities')) {
                return data.map((org: any, i: number) => (
                    <div key={i} className={i > 0 ? "mt-6 pt-4 border-t border-gray-200" : ""}>
                        <div className="mb-2"><span className="font-bold text-gray-900">Name:</span> <span className="text-gray-800 font-medium ml-1 capitalize">{org.name}</span></div>
                        <div className="pl-4 mb-2 font-bold text-gray-700 text-sm">Susceptibilities</div>
                        {Array.isArray(org.susceptibilities) && org.susceptibilities.map((susc: any, j: number) => {
                             let resultColor = 'text-gray-800';
                             const res = susc.result ? String(susc.result).toUpperCase() : '';
                             if (res.startsWith('S')) resultColor = 'text-green-700 font-bold';
                             if (res.startsWith('R')) resultColor = 'text-red-700 font-bold';
                            return (<div key={j} className="pl-4 mb-4"><div className="mb-1"><span className="font-bold text-gray-900">Drug:</span> <span className="text-gray-800 ml-1 capitalize">{susc.drug}</span></div><div><span className="font-bold text-gray-900">Result:</span> <span className={`ml-1 ${resultColor}`}>{susc.result}</span></div></div>);
                        })}
                    </div>
                ));
            }
            return null;
        } catch (e) { return null; }
    };

    const renderRichText = (val: any) => {
        let text = typeof val === 'object' && val !== null ? (Array.isArray(val) ? val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join('\n') : JSON.stringify(val, null, 2)) : String(val || "");
        text = text.replace(/[{}"\[\]]/g, '');
        if (!text || text.trim() === '' || text === 'null') return <span className="text-gray-400 italic">None</span>;

        return text.split('\n').map((line, i) => {
            const cleanLine = line.trim();
            if (!cleanLine) return <div key={i} className="h-1"></div>;
            const lower = cleanLine.toLowerCase();
            let content = <>{cleanLine}</>;
            const match = cleanLine.match(/^([^:]+):(.*)$/);
            let isSubItem = lower.includes('frequency') || lower.includes('duration');
            let isDrug = (lower.startsWith('drug') || lower.startsWith('antimicrobial')) && !lower.includes('result:');

            if (match) {
                let key = match[1].trim();
                const valuePart = match[2].trim();
                if (key.toLowerCase() === 'name') key = 'Name';
                else if (key.toLowerCase().includes('susceptibilities')) key = 'Susceptibilities';
                else if (key.toLowerCase().includes('drug')) key = 'Drug';
                if (['s','r'].includes(key.toLowerCase()) || key.toLowerCase().startsWith('s (') || key.toLowerCase().startsWith('r (')) return <div key={i} className={`${key.toLowerCase().startsWith('s')?'text-green-700':'text-red-700'} font-bold ml-4`}>{key.substring(0,1).toUpperCase()}: {valuePart}</div>;
                
                if (['drug','antimicrobial','frequency','duration','indication','dose','name'].some(k => key.toLowerCase().includes(k))) content = <><span className="font-bold text-gray-900">{key}:</span> <span className="text-gray-800">{valuePart}</span></>;
            }
            return <div key={i} className={`${lower.startsWith('frequency')?'mb-4':'mb-1'} ${(isDrug && i>0)?'mt-3 pt-2 border-t border-gray-300/50 border-dashed':''} ${isSubItem?'pl-5 text-sm opacity-90':''}`}>{content}</div>;
        });
    };

    const jsonRendered = renderOrganismsJSON(value);
    return <div className="col-span-full"><p className="text-xs text-gray-500 uppercase font-semibold mb-1">{label}</p><div className={`p-3 rounded-md border text-sm shadow-sm min-h-[120px] max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words ${colorClass}`}>{jsonRendered ? jsonRendered : renderRichText(value)}</div></div>;
  };

  const handleAction = (action: ActionType) => { 
    if (onAction) { 
      onAction(item.id, action); 
      onClose(); 
    } 
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-start sticky top-0 z-10 shadow-sm">
          <div><div className="flex items-center gap-3"><h2 className="text-2xl font-bold">{item.patient_name}</h2><span className="px-3 py-0.5 rounded-full text-xs font-bold bg-white/20 border border-white/30 backdrop-blur-md">{formatStatus(item.status)}</span></div><div className="flex gap-4 mt-2 text-sm opacity-90"><p>ID: <span className="font-mono font-bold bg-green-800 px-2 py-0.5 rounded ml-1">{item.hospital_number}</span></p><p>Date: <span className="font-bold ml-1">{item.req_date ? new Date(item.req_date).toLocaleDateString() : 'N/A'}</span></p></div></div>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-green-600 rounded-full p-2 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-6">

          {/* Lifecycle Tracker */}
          <LifecycleTracker item={item} />
          
          {/* Pediatric Dosing AI Check */}
          {(isCheckingDose || dosingCheck) && (
             <div className={`p-4 rounded-lg border-l-4 shadow-sm mb-2 ${dosingCheck?.isSafe ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'}`}>
                {isCheckingDose ? (
                   <p className="text-sm text-gray-500 italic animate-pulse">Verifying pediatric dosage with AI...</p>
                ) : (
                   <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${dosingCheck?.isSafe ? 'text-green-600' : 'text-yellow-600'}`}>
                         {dosingCheck?.isSafe ? 
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> 
                           : 
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                         }
                      </div>
                      <div>
                         <h4 className={`text-sm font-bold uppercase ${dosingCheck?.isSafe ? 'text-green-800' : 'text-yellow-800'}`}>
                           {dosingCheck?.isSafe ? 'Dosing Verified' : 'Dosing Alert'}
                         </h4>
                         <p className="text-sm text-gray-700 mt-1">{dosingCheck?.message}</p>
                      </div>
                   </div>
                )}
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100"><SectionTitle title="Patient Profile" /><div className="grid grid-cols-2 gap-y-4 gap-x-2"><InfoItem label="Age" value={item.age} /><InfoItem label="Sex" value={item.sex} /><InfoItem label="Weight (kg)" value={item.weight_kg} /><InfoItem label="Height (cm)" value={item.height_cm} /><InfoItem label="Ward" value={item.ward} fullWidth /></div></div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100"><SectionTitle title="Clinical Data" /><div className="grid grid-cols-2 gap-y-4 gap-x-2"><InfoItem label="Diagnosis" value={item.diagnosis} fullWidth /><InfoItem label="SGPT" value={item.sgpt} /><InfoItem label="SCr (mg/dL)" value={item.scr_mgdl} /><InfoItem label="eGFR" value={item.egfr_text} fullWidth /></div></div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100"><SectionTitle title="Medication Request" /><div className="space-y-3"><InfoItem label="Antimicrobial" value={item.antimicrobial} fullWidth /><div className="grid grid-cols-2 gap-2"><InfoItem label="Drug Type" value={item.drug_type} /><InfoItem label="Dose" value={item.dose} /></div><div className="grid grid-cols-2 gap-2"><InfoItem label="Frequency" value={item.frequency} /><InfoItem label="Duration" value={item.duration} /></div></div></div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 md:col-span-1"><SectionTitle title="Indication" /><div className="space-y-4"><InfoItem label="Indication" value={item.indication} fullWidth /><InfoItem label="Basis of Indication" value={item.basis_indication} fullWidth /></div></div>
            {item.disapproved_reason && (<div className="bg-red-50 p-4 rounded-lg border border-red-200 col-span-full"><SectionTitle title="Disapproval Details" /><p className="text-red-800 font-medium">{item.disapproved_reason}</p></div>)}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm md:col-span-2"><SectionTitle title="Microbiology & History" /><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-3"><FormattedBlock label="Previous Antibiotics" value={item.previous_antibiotics} colorClass="bg-orange-50 border-orange-100 text-orange-900"/></div><div className="space-y-3"><FormattedBlock label="Organisms / Specimen" value={item.organisms} colorClass="bg-red-50 border-red-100 text-red-900"/><InfoItem label="Specimen Source" value={item.specimen} fullWidth /></div></div></div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-full"><SectionTitle title="Personnel Involved" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><InfoItem label="Resident In-Charge" value={item.resident_name} /><InfoItem label="Service Resident" value={item.service_resident_name} /><InfoItem label="Clinical Dept" value={item.clinical_dept} /><InfoItem label="ID Specialist" value={item.id_specialist} /><div className="col-span-full pt-2 border-t border-gray-200 mt-2 grid grid-cols-2 md:grid-cols-4 gap-4"><InfoItem label="Dispensed By" value={item.dispensed_by} /><InfoItem label="Pharmacist Action Date" value={formatDate(item.dispensed_date)} /><InfoItem label="IDS Approval Date" value={formatDate(item.ids_approved_at)} /><InfoItem label="IDS Disapproval Date" value={formatDate(item.ids_disapproved_at)} /></div></div></div>
          </div>
          <div className="flex justify-between items-center text-xs pt-4 border-t border-gray-100 gap-4 flex-wrap">
             <div className="flex gap-4 text-gray-400"><span>Ref ID: #{item.id}</span></div>
             <div className="flex gap-2 items-center">
                 {role === UserRole.PHARMACIST && item.status === PrescriptionStatus.PENDING && (
                    <>{item.drug_type === DrugType.RESTRICTED ? (<><button onClick={() => handleAction(ActionType.FORWARD_IDS)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium shadow-sm">For IDS Approval</button><button onClick={() => handleAction(ActionType.DISAPPROVE)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded font-medium shadow-sm">Disapprove</button></>) : (<><button onClick={() => handleAction(ActionType.APPROVE)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium shadow-sm">Approve</button><button onClick={() => handleAction(ActionType.DISAPPROVE)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded font-medium shadow-sm">Disapprove</button></>)}<button onClick={() => handleAction(ActionType.DELETE)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded font-medium">Delete</button></>
                 )}
                 {role === UserRole.IDS && (item.status === PrescriptionStatus.FOR_IDS_APPROVAL) && (<><button onClick={() => handleAction(ActionType.APPROVE)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium shadow-sm">Approve</button><button onClick={() => handleAction(ActionType.DISAPPROVE)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded font-medium shadow-sm">Disapprove</button></>)}
                 <button onClick={onClose} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors border border-gray-300 ml-2">Close</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;