
import React, { useState, useEffect, useMemo } from 'react';
import { DrugType, PrescriptionStatus } from '../types';
import { IDS_SPECIALISTS_ADULT, IDS_SPECIALISTS_PEDIATRIC, WARDS, LOGO_URL } from '../constants';
import { ADULT_MONOGRAPHS } from '../data/adultMonographs';
import { PEDIATRIC_MONOGRAPHS } from '../data/pediatricMonographs';
import { checkRenalDosing } from '../services/geminiService';

interface AntimicrobialRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  initialData?: any;
}

const CLINICAL_DEPARTMENTS = [
  "Internal Medicine",
  "Surgery",
  "Pediatrics",
  "Family and Community Medicine",
  "Emergency",
  "Anesthesiology",
  "Obstetrics and Gynecology",
  "Ophthalmology",
  "Physical and Rehabilitation Medicine"
];

const calcCkdEpi2021 = (age: number, sex: string, scr: number) => {
  const k = sex === "Female" ? 0.7 : 0.9;
  const alpha = sex === "Female" ? -0.241 : -0.302;
  const minScr = Math.min(scr / k, 1);
  const maxScr = Math.max(scr / k, 1);

  return 142 *
    Math.pow(minScr, alpha) *
    Math.pow(maxScr, -1.2) *
    Math.pow(0.9938, age) *
    (sex === "Female" ? 1.012 : 1);
};

const calcCkidHeightBased = (ht: number, scr: number) => {
  return 0.413 * (ht / scr);
};

const getTodayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FormGroup = ({ label, children, className = '' }: { label: string, children: React.ReactNode, className?: string }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{label}</label>
    {children}
  </div>
);

