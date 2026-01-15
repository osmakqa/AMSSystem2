

import React, { useState, useEffect } from 'react';
import { Prescription, UserRole, PrescriptionStatus, DrugType, ActionType, RequestFinding } from '../types';
import { IDS_SPECIALISTS } from '../constants'; 
import { PEDIATRIC_MONOGRAPHS } from '../data/pediatricMonographs';
import { verifyPediatricDosing } from '../services/geminiService';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Prescription | null;
  role?: string;
  userName?: string;
  onAction?: (id: number, action: ActionType, payload?: any) => void;
}

// --- Lifecycle Tracker Component ---
const LifecycleTracker: React.FC<{ item: Prescription }> = ({ item }) => {
  const stages = [
    {
      name: 'Request Created',
      isComplete: true,
      isInProgress: false,
      info: `By ${item.resident_name || item.requested_by} on ${new Date(item.req_date).toLocaleDateString()}`
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

const FINDING_CATEGORIES = [
  'Wrong Choice',
  'Wrong Route',
  'Wrong Dose',
  'Wrong Duration',
  'No Infection',
  'Others'
];

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, item, role, userName, onAction }) => {
  const [dosingCheck, setDosingCheck] = useState<{ isSafe: boolean; message: string } | null>(null);
  const [isCheckingDose, setIsCheckingDose] = useState(false);
  
  // Findings State (local state for reviewer's current session for adding/removing)
  const [findings, setFindings] = useState<RequestFinding[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<string>('');
  const [currentDetails, setCurrentDetails] = useState<string>('');

  const isReviewer = role === UserRole.PHARMACIST || role === UserRole.AMS_ADMIN;
  // Use item.findings for display for all roles, but local 'findings' for reviewer's active editing session
  const findingsToDisplay = isReviewer ? findings : (item?.findings || []);


  useEffect(() => {
    let active = true;
    const checkDose = async () => {
      const shouldCheck = role === UserRole.PHARMACIST || role === UserRole.AMS_ADMIN || role === UserRole.IDS;
      
      if (item && item.mode === 'pediatric' && shouldCheck) {
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
    if (isOpen && item) {
      setDosingCheck(null);
      checkDose();
      if (isReviewer) { // Only initialize local findings state if the current user is a reviewer
        setFindings(item.findings || []);
      }
      setActiveSection(null);
      setCurrentCategory('');
      setCurrentDetails('');
    }
    return () => { active = false; };
  }, [isOpen, item, role, isReviewer]);

  if (!isOpen || !item) return null;

  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const formatStatus = (status: string) => {
     if (!status) return 'N/A';
     if (status === 'for_ids_approval') return 'For IDS Approval';
     return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleAction = (action: ActionType) => { 
    if (onAction) {
      if (action === ActionType.DISAPPROVE) {
        if (isReviewer) {
            // Validation for Disapproval for Reviewers using the Findings UI
            if (findings.length === 0) {
              alert("Please add at least one finding (click on a section to add notes) before disapproving.");
              return;
            }
            onAction(item.id, action, { findings }); 
        } else {
            // Non-reviewers (e.g. IDS) trigger normal disapprove modal via parent (App.tsx fallback)
            // Residents don't have disapprove action here
            onAction(item.id, action);
        }
      } else if (action === ActionType.APPROVE) {
        // Can optionally save findings on approval too if reviewer and findings exist
        if (isReviewer && findings.length > 0) {
             onAction(item.id, action, { findings });
        } else {
             onAction(item.id, action);
        }
      } else if (action === ActionType.SAVE_FINDINGS) {
        // Just save findings (only for reviewers)
        onAction(item.id, action, { findings });
      } else {
        onAction(item.id, action); 
      }
      onClose(); 
    } 
  };

  const handleAddFinding = () => {
    if (!activeSection || !currentCategory) return;
    const newFinding: RequestFinding = {
      id: Date.now().toString(),
      section: activeSection,
      category: currentCategory as any,
      details: currentDetails,
      timestamp: new Date().toISOString(),
      user: userName || (role === UserRole.PHARMACIST ? `Pharmacist` : `Admin`)
    };
    setFindings([...findings, newFinding]);
    setCurrentCategory('');
    setCurrentDetails('');
    setActiveSection(null); // Deselect after adding
  };

  const removeFinding = (id: string) => {
    setFindings(findings.filter(f => f.id !== id));
  };

  // --- Render Helpers ---
  const SectionTitle = ({ title }: { title: string }) => <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider border-b border-green-100 pb-1 mb-3 mt-2 pointer-events-none">{title}</h3>;
  
  const InfoItem = ({ label, value, fullWidth = false }: { label: string, value?: any, fullWidth?: boolean }) => {
    let displayValue = value;
    if (typeof value === 'object' && value !== null) displayValue = JSON.stringify(value, null, 2).replace(/[{}"\[\]]/g, '');
    return <div className={fullWidth ? 'col-span-full' : ''}><p className="text-xs text-gray-500 uppercase font-semibold">{label}</p><p className="text-sm text-gray-900 font-medium break-words whitespace-pre-wrap">{displayValue || '-'}</p></div>;
  };

  const SelectableSection = ({ id, title, children, className = '' }: { id: string, title: string, children?: React.ReactNode, className?: string }) => {
    const isSelected = isReviewer && activeSection === id; // Only reviewers can select
    const hasFinding = isReviewer && findings.some(f => f.section === id); // Only reviewers see their own temporary findings
    return (
      <div 
        onClick={() => isReviewer && setActiveSection(id)}
        className={`relative transition-all duration-200 ${className} ${isReviewer ? 'cursor-pointer hover:ring-2 hover:ring-green-400 hover:shadow-md' : ''} ${isSelected ? 'ring-2 ring-yellow-400 shadow-md' : ''} ${hasFinding ? 'border-l-4 border-l-red-400' : ''}`}
      >
        {isReviewer && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold pointer-events-none">
            Click to Review
          </div>
        )}
        <SectionTitle title={title} />
        {children}
      </div>
    );
  };
  
  const FormFormattedBlock = ({ label, value, colorClass = "bg-gray-50 border-gray-200 text-gray-800" }: { label: string, value?: any, colorClass?: string }) => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full h-[90vh] flex flex-col border border-gray-200 overflow-hidden ${isReviewer ? 'max-w-[95vw]' : 'max-w-4xl'}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-start shrink-0">
          <div><div className="flex items-center gap-3"><h2 className="text-2xl font-bold">{item.patient_name}</h2><span className="px-3 py-0.5 rounded-full text-xs font-bold bg-white/20 border border-white/30 backdrop-blur-md">{formatStatus(item.status)}</span></div><div className="flex gap-4 mt-2 text-sm opacity-90"><p>ID: <span className="font-mono font-bold bg-green-800 px-2 py-0.5 rounded ml-1">{item.hospital_number}</span></p><p>Date: <span className="font-bold ml-1">{item.req_date ? new Date(item.req_date).toLocaleDateString() : 'N/A'}</span></p></div></div>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-green-600 rounded-full p-2 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 min-h-0">
            
            {/* Left Scrollable Pane */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                
                {/* Lifecycle Tracker */}
                <LifecycleTracker item={item} />
                
                {/* Pediatric Dosing AI Check */}
                {(isCheckingDose || dosingCheck) && (
                    <div className={`p-4 rounded-lg border-l-4 shadow-sm mb-6 ${dosingCheck?.isSafe ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'}`}>
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
                    <SelectableSection id="Patient Profile" title="Patient Profile" className="bg-gray-50 p-4 rounded-lg border border-gray-100 group"><div className="grid grid-cols-2 gap-y-4 gap-x-2"><InfoItem label="Age" value={item.age} /><InfoItem label="Sex" value={item.sex} /><InfoItem label="Weight (kg)" value={item.weight_kg} /><InfoItem label="Height (cm)" value={item.height_cm} /><InfoItem label="Ward" value={item.ward} fullWidth /></div></SelectableSection>
                    
                    <SelectableSection id="Clinical Data" title="Clinical Data" className="bg-gray-50 p-4 rounded-lg border border-gray-100 group"><div className="grid grid-cols-2 gap-y-4 gap-x-2"><InfoItem label="Diagnosis" value={item.diagnosis} fullWidth /><InfoItem label="SGPT" value={item.sgpt} /><InfoItem label="SCr (mg/dL)" value={item.scr_mgdl} /><InfoItem label="eGFR" value={item.egfr_text} fullWidth /></div></SelectableSection>
                    
                    <SelectableSection id="Medication Request" title="Medication Request" className="bg-blue-50 p-4 rounded-lg border border-blue-100 group"><div className="space-y-3"><InfoItem label="Antimicrobial" value={item.antimicrobial} fullWidth /><div className="grid grid-cols-2 gap-2"><InfoItem label="Drug Type" value={item.drug_type} /><InfoItem label="Dose" value={item.dose} /></div><div className="grid grid-cols-2 gap-2"><InfoItem label="Frequency" value={item.frequency} /><InfoItem label="Duration" value={item.duration} /></div></div></SelectableSection>
                    
                    <SelectableSection id="Indication" title="Indication" className="bg-gray-50 p-4 rounded-lg border border-gray-100 md:col-span-1 group"><div className="space-y-4"><InfoItem label="Indication" value={item.indication} fullWidth /><InfoItem label="Basis of Indication" value={item.basis_indication} fullWidth /></div></SelectableSection>
                    
                    {/* NEW SECTION for Disapproval & Findings - visible to ALL when disapproved */}
                    {(item.status === PrescriptionStatus.DISAPPROVED) && (
                        <div className="col-span-full bg-red-50 p-4 rounded-lg border border-red-200">
                            <SectionTitle title="Disapproval & Review Findings" />
                            {item.disapproved_reason && (
                                <div className="mb-4">
                                    <h5 className="text-xs font-bold text-gray-700 uppercase mb-1">Disapproval Reason</h5>
                                    <p className="text-red-800 font-medium whitespace-pre-wrap">{item.disapproved_reason}</p>
                                </div>
                            )}
                            {findingsToDisplay.length > 0 && (
                                <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                                    <h5 className="text-xs font-bold text-gray-700 uppercase">Recorded Findings ({findingsToDisplay.length})</h5>
                                    {findingsToDisplay.map((f, idx) => (
                                        <div key={idx} className="bg-red-100 border-l-4 border-red-500 p-3 rounded-md shadow-sm relative group">
                                            {isReviewer && ( // Only reviewers can remove findings
                                                <button 
                                                    onClick={() => removeFinding(f.id)}
                                                    className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    &times;
                                                </button>
                                            )}
                                            <p className="text-xs font-bold text-red-800 uppercase mb-1">{f.section}</p>
                                            <p className="text-sm font-bold text-gray-900">{f.category}</p>
                                            <p className="text-xs text-gray-600 mt-1">{f.details}</p>
                                            <div className="mt-2 text-right">
                                                <span className="text-[10px] text-red-800 font-bold bg-white/40 px-1.5 py-0.5 rounded">Recorded by: {f.user}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!item.disapproved_reason && findingsToDisplay.length === 0 && (
                                <p className="text-sm text-gray-500 italic">No specific disapproval reason or findings recorded.</p>
                            )}
                        </div>
                    )}
                    
                    <SelectableSection id="Microbiology & History" title="Microbiology & History" className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm md:col-span-2 group"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-3"><FormFormattedBlock label="Previous Antibiotics" value={item.previous_antibiotics} colorClass="bg-orange-50 border-orange-100 text-orange-900"/></div><div className="space-y-3"><FormFormattedBlock label="Organisms / Specimen" value={item.organisms} colorClass="bg-red-50 border-red-100 text-red-900"/><InfoItem label="Specimen Source" value={item.specimen} fullWidth /></div></div></SelectableSection>
                    
                    <SelectableSection id="Personnel Involved" title="Personnel Involved" className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-full group"><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><InfoItem label="Resident In-Charge" value={item.resident_name} /><InfoItem label="Service Resident" value={item.service_resident_name} /><InfoItem label="Clinical Dept" value={item.clinical_dept} /><InfoItem label="ID Specialist" value={item.id_specialist} /><div className="col-span-full pt-2 border-t border-gray-200 mt-2 grid grid-cols-2 md:grid-cols-4 gap-4"><InfoItem label="Dispensed By" value={item.dispensed_by} /><InfoItem label="Pharmacist Action Date" value={formatDate(item.dispensed_date)} /><InfoItem label="IDS Approval Date" value={formatDate(item.ids_approved_at)} /><InfoItem label="IDS Disapproval Date" value={formatDate(item.ids_disapproved_at)} /></div></div></SelectableSection>
                </div>
            </div>

            {/* Right Pane: Findings (Only for Reviewers) */}
            {isReviewer && (
                <div className="w-[350px] bg-white border-l border-gray-200 shadow-lg flex flex-col z-10">
                    <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                        <h4 className="font-bold text-yellow-800 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                            Review Findings
                        </h4>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {activeSection ? (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm animate-fade-in">
                                <div className="flex justify-between items-center mb-2">
                                    <h5 className="text-xs font-bold text-blue-800 uppercase">Adding Finding For:</h5>
                                    <button onClick={() => setActiveSection(null)} className="text-blue-400 hover:text-blue-600">&times;</button>
                                </div>
                                <p className="text-sm font-bold text-gray-800 mb-3 border-b border-blue-200 pb-2">{activeSection}</p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Category</label>
                                        <select 
                                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            value={currentCategory}
                                            onChange={(e) => setCurrentCategory(e.target.value)}
                                        >
                                            <option value="">Select Category...</option>
                                            {FINDING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Details</label>
                                        <textarea 
                                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            rows={3}
                                            placeholder="Specific remarks..."
                                            value={currentDetails}
                                            onChange={(e) => setCurrentDetails(e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleAddFinding}
                                        disabled={!currentCategory}
                                        className="w-full bg-blue-600 text-white px-3 py-2 rounded-md text-xs font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                                    >
                                        Add Finding
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-sm">Click a section on the left to add a finding.</p>
                            </div>
                        )}

                        {/* Display of actively added/removed findings for reviewers only */}
                        {findings.length > 0 && (
                            <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                                <h5 className="text-xs font-bold text-gray-400 uppercase">Recorded Findings ({findings.length})</h5>
                                {findings.map((f, idx) => (
                                    <div key={idx} className="bg-red-50 border-l-4 border-red-400 p-3 rounded-md shadow-sm relative group">
                                        <button 
                                            onClick={() => removeFinding(f.id)}
                                            className="absolute top-2 right-2 text-red-300 hover:text-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            &times;
                                        </button>
                                        <p className="text-xs font-bold text-red-800 uppercase mb-1">{f.section}</p>
                                        <p className="text-sm font-bold text-gray-900">{f.category}</p>
                                        <p className="text-xs text-gray-600 mt-1">{f.details}</p>
                                        <div className="mt-2 text-right">
                                            <span className="text-[9px] text-red-800 font-bold opacity-80 italic">By: {f.user}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center gap-4 shrink-0">
             <div className="text-xs text-gray-400">Ref ID: #{item.id}</div>
             <div className="flex gap-3">
                 {role === UserRole.PHARMACIST && item.status === PrescriptionStatus.PENDING && (
                    <>
                        {item.drug_type === DrugType.RESTRICTED ? (
                            <>
                                <button onClick={() => handleAction(ActionType.FORWARD_IDS)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium shadow-sm transition-colors">For IDS Approval</button>
                                <button onClick={() => handleAction(ActionType.DISAPPROVE)} className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded font-medium shadow-sm transition-colors">Disapprove (Save Findings)</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleAction(ActionType.APPROVE)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium shadow-sm transition-colors">Approve</button>
                                <button onClick={() => handleAction(ActionType.DISAPPROVE)} className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded font-medium shadow-sm transition-colors">Disapprove (Save Findings)</button>
                            </>
                        )}
                        <button onClick={() => handleAction(ActionType.DELETE)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded font-medium transition-colors">Delete</button>
                    </>
                 )}
                 {role === UserRole.IDS && (item.status === PrescriptionStatus.FOR_IDS_APPROVAL) && (
                    <>
                        <button onClick={() => handleAction(ActionType.APPROVE)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium shadow-sm transition-colors">Approve</button>
                        <button onClick={() => handleAction(ActionType.DISAPPROVE)} className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded font-medium shadow-sm transition-colors">Disapprove</button>
                    </>
                 )}
                 
                 {/* Allow Saving Findings for Reviewers at any status */}
                 {isReviewer && (
                    <button onClick={() => handleAction(ActionType.SAVE_FINDINGS)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium shadow-sm transition-colors">Save Findings</button>
                 )}

                 <button onClick={onClose} className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded font-medium transition-colors border border-gray-300 shadow-sm">Close</button>
             </div>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;