const Input = ({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) => (
  <input
    {...props}
    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 bg-white text-gray-900 [color-scheme:light] ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'} ${props.className || ''}`}
  />
);

const Select = ({ error, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) => (
  <select
    {...props}
    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 bg-white text-gray-900 [color-scheme:light] ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'} ${props.className || ''}`}
  />
);

const Textarea = ({ error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 bg-white text-gray-900 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'} ${props.className || ''}`}
  />
);

interface PrevAbxRowProps {
  id: number;
  value: { drug: string; frequency: string; duration: string };
  onChange: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
}

const PrevAbxRow: React.FC<PrevAbxRowProps> = ({ id, value, onChange, onRemove }) => (
  <div className="grid grid-cols-4 gap-2 items-center mb-1">
    <Input type="text" placeholder="Drug name" value={value.drug} onChange={(e) => onChange(id, 'drug', e.target.value)} />
    <Input type="text" placeholder="Frequency" value={value.frequency} onChange={(e) => onChange(id, 'frequency', e.target.value)} />
    <Input type="text" placeholder="Duration" value={value.duration} onChange={(e) => onChange(id, 'duration', e.target.value)} />
    <button type="button" onClick={() => onRemove(id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
  </div>
);

interface OrganismSusceptibility {
  drug: string;
  result: string;
}

interface OrganismBlockProps {
  id: number;
  value: { name: string; susceptibilities: OrganismSusceptibility[] };
  onChange: (id: number, field: string, value: any) => void;
  onRemove: (id: number) => void;
}

const OrganismBlock: React.FC<OrganismBlockProps> = ({ id, value, onChange, onRemove }) => {
  const addSusceptibility = () => {
    onChange(id, 'susceptibilities', [...value.susceptibilities, { drug: '', result: '' }]);
  };

  const updateSusceptibility = (suscIndex: number, field: string, suscValue: string) => {
    const newSusceptibilities = [...value.susceptibilities];
    newSusceptibilities[suscIndex] = { ...newSusceptibilities[suscIndex], [field]: suscValue };
    onChange(id, 'susceptibilities', newSusceptibilities);
  };

  const removeSusceptibility = (suscIndex: number) => {
    const newSusceptibilities = value.susceptibilities.filter((_, i) => i !== suscIndex);
    onChange(id, 'susceptibilities', newSusceptibilities);
  };

  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-4 mb-3 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Organism Details</span>
        <button type="button" onClick={() => onRemove(id)} className="text-red-400 hover:text-red-600 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <FormGroup label="Organism Name"><Input type="text" placeholder="e.g., E. coli" value={value.name} onChange={(e) => onChange(id, 'name', e.target.value)} /></FormGroup>
      <FormGroup label="Susceptibilities" className="mt-4">
        <div className="space-y-2">
          {value.susceptibilities.map((susc, suscIndex) => (
            <div key={suscIndex} className="grid grid-cols-4 gap-2 items-center text-sm">
              <Input type="text" placeholder="Drug" value={susc.drug} onChange={(e) => updateSusceptibility(suscIndex, 'drug', e.target.value)} className="col-span-2" />
              <Select value={susc.result} onChange={(e) => updateSusceptibility(suscIndex, 'result', e.target.value)}>
                <option value="">N/A</option>
                <option value="S">S</option>
                <option value="I">I</option>
                <option value="R">R</option>
              </Select>
              <button type="button" onClick={() => removeSusceptibility(suscIndex)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
          ))}
          <button type="button" onClick={addSusceptibility} className="flex items-center text-green-600 hover:text-green-800 text-xs font-bold gap-1 mt-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Antibiotic
          </button>
        </div>
      </FormGroup>
    </div>
  );
};

const AntimicrobialRequestForm: React.FC<AntimicrobialRequestFormProps> = ({ isOpen, onClose, onSubmit, loading, initialData }) => {
  const [patientMode, setPatientMode] = useState<'adult' | 'pediatric'>('adult');
  const [formData, setFormData] = useState({
    req_date: getTodayDate(),
    patient_name: '', hospital_number: '', age: '', sex: '', weight_kg: '', height_cm: '', ward: '',
    mode: 'adult' as 'adult' | 'pediatric',
    diagnosis: '', sgpt: '', scr_mgdl: '', egfr_text: '',
    antimicrobial: '', drug_type: DrugType.MONITORED as DrugType, dose: '', frequency: '', duration: '',
    indication: '', basis_indication: '', selectedIndicationType: '' as 'Empiric' | 'Prophylactic' | 'Therapeutic' | '',
    specimen: '',
    resident_name: '', clinical_dept: '', service_resident_name: '', id_specialist: '',
  });

  const [prevAbxRows, setPrevAbxRows] = useState<{ id: number; drug: string; frequency: string; duration: string }[]>([{ id: 0, drug: '', frequency: '', duration: '' }]);
  const [organismBlocks, setOrganismBlocks] = useState<{ id: number; name: string; susceptibilities: OrganismSusceptibility[] }[]>([{ id: 0, name: '', susceptibilities: [{ drug: '', result: '' }] }]);
  const [scrNotAvailable, setScrNotAvailable] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [monographHtml, setMonographHtml] = useState<string>('<p>Select an antimicrobial to view its monograph.</p>');

  const [renalAnalysis, setRenalAnalysis] = useState<{ requiresAdjustment: boolean; recommendation: string } | null>(null);
  const [isCheckingRenal, setIsCheckingRenal] = useState(false);

  const [showMonograph, setShowMonograph] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isCustomWard, setIsCustomWard] = useState(false);
  const [isMicroCollapsed, setIsMicroCollapsed] = useState(true);

  const nextPrevAbxId = React.useRef(1);
  const nextOrganismId = React.useRef(1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        req_date: initialData.req_date ? initialData.req_date.split('T')[0] : getTodayDate(),
        selectedIndicationType: (initialData.indication as any) || '',
        scr_mgdl: initialData.scr_mgdl === "Pending" ? "" : initialData.scr_mgdl,
        mode: initialData.mode || 'adult'
      });

      if (initialData.scr_mgdl === "Pending") setScrNotAvailable(true);
      if (initialData.mode) setPatientMode(initialData.mode);

      try {
        const parsedPrevAbx = typeof initialData.previous_antibiotics === 'string' ? JSON.parse(initialData.previous_antibiotics) : initialData.previous_antibiotics;
        if (Array.isArray(parsedPrevAbx) && parsedPrevAbx.length > 0) {
          setPrevAbxRows(parsedPrevAbx.map((item: any, idx: number) => ({
            id: idx,
            drug: item.drug || '',
            frequency: item.frequency || '',
            duration: item.duration || ''
          })));
          nextPrevAbxId.current = parsedPrevAbx.length;
        }
      } catch (e) { console.log('Error parsing prev abx', e); }

      try {
        const parsedOrgs = typeof initialData.organisms === 'string' ? JSON.parse(initialData.organisms) : initialData.organisms;
        if (Array.isArray(parsedOrgs) && parsedOrgs.length > 0) {
          setOrganismBlocks(parsedOrgs.map((item: any, idx: number) => ({
            id: idx,
            name: item.name || '',
            susceptibilities: item.susceptibilities || []
          })));
          nextOrganismId.current = parsedOrgs.length;
        }
      } catch (e) { console.log('Error parsing organisms', e); }
    }
  }, [initialData]);

  const drugLists = useMemo(() => {
    const adultList = Object.entries(ADULT_MONOGRAPHS).map(([drugKey, meta]) => ({
      value: drugKey, label: drugKey, type: meta.restricted ? DrugType.RESTRICTED : DrugType.MONITORED, weightBased: meta.weightBased
    })).sort((a, b) => a.label.localeCompare(b.label));
    const pediatricList = Object.entries(PEDIATRIC_MONOGRAPHS).map(([drugKey, meta]) => ({
      value: drugKey, label: drugKey, type: meta.restricted ? DrugType.RESTRICTED : DrugType.MONITORED
    })).sort((a, b) => a.label.localeCompare(b.label));
    return { adult: adultList, pediatric: pediatricList };
  }, []);

  useEffect(() => {
    let isActive = true;
    const runRenalCheck = async () => {
      if (!formData.antimicrobial || !formData.egfr_text || formData.egfr_text.includes('—') || formData.egfr_text === 'Pending') {
        if (isActive) setRenalAnalysis(null);
        return;
      }
      const monograph = patientMode === 'adult'
        ? ADULT_MONOGRAPHS[formData.antimicrobial]
        : PEDIATRIC_MONOGRAPHS[formData.antimicrobial];

      if (!monograph || !monograph.renal) {
        if (isActive) setRenalAnalysis(null);
        return;
      }
      if (isActive) setIsCheckingRenal(true);
      const result = await checkRenalDosing(
        formData.antimicrobial, 
        formData.egfr_text, 
        monograph.renal,
        formData.dose,
        formData.frequency
      );

      if (isActive) {
        setIsCheckingRenal(false);
        if (result && result.requiresAdjustment) {
          setRenalAnalysis(result);
        } else {
          setRenalAnalysis(null);
        }
      }
    };
    const timeoutId = setTimeout(runRenalCheck, 1500);
    return () => { isActive = false; clearTimeout(timeoutId); };
  }, [formData.egfr_text, formData.antimicrobial, patientMode, formData.dose, formData.frequency]);

  useEffect(() => {
    const currentDrug = formData.antimicrobial;
    const drugOptions = drugLists[patientMode];
    const selectedDrugMeta = drugOptions.find(d => d.value === currentDrug);

    setFormData(prev => ({
      ...prev,
      drug_type: selectedDrugMeta ? (selectedDrugMeta.type || DrugType.MONITORED) : DrugType.MONITORED,
      service_resident_name: selectedDrugMeta?.type === DrugType.RESTRICTED ? prev.service_resident_name : '',
      id_specialist: selectedDrugMeta?.type === DrugType.RESTRICTED ? prev.id_specialist : '',
    }));

    if (!selectedDrugMeta) {
      setMonographHtml(currentDrug ? `<p class="text-gray-700"><strong>${currentDrug}</strong>: No monograph found.</p>` : '<p class="text-gray-600">Select an antimicrobial to view its monograph.</p>');
      return;
    }
    const monograph = patientMode === 'adult' ? ADULT_MONOGRAPHS[selectedDrugMeta.value] : PEDIATRIC_MONOGRAPHS[selectedDrugMeta.value];
    if (monograph) {
      let html = `<h3 class="font-bold text-gray-800 text-lg mb-2">${selectedDrugMeta.value} – ${patientMode === "adult" ? "Adult" : "Pediatric"} Monograph</h3>`;
      if (monograph.spectrum) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Spectrum:</strong> ${monograph.spectrum}</p>`;
      if (monograph.dosing) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Dosing:</strong> ${monograph.dosing}</p>`;
      if (monograph.renal) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Renal adj:</strong> ${monograph.renal}</p>`;
      if (monograph.hepatic) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Hepatic adj:</strong> ${monograph.hepatic}</p>`;
      if (monograph.duration) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Typical duration:</strong> ${monograph.duration}</p>`;
      if (monograph.monitoring) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Monitoring:</strong> ${monograph.monitoring}</p>`;
      if (monograph.warnings) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">Warnings:</strong> ${monograph.warnings}</p>`;
      if (monograph.ams) html += `<p class="mb-1 text-gray-700"><strong class="text-gray-900">AMS Guidance:</strong> ${monograph.ams}</p>`;
      setMonographHtml(html);
    } else {
      setMonographHtml(currentDrug ? `<p class="text-gray-700"><strong>${currentDrug}</strong>: No monograph found.</p>` : '<p class="text-gray-600">Select an antimicrobial to view its monograph.</p>');
    }
  }, [patientMode, formData.antimicrobial, drugLists]);

  useEffect(() => {
    updateEgfr();
  }, [patientMode, formData.age, formData.sex, formData.weight_kg, formData.height_cm, formData.scr_mgdl, scrNotAvailable]);

  const updateEgfr = () => {
    const { age, sex, weight_kg, height_cm, scr_mgdl } = formData;
    let egfrText = '—';

    if (scrNotAvailable) {
      egfrText = 'Pending';
    } else {
      let ageNum = parseFloat(age);
      let scrNum = parseFloat(scr_mgdl);
      let heightNum = parseFloat(height_cm);

      if (!isNaN(scrNum) && scrNum > 0) scrNum = scrNum / 88.4;

      if (isNaN(ageNum) || !sex || isNaN(scrNum)) {
        egfrText = '—';
      } else if (patientMode === 'adult') {
        const egfr = calcCkdEpi2021(ageNum, sex, scrNum);
        egfrText = isFinite(egfr) ? egfr.toFixed(1) + ' mL/min/1.73m²' : '—';
      } else {
        if (isNaN(heightNum)) {
          egfrText = 'Enter height for pediatric eGFR.';
        } else {
          const egfr = calcCkidHeightBased(heightNum, scrNum);
          egfrText = isFinite(egfr) ? egfr.toFixed(1) + ' mL/min/1.73m²' : '—';
        }
      }
    }
    setFormData(prev => ({ ...prev, egfr_text: egfrText }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const requiredFields: (keyof typeof formData)[] = [
      'patient_name', 'age', 'sex', 'weight_kg', 'hospital_number', 'ward', 'diagnosis',
      'antimicrobial', 'dose', 'frequency', 'duration', 'selectedIndicationType', 'basis_indication',
      'resident_name', 'clinical_dept', 'req_date'
    ];

    requiredFields.forEach(field => {
      if (!formData[field] || String(formData[field]).trim() === '') {
        errors[field] = `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required.`;
      }
    });

    if (!scrNotAvailable && (!formData.scr_mgdl || String(formData.scr_mgdl).trim() === '')) {
      errors.scr_mgdl = 'Serum Creatinine is required unless marked as not yet available.';
    }

    if (patientMode === 'pediatric' && (!formData.height_cm || String(formData.height_cm).trim() === '')) {
      errors.height_cm = 'Height is required for pediatric patients.';
    }

    const selectedDrugMeta = drugLists[patientMode].find(d => d.value === formData.antimicrobial);
    if (selectedDrugMeta && selectedDrugMeta.type === DrugType.RESTRICTED) {
      if (!formData.service_resident_name || String(formData.service_resident_name).trim() === '') {
        errors.service_resident_name = 'Service Resident is required for restricted antimicrobials.';
      }
      if (!formData.id_specialist || String(formData.id_specialist).trim() === '') {
        errors.id_specialist = 'ID Specialist is required for restricted antimicrobials.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openReview = () => {
    if (!validateForm()) {
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField) {
        document.getElementById(firstErrorField)?.focus();
        document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setShowReview(true);
  };

  const confirmAndSubmit = async () => {
    const payload: any = {
      ...formData,
      req_date: new Date(formData.req_date).toISOString(),
      timestamp: new Date().toISOString(),
      scr_mgdl: scrNotAvailable ? "Pending" : formData.scr_mgdl,
      indication: formData.selectedIndicationType,
      previous_antibiotics: JSON.stringify(prevAbxRows.filter(r => r.drug || r.frequency || r.duration)),
      organisms: JSON.stringify(organismBlocks.filter(b => b.name || b.susceptibilities.some(s => s.drug || s.result))),
      status: PrescriptionStatus.PENDING,
      resident_name: formData.resident_name,
      service_resident_name: formData.drug_type === DrugType.RESTRICTED ? formData.service_resident_name : null,
      id_specialist: formData.drug_type === DrugType.RESTRICTED ? formData.id_specialist : null,
      dispensed_by: null,
      dispensed_date: null,
      disapproved_reason: null,
      ids_approved_at: null,
      ids_disapproved_at: null,
      findings: []
    };

    delete payload.selectedIndicationType;

    // Remove empty strings
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
        delete payload[key];
      }
    });

    if (initialData && initialData.id) {
      payload.id = initialData.id;
    }

    await onSubmit(payload);
  };

  const handleModeChange = (mode: 'adult' | 'pediatric') => {
    setPatientMode(mode);
    setFormData(prev => ({ ...prev, mode: mode }));
    setValidationErrors({});
  };

  const addPrevAbxRow = () => {
    setPrevAbxRows(prev => [...prev, { id: nextPrevAbxId.current++, drug: '', frequency: '', duration: '' }]);
  };

  const updatePrevAbxRow = (id: number, field: string, value: string) => {
    setPrevAbxRows(prev => prev.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removePrevAbxRow = (id: number) => {
    setPrevAbxRows(prev => prev.filter(row => row.id !== id));
  };

  const addOrganismBlock = () => {
    setOrganismBlocks(prev => [...prev, { id: nextOrganismId.current++, name: '', susceptibilities: [{ drug: '', result: '' }] }]);
  };

  const updateOrganismBlock = (id: number, field: string, value: any) => {
    setOrganismBlocks(prev => prev.map(block => (block.id === id ? { ...block, [field]: value } : block)));
  };

  const removeOrganismBlock = (id: number) => {
    setOrganismBlocks(prev => prev.filter(block => block.id !== id));
  };

  const SummaryCard = ({ title, children, className = '' }: { title: string, children: React.ReactNode, className?: string }) => (
    <div className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 border-b border-gray-50 pb-2">{title}</h4>
      {children}
    </div>
  );

  const SummaryValue = ({ label, value, className = '' }: { label: string, value: any, className?: string }) => (
    <div className={className}>
      <p className="text-[10px] text-gray-400 uppercase font-black tracking-tight mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-bold leading-snug">{value || '—'}</p>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-100 relative" onClick={(e) => e.stopPropagation()}>
        
        {/* Main Header - Underlying Header */}
        <header className="flex items-center justify-between gap-4 bg-[#009a3e] text-white px-6 py-4 sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold leading-tight uppercase tracking-tight">Antimicrobial Request</h3>
              <span className="text-[11px] font-bold text-white/80 tracking-wide">Antimicrobial Stewardship</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        {/* Form Body - Always Rendered */}
        <div className="p-8 overflow-y-auto flex-1 bg-gray-50/50 space-y-8">
            {/* Patient Mode Toggle */}
            <div className="flex justify-center mb-4">
                <div className="inline-flex rounded-xl bg-gray-200 p-1 shadow-inner">
                    <button type="button" className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${patientMode === 'adult' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => handleModeChange('adult')}>Adult Patient</button>
                    <button type="button" className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${patientMode === 'pediatric' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => handleModeChange('pediatric')}>Pediatric Patient</button>
                </div>
            </div>

            <form className="space-y-8 max-w-4xl mx-auto">
                {/* 1. Profile */}
                <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Patient Profile</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormGroup label="Request Date"><Input error={!!validationErrors.req_date} type="date" name="req_date" value={formData.req_date} onChange={handleChange} /></FormGroup>
                        <FormGroup label="Full Name (Last, First)" className="md:col-span-2"><Input error={!!validationErrors.patient_name} name="patient_name" value={formData.patient_name} onChange={handleChange} placeholder="e.g. Dela Cruz, Juan" /></FormGroup>
                        <FormGroup label="Hospital Number"><Input error={!!validationErrors.hospital_number} name="hospital_number" value={formData.hospital_number} onChange={handleChange} placeholder="ID Number" /></FormGroup>
                        <FormGroup label="Age"><Input error={!!validationErrors.age} type="number" name="age" value={formData.age} onChange={handleChange} /></FormGroup>
                        <FormGroup label="Sex"><Select error={!!validationErrors.sex} name="sex" value={formData.sex} onChange={handleChange}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></Select></FormGroup>
                        <FormGroup label="Weight (kg)"><Input error={!!validationErrors.weight_kg} type="number" step="0.1" name="weight_kg" value={formData.weight_kg} onChange={handleChange} /></FormGroup>
                        <FormGroup label="Height (cm)" className={patientMode === 'pediatric' ? '' : 'hidden'}><Input error={!!validationErrors.height_cm} type="number" step="0.1" name="height_cm" value={formData.height_cm} onChange={handleChange} /></FormGroup>
                        <FormGroup label="Ward / Unit" className="md:col-span-2">
                             <Select error={!!validationErrors.ward} value={isCustomWard ? 'Others' : formData.ward} onChange={(e) => { const v = e.target.value; if(v==='Others') setIsCustomWard(true); else { setIsCustomWard(false); setFormData(p=>({...p, ward: v})); } }}>
                                <option value="">Select Ward</option>
                                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                                <option value="Others">Others (Specify)</option>
                             </Select>
                             {isCustomWard && <Input error={!!validationErrors.ward} className="mt-2" placeholder="Specify..." value={formData.ward} onChange={e => setFormData(p=>({...p, ward: e.target.value}))} />}
                        </FormGroup>
                    </div>
                </section>

                {/* 2. Clinical */}
                <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Clinical Data</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="Diagnosis"><Input error={!!validationErrors.diagnosis} name="diagnosis" value={formData.diagnosis} onChange={handleChange} placeholder="Primary working diagnosis" /></FormGroup>
                        <FormGroup label="Indication Type">
                             <div className={`flex gap-2 p-1 rounded-lg ${validationErrors.selectedIndicationType ? 'border border-red-500 bg-red-50' : ''}`}>
                                {(['Empiric', 'Prophylactic', 'Therapeutic'] as const).map(ind => (
                                    <button key={ind} type="button" onClick={() => setFormData(p=>({...p, selectedIndicationType: ind}))} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${formData.selectedIndicationType === ind ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>{ind}</button>
                                ))}
                             </div>
                        </FormGroup>
                        <FormGroup label="Basis for Indication" className="md:col-span-2"><Textarea error={!!validationErrors.basis_indication} name="basis_indication" value={formData.basis_indication} onChange={handleChange} rows={2} /></FormGroup>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <FormGroup label="SCr (µmol/L)">
                             <div className="flex items-center gap-2">
                                <Input error={!!validationErrors.scr_mgdl} type="number" name="scr_mgdl" value={formData.scr_mgdl} onChange={handleChange} disabled={scrNotAvailable} className="flex-1" />
                                <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap"><input type="checkbox" checked={scrNotAvailable} onChange={e => setScrNotAvailable(e.target.checked)} className="rounded border-gray-300 text-green-600" /><span className="text-[10px] font-bold text-gray-400 uppercase">Pending</span></label>
                             </div>
                        </FormGroup>
                        <FormGroup label="SGPT (U/L)"><Input type="number" name="sgpt" value={formData.sgpt} onChange={handleChange} /></FormGroup>
                        <FormGroup label="Calculated eGFR"><div className="h-[38px] flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-blue-700">{formData.egfr_text}</div></FormGroup>
                    </div>
                </section>

                {/* 3. Medication */}
                <section className="bg-[#f0f9ff] p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-blue-50 pb-2">
                        <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Medication Request</h4>
                        <button type="button" onClick={() => setShowMonograph(!showMonograph)} className="text-[10px] font-bold text-blue-600 hover:underline uppercase">{showMonograph ? 'Hide Monograph' : 'View Monograph'}</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormGroup label="Antimicrobial" className="md:col-span-2">
                            <Select error={!!validationErrors.antimicrobial} name="antimicrobial" value={formData.antimicrobial} onChange={handleChange}>
                                <option value="">Select Drug</option>
                                {drugLists[patientMode].map(d => <option key={d.value} value={d.value}>{d.label} ({d.type})</option>)}
                            </Select>
                        </FormGroup>
                        <FormGroup label="Drug Type"><div className={`h-[38px] flex items-center justify-center px-3 rounded-lg text-xs font-black uppercase tracking-widest border ${formData.drug_type === DrugType.RESTRICTED ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>{formData.drug_type}</div></FormGroup>
                        <FormGroup label="Dose"><Input error={!!validationErrors.dose} name="dose" value={formData.dose} onChange={handleChange} placeholder="e.g. 1g" /></FormGroup>
                        <FormGroup label="Frequency"><Input error={!!validationErrors.frequency} name="frequency" value={formData.frequency} onChange={handleChange} placeholder="e.g. q8h" /></FormGroup>
                        <FormGroup label="Duration (Days)"><Input error={!!validationErrors.duration} name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g. 7" /></FormGroup>
                    </div>
                    {showMonograph && (
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm animate-fade-in max-h-48 overflow-y-auto text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: monographHtml }} />
                    )}
                    {/* Guardrails */}
                    {renalAnalysis && (
                        <div className="space-y-2">
                            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-xs rounded-lg font-medium shadow-sm"><strong>Renal Guardrail:</strong> {renalAnalysis.recommendation}</div>
                        </div>
                    )}
                </section>

                {/* 4. Personnel */}
                <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Accountability</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormGroup label="Resident In-Charge"><Input error={!!validationErrors.resident_name} name="resident_name" value={formData.resident_name} onChange={handleChange} placeholder="Ordering physician" /></FormGroup>
                        <FormGroup label="Clinical Department"><Select error={!!validationErrors.clinical_dept} name="clinical_dept" value={formData.clinical_dept} onChange={handleChange}><option value="">Select Dept</option>{CLINICAL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</Select></FormGroup>
                        {formData.drug_type === DrugType.RESTRICTED && (
                            <>
                                <FormGroup label="Service Resident"><Input error={!!validationErrors.service_resident_name} name="service_resident_name" value={formData.service_resident_name} onChange={handleChange} placeholder="IM/Pedia Resident" /></FormGroup>
                                <FormGroup label="ID Specialist"><Select error={!!validationErrors.id_specialist} name="id_specialist" value={formData.id_specialist} onChange={handleChange}><option value="">Select Specialist</option>{(patientMode === 'adult' ? IDS_SPECIALISTS_ADULT : IDS_SPECIALISTS_PEDIATRIC).map(s => <option key={s} value={s}>{s}</option>)}</Select></FormGroup>
                            </>
                        )}
                    </div>
                </section>

                {/* Error Summary */}
                {Object.keys(validationErrors).length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold space-y-1">
                        <p className="uppercase tracking-tight">Missing Required Fields:</p>
                        <ul className="list-disc pl-5 font-medium">{Object.values(validationErrors).map((v, i) => <li key={i}>{v}</li>)}</ul>
                    </div>
                )}
            </form>
        </div>

        {/* Footer */}
        <footer className="p-4 bg-white border-t border-gray-100 flex justify-end gap-3 shrink-0 px-8">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-bold transition-all">Cancel</button>
            <button type="button" onClick={openReview} disabled={loading} className="px-10 py-2.5 bg-[#009a3e] text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-green-200 transition-all flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Review Request
            </button>
        </footer>

        {/* Review Overlay - True Modal Overlay */}
        {showReview && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-fade-in" onClick={() => setShowReview(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/20 animate-slide-up font-['Inter']" onClick={e => e.stopPropagation()}>
                    <header className="bg-[#009a3e] text-white p-6 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md border border-white/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Final Verification</h3>
                                <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Confirm clinical data before submission</p>
                            </div>
                        </div>
                        <button onClick={() => setShowReview(false)} className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </header>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Card 1: Patient Profile */}
                            <SummaryCard title="Patient Profile">
                                <h3 className="text-2xl font-black text-gray-900 mb-0.5 capitalize tracking-tight">{formData.patient_name || 'Anonymous'}</h3>
                                <p className="text-xs font-mono font-bold text-gray-400 mb-6 bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-100">{formData.hospital_number}</p>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                    <SummaryValue label="AGE / SEX" value={`${formData.age}y / ${formData.sex}`} />
                                    <SummaryValue label="WT / HT" value={`${formData.weight_kg}kg / ${formData.height_cm || '?'}cm`} />
                                    <SummaryValue label="WARD" value={formData.ward} />
                                    <SummaryValue label="MODE" value={patientMode.toUpperCase()} className="text-green-600" />
                                </div>
                            </SummaryCard>

                            {/* Card 2: Diagnostics */}
                            <SummaryCard title="Clinical Findings">
                                <div className="mb-4 inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase tracking-widest border border-yellow-200">
                                    {formData.selectedIndicationType} Indication
                                </div>
                                <div className="space-y-6">
                                    <SummaryValue label="DIAGNOSIS" value={formData.diagnosis} />
                                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                                        <SummaryValue label="SCR" value={scrNotAvailable ? 'PENDING' : formData.scr_mgdl} />
                                        <SummaryValue label="SGPT" value={formData.sgpt} />
                                        <SummaryValue label="EGFR" value={formData.egfr_text?.split(' ')?.[0] || '—'} />
                                    </div>
                                </div>
                            </SummaryCard>

                            {/* Card 3: Medication (Wide) */}
                            <div className="md:col-span-2 bg-[#f0f7ff] rounded-3xl border border-blue-100 p-8 shadow-sm relative overflow-hidden group">
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Medication Name</p>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-3xl font-black text-blue-900 tracking-tight">{formData.antimicrobial}</h2>
                                            <span className={`px-3 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-widest ${formData.drug_type === DrugType.RESTRICTED ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>{formData.drug_type}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-8 text-right">
                                        <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">DOSE</p><p className="text-2xl font-black text-blue-900 leading-tight">{formData.dose}</p></div>
                                        <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">FREQ</p><p className="text-sm font-black text-blue-900 leading-tight">Every {formData.frequency?.replace('q','')}</p><p className="text-[9px] font-black text-blue-400 uppercase">Hours</p></div>
                                        <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">DAYS</p><p className="text-2xl font-black text-blue-900 leading-tight">{formData.duration}</p></div>
                                    </div>
                                </div>
                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-blue-200/50">
                                    <SummaryValue label="BASIS FOR INDICATION" value={formData.basis_indication} />
                                    <div className="flex gap-8">
                                        <SummaryValue label="RESIDENT IN-CHARGE" value={formData.resident_name} />
                                        {formData.id_specialist && <SummaryValue label="IDS CONSULTANT" value={formData.id_specialist} />}
                                    </div>
                                </div>
                                {renalAnalysis && (
                                    <div className="mt-4 pt-4 border-t border-blue-200/30">
                                        <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">Renal Dosing Alert</p>
                                        <p className="text-xs text-blue-800 mt-1 font-medium">{renalAnalysis.recommendation}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <footer className="p-6 bg-white border-t border-gray-100 flex justify-end gap-3 shrink-0">
                        <button onClick={() => setShowReview(false)} className="px-8 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-all uppercase text-xs tracking-widest">Back to Edit</button>
                        <button onClick={confirmAndSubmit} disabled={loading} className="px-12 py-3 bg-[#009a3e] text-white rounded-2xl font-black shadow-xl shadow-green-500/20 hover:bg-green-700 transition-all flex items-center gap-2 transform active:scale-95 uppercase text-xs tracking-widest">
                            {loading ? 'Submitting...' : 'Confirm & Submit'}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                    </footer>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AntimicrobialRequestForm;
