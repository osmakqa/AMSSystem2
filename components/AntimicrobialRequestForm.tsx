import React, { useState, useEffect, useMemo } from 'react';
import { DrugType, PrescriptionStatus } from '../types';
import { IDS_SPECIALISTS_ADULT, IDS_SPECIALISTS_PEDIATRIC } from '../constants';
import { ADULT_MONOGRAPHS } from '../data/adultMonographs';
import { PEDIATRIC_MONOGRAPHS } from '../data/pediatricMonographs';
import { checkRenalDosing, verifyWeightBasedDosing } from '../services/geminiService'; // Import the AI services

interface AntimicrobialRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
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

const WARDS = [
  "6th Floor Ward",
  "ARI 2",
  "Dengue Ward",
  "ER Holding",
  "ER Isolation",
  "ICU",
  "Infectious Ward",
  "Medicine Female",
  "Medicine Male",
  "Medicine Isolation Room",
  "NICU",
  "Pedia ICU",
  "Pedia Ward 3",
  "Pedia Ward 1 Stepdown",
  "Respiratory ICU",
  "SARI",
  "Surgery Female",
  "Surgery Male"
];

// Helper for eGFR calculations
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

// --- Form Sub-Components ---
const FormGroup = ({ label, children, className = '' }: { label: string, children: React.ReactNode, className?: string }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-xs font-semibold text-gray-700">{label}</label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 ${props.className || ''}`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 ${props.className || ''}`}
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 ${props.className || ''}`}
  />
);

// Dynamic Row for Previous Antibiotics
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
    <button type="button" onClick={() => onRemove(id)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
  </div>
);

// Dynamic Block for Organisms
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
    <div className="rounded-lg border border-dashed border-gray-300 p-3 mb-2 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-700">Organism Details</span>
        <button type="button" onClick={() => onRemove(id)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <FormGroup label="Name"><Input type="text" placeholder="e.g., E. coli" value={value.name} onChange={(e) => onChange(id, 'name', e.target.value)} /></FormGroup>
      <FormGroup label="Susceptibilities"><div className="space-y-1 mt-2">
        {value.susceptibilities.map((susc, suscIndex) => (
          <div key={suscIndex} className="grid grid-cols-4 gap-2 items-center text-sm">
            <Input type="text" placeholder="Drug" value={susc.drug} onChange={(e) => updateSusceptibility(suscIndex, 'drug', e.target.value)} className="col-span-2" />
            <Select value={susc.result} onChange={(e) => updateSusceptibility(suscIndex, 'result', e.target.value)}>
              <option value="">N/A</option>
              <option value="S">S</option>
              <option value="I">I</option>
              <option value="R">R</option>
            </Select>
            <button type="button" onClick={() => removeSusceptibility(suscIndex)} className="text-red-400 hover:text-red-600 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        ))}
        <button type="button" onClick={addSusceptibility} className="flex items-center text-green-600 hover:text-green-800 text-sm font-medium gap-1 mt-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Antibiotic</button>
      </div></FormGroup>
    </div>
  );
};


const AntimicrobialRequestForm: React.FC<AntimicrobialRequestFormProps> = ({ isOpen, onClose, onSubmit, loading }) => {
  const [patientMode, setPatientMode] = useState<'adult' | 'pediatric'>('adult');
  const [formData, setFormData] = useState({
    req_date: new Date().toISOString().split('T')[0],
    patient_name: '', hospital_number: '', age: '', sex: '', weight_kg: '', height_cm: '', ward: '',
    mode: 'adult' as 'adult' | 'pediatric', 
    diagnosis: '', sgpt: '', scr_mgdl: '', egfr_text: '',
    antimicrobial: '', drug_type: DrugType.MONITORED as DrugType, dose: '', frequency: '', duration: '',
    indication: '', basis_indication: '', selectedIndicationType: '' as 'Empiric'|'Prophylactic'|'Therapeutic'|'',
    specimen: '',
    resident_name: '', clinical_dept: '', service_resident_name: '', id_specialist: '',
  });
  const [prevAbxRows, setPrevAbxRows] = useState<{ id: number; drug: string; frequency: string; duration: string }[]>([{ id: 0, drug: '', frequency: '', duration: '' }]);
  const [organismBlocks, setOrganismBlocks] = useState<{ id: number; name: string; susceptibilities: OrganismSusceptibility[] }[]>([{ id: 0, name: '', susceptibilities: [{ drug: '', result: '' }] }]);
  const [scrNotAvailable, setScrNotAvailable] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [monographHtml, setMonographHtml] = useState<string>('<p>Select an antimicrobial to view its monograph.</p>');
  
  // Renal Guardrail States
  const [renalAnalysis, setRenalAnalysis] = useState<{ requiresAdjustment: boolean; recommendation: string } | null>(null);
  const [isCheckingRenal, setIsCheckingRenal] = useState(false);

  // Weight-Based Guardrail States
  const [weightDosingAnalysis, setWeightDosingAnalysis] = useState<{ status: 'SAFE' | 'WARNING', message: string } | null>(null);
  const [isCheckingWeightDose, setIsCheckingWeightDose] = useState(false);

  // UI States
  const [showMonograph, setShowMonograph] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<string>('');
  const [isCustomWard, setIsCustomWard] = useState(false);
  const [isMicroCollapsed, setIsMicroCollapsed] = useState(true);

  const nextPrevAbxId = React.useRef(1);
  const nextOrganismId = React.useRef(1);

  // --- Monograph & Drug List Logic ---
  const drugLists = useMemo(() => {
    const adultList = Object.entries(ADULT_MONOGRAPHS).map(([drugKey, meta]) => ({
      value: drugKey, label: drugKey, type: meta.restricted ? DrugType.RESTRICTED : DrugType.MONITORED, weightBased: meta.weightBased
    })).sort((a,b)=>a.label.localeCompare(b.label));
    const pediatricList = Object.entries(PEDIATRIC_MONOGRAPHS).map(([drugKey, meta]) => ({
      value: drugKey, label: drugKey, type: meta.restricted ? DrugType.RESTRICTED : DrugType.MONITORED
    })).sort((a,b)=>a.label.localeCompare(b.label));
    return { adult: adultList, pediatric: pediatricList };
  }, []);

  // --- Renal Guardrail Effect ---
  useEffect(() => {
    let isActive = true;

    const runRenalCheck = async () => {
      // 1. Clear previous alerts if input is invalid
      if (!formData.antimicrobial || !formData.egfr_text || formData.egfr_text.includes('—') || formData.egfr_text === 'Pending') {
        if (isActive) setRenalAnalysis(null);
        return;
      }

      // 2. Get Monograph Text
      const monograph = patientMode === 'adult' 
        ? ADULT_MONOGRAPHS[formData.antimicrobial] 
        : PEDIATRIC_MONOGRAPHS[formData.antimicrobial];

      if (!monograph || !monograph.renal) {
        if (isActive) setRenalAnalysis(null);
        return;
      }

      // 3. Call AI Service
      if (isActive) setIsCheckingRenal(true);
      const result = await checkRenalDosing(formData.antimicrobial, formData.egfr_text, monograph.renal);
      
      if (isActive) {
        setIsCheckingRenal(false);
        if (result && result.requiresAdjustment) {
          setRenalAnalysis(result);
        } else {
          setRenalAnalysis(null);
        }
      }
    };

    // Debounce to avoid spamming API while typing/calculating
    const timeoutId = setTimeout(runRenalCheck, 1500);
    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [formData.egfr_text, formData.antimicrobial, patientMode]);

  // --- Weight-Based Dosing Guardrail Effect ---
  useEffect(() => {
    let isActive = true;

    const runWeightDoseCheck = async () => {
        // Requirements: Weight, Drug, Dose, Frequency
        if (!formData.antimicrobial || !formData.weight_kg || !formData.dose) {
            if (isActive) setWeightDosingAnalysis(null);
            return;
        }

        // Determine if check is needed
        let shouldCheck = false;
        let monographText = '';
        
        if (patientMode === 'pediatric') {
            shouldCheck = true;
            monographText = PEDIATRIC_MONOGRAPHS[formData.antimicrobial]?.dosing || '';
        } else {
            // Adult - check if weightBased flag is true
            const drugMeta = ADULT_MONOGRAPHS[formData.antimicrobial];
            if (drugMeta && drugMeta.weightBased) {
                shouldCheck = true;
                monographText = drugMeta.dosing;
            }
        }

        if (!shouldCheck || !monographText) {
            if (isActive) setWeightDosingAnalysis(null);
            return;
        }

        if (isActive) setIsCheckingWeightDose(true);
        const result = await verifyWeightBasedDosing(
            patientMode,
            formData.antimicrobial,
            formData.weight_kg,
            formData.dose,
            formData.frequency || 'N/A',
            monographText
        );

        if (isActive) {
            setIsCheckingWeightDose(false);
            setWeightDosingAnalysis(result);
        }
    };

    const timeoutId = setTimeout(runWeightDoseCheck, 2000); // Wait 2s after typing
    return () => {
        isActive = false;
        clearTimeout(timeoutId);
    };
  }, [formData.antimicrobial, formData.weight_kg, formData.dose, formData.frequency, patientMode]);


  // --- Drug Monograph Update Effect ---
  useEffect(() => {
    // Populate drug options
    const currentDrug = formData.antimicrobial;
    const drugOptions = drugLists[patientMode];
    const selectedDrugMeta = drugOptions.find(d => d.value === currentDrug);

    setFormData(prev => ({
      ...prev,
      drug_type: selectedDrugMeta ? (selectedDrugMeta.type || DrugType.MONITORED) : DrugType.MONITORED,
      // Clear IDS fields if not restricted
      service_resident_name: selectedDrugMeta?.type === DrugType.RESTRICTED ? prev.service_resident_name : '',
      id_specialist: selectedDrugMeta?.type === DrugType.RESTRICTED ? prev.id_specialist : '',
    }));

    if (!selectedDrugMeta) {
         setMonographHtml(currentDrug ? `<p class="text-gray-700"><strong>${currentDrug}</strong>: No monograph found.</p>` : '<p class="text-gray-600">Select an antimicrobial to view its monograph.</p>');
         return;
    }

    // Update Monograph
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

  // --- eGFR Calculation Effect ---
  // Separated to ensure instant updates when clinical values change
  useEffect(() => {
    updateEgfr();
  }, [patientMode, formData.age, formData.sex, formData.weight_kg, formData.height_cm, formData.scr_mgdl, scrNotAvailable]);


  useEffect(() => {
    // Set default date
    if (!formData.req_date) {
      setFormData(prev => ({ ...prev, req_date: new Date().toISOString().split('T')[0] }));
    }
    // Add initial rows if empty
    if (prevAbxRows.length === 0) setPrevAbxRows([{ id: nextPrevAbxId.current++, drug: '', frequency: '', duration: '' }]);
    if (organismBlocks.length === 0) setOrganismBlocks([{ id: nextOrganismId.current++, name: '', susceptibilities: [{ drug: '', result: '' }] }]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => { 
        const { [name]: removed, ...rest } = prev; 
        return rest; 
    });
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

  // --- eGFR Calculation ---
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
      } else { // pediatric
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

  // --- Form Validation ---
  const validateForm = () => {
    const errors: Record<string, string> = {};
    const requiredFields: (keyof typeof formData)[] = [
      'patient_name', 'age', 'sex', 'weight_kg', 'hospital_number', 'ward', 'diagnosis',
      'antimicrobial', 'dose', 'frequency', 'duration', 'selectedIndicationType', 'basis_indication',
      'resident_name', 'clinical_dept', 'req_date', 'mode'
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

  // --- Review Modal & Submission ---
  const openReviewModal = () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField) {
        document.getElementById(firstErrorField)?.focus();
        document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setReviewSummary(buildSummary());
    setShowReviewModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    openReviewModal();
  };

  const confirmAndSubmit = async () => {
    // Explicitly construct payload to avoid sending internal state fields (like selectedIndicationType) to DB
    const payload: any = {
      req_date: new Date(formData.req_date).toISOString(),
      timestamp: new Date().toISOString(),
      patient_name: formData.patient_name,
      hospital_number: formData.hospital_number,
      age: formData.age,
      sex: formData.sex,
      weight_kg: formData.weight_kg,
      height_cm: formData.height_cm,
      ward: formData.ward,
      mode: patientMode,
      diagnosis: formData.diagnosis,
      sgpt: formData.sgpt,
      scr_mgdl: scrNotAvailable ? "Pending" : formData.scr_mgdl,
      egfr_text: formData.egfr_text,
      antimicrobial: formData.antimicrobial,
      drug_type: formData.drug_type,
      dose: formData.dose,
      frequency: formData.frequency,
      duration: formData.duration,
      indication: formData.selectedIndicationType, // Map internal selectedIndicationType to DB 'indication' column
      basis_indication: formData.basis_indication,
      previous_antibiotics: JSON.stringify(prevAbxRows.filter(r => r.drug || r.frequency || r.duration)),
      organisms: JSON.stringify(organismBlocks.filter(b => b.name || b.susceptibilities.some(s => s.drug || s.result))),
      specimen: formData.specimen,
      resident_name: formData.resident_name,
      clinical_dept: formData.clinical_dept,
      status: PrescriptionStatus.PENDING,
      service_resident_name: formData.drug_type === DrugType.RESTRICTED ? formData.service_resident_name : null,
      id_specialist: formData.drug_type === DrugType.RESTRICTED ? formData.id_specialist : null,
      dispensed_by: null,
      dispensed_date: null,
      disapproved_reason: null,
      ids_approved_at: null,
      ids_disapproved_at: null
    };
    
    // Clean up empty fields
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
        delete payload[key];
      }
    });

    await onSubmit(payload);
    setShowReviewModal(false);
  };

  const buildSummary = () => {
    const p = { ...formData, mode: patientMode, previous_antibiotics: prevAbxRows, organisms: organismBlocks };

    // Helper for sections
    const sectionHeader = (title: string) => `<h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1 flex items-center gap-2">${title}</h4>`;
    const dataRow = (label: string, value: any, fullWidth = false) => `
      <div class="${fullWidth ? 'col-span-full' : ''}">
        <p class="text-[10px] text-gray-400 uppercase font-semibold">${label}</p>
        <p class="text-sm text-gray-800 font-medium break-words">${value || '—'}</p>
      </div>
    `;

    // Previous Antibiotics Table
    let prevAbxHtml = '';
    const validPrevAbx = p.previous_antibiotics.filter(a => a.drug || a.frequency || a.duration);
    if (validPrevAbx.length > 0) {
        prevAbxHtml = `
        <div class="overflow-x-auto rounded-lg border border-gray-100 mb-4">
            <table class="w-full text-sm text-left">
                <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr><th class="px-3 py-2 font-semibold">Drug</th><th class="px-3 py-2 font-semibold">Frequency</th><th class="px-3 py-2 font-semibold">Duration</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${validPrevAbx.map(a => `<tr><td class="px-3 py-2 font-medium text-gray-800">${a.drug || '—'}</td><td class="px-3 py-2 text-gray-600">${a.frequency || '—'}</td><td class="px-3 py-2 text-gray-600">${a.duration || '—'}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    } else {
        prevAbxHtml = `<p class="text-sm text-gray-400 italic mb-4">No previous antibiotics listed.</p>`;
    }

    // Organisms Grid
    let microHtml = '';
    const filteredOrgs = p.organisms.filter(b => b.name || b.susceptibilities.some(s => s.drug || s.result));
    if (filteredOrgs.length > 0) {
        microHtml = `<div class="grid grid-cols-1 gap-3">`;
        filteredOrgs.forEach(org => {
            let suscHtml = '';
             if (org.susceptibilities.length && org.susceptibilities.some(s => s.drug || s.result)) {
                 suscHtml = `<div class="mt-2 grid grid-cols-2 gap-2 bg-white rounded p-2 border border-gray-100">
                    ${org.susceptibilities.filter(s => s.drug || s.result).map(s => `
                        <div class="text-xs"><span class="text-gray-500">${s.drug || '?'}:</span> <span class="font-bold ${s.result === 'R' ? 'text-red-600' : (s.result === 'S' ? 'text-green-600' : 'text-gray-700')}">${s.result || '-'}</span></div>
                    `).join('')}
                 </div>`;
             }
            microHtml += `
            <div class="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p class="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path></svg>
                    ${org.name || "Unnamed Organism"}
                </p>
                ${suscHtml}
            </div>`;
        });
        microHtml += `</div>`;
    } else {
        microHtml = `<p class="text-sm text-gray-400 italic">No organisms listed.</p>`;
    }

    // Restricted Info
    let restrictedHtml = "";
    if (p.drug_type === DrugType.RESTRICTED) {
      restrictedHtml = `
        <div class="bg-red-50 p-3 rounded-lg border border-red-100 mt-4">
            ${sectionHeader('Restricted Drug Requirements')}
            <div class="grid grid-cols-2 gap-4">
                ${dataRow('Service Resident', p.service_resident_name)}
                ${dataRow('ID Specialist', p.id_specialist)}
            </div>
        </div>
      `;
    }

    // Indication Badge Color
    const indColor = p.selectedIndicationType === 'Therapeutic' ? 'bg-purple-100 text-purple-700 border-purple-200' : (p.selectedIndicationType === 'Prophylactic' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200');

    // Antimicrobial Badge Color
    const drugColor = p.drug_type === DrugType.RESTRICTED ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';

    return `
      <div class="space-y-6 font-sans">
        
        <!-- Top Section: Patient & Indication -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                ${sectionHeader('Patient Profile')}
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${p.patient_name || '—'}</h3>
                        <p class="text-xs text-gray-500 font-mono">${p.hospital_number || '—'}</p>
                    </div>
                    <span class="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">${p.mode === 'adult' ? 'Adult' : 'Pediatric'}</span>
                </div>
                <div class="grid grid-cols-2 gap-y-3 gap-x-2">
                    ${dataRow('Age / Sex', `${p.age || '?'} y / ${p.sex || '?'}`)}
                    ${dataRow('Wt / Ht', `${p.weight_kg || '?'} kg / ${p.height_cm || '?'} cm`)}
                    ${dataRow('Ward', p.ward)}
                    ${dataRow('Diagnosis', p.diagnosis, true)}
                </div>
            </div>

            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col">
                ${sectionHeader('Clinical Indication')}
                 <div class="mb-3">
                    <span class="inline-block px-2 py-1 rounded-md text-xs font-bold border ${indColor}">${p.selectedIndicationType || 'Not Selected'}</span>
                 </div>
                 <div class="flex-grow">
                    ${dataRow('Basis for Indication', p.basis_indication, true)}
                 </div>
                 <div class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100">
                    ${dataRow('SCr', p.scr_mgdl)}
                    ${dataRow('SGPT', p.sgpt)}
                    ${dataRow('eGFR', p.egfr_text)}
                 </div>
            </div>
        </div>

        <!-- Medication Section -->
        <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            ${sectionHeader('Medication Request')}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <span class="text-[10px] text-blue-400 uppercase font-semibold">Antimicrobial</span>
                    <h2 class="text-xl font-bold text-blue-900 leading-tight">${p.antimicrobial || '—'}</h2
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold border ${drugColor} self-start md:self-center text-center">
                    ${p.drug_type}
                </span>
            </div>
            
             ${renalAnalysis ? `
             <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded-r-md shadow-sm">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-xs font-bold text-yellow-800 uppercase tracking-wide">Renal Dosing Alert</h3>
                        <p class="text-sm text-yellow-700 mt-1">${renalAnalysis.recommendation}</p>
                    </div>
                </div>
             </div>
             ` : ''}

            <div class="grid grid-cols-3 gap-4 bg-white/60 p-3 rounded-md border border-blue-100/50">
                ${dataRow('Dose', p.dose)}
                ${dataRow('Frequency', p.frequency)}
                ${dataRow('Duration', p.duration)}
            </div>
        </div>

        <!-- Micro & History -->
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
             ${sectionHeader('Microbiology & History')}
             
             <div class="mb-4">
                <p class="text-[10px] text-gray-400 uppercase font-semibold mb-1">Previous Antibiotics</p>
                ${prevAbxHtml}
             </div>

             <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    ${dataRow('Specimen Source', p.specimen || '—', true)}
                </div>
                <div>
                    <p class="text-[10px] text-gray-400 uppercase font-semibold mb-2">Organisms Identified</p>
                    ${microHtml}
                </div>
             </div>
        </div>

        <!-- Personnel -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                ${sectionHeader('Requesting Physician')}
                <div class="grid grid-cols-2 gap-3">
                    ${dataRow('Resident', p.resident_name)}
                    ${dataRow('Department', p.clinical_dept)}
                </div>
             </div>
             <div class="flex items-center justify-end text-right px-4">
                <div>
                    <p class="text-[10px] text-gray-400 uppercase font-semibold">Request Date</p>
                    <p class="text-lg font-bold text-gray-700">${p.req_date}</p>
                </div>
             </div>
        </div>
        
        ${restrictedHtml}
      </div>
    `;
  };

  const indicationDescription = useMemo(() => {
    switch (formData.selectedIndicationType) {
      case 'Empiric': return "Treatment before culture results.";
      case 'Prophylactic': return "Prevent infection.";
      case 'Therapeutic': return "Target confirmed infection.";
      default: return "";
    }
  }, [formData.selectedIndicationType]);

  // !!! IMPORTANT: Return null check moved to the END to avoid hook order violation !!!
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="flex items-center justify-between gap-4 bg-[#009a3e] text-white px-6 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="https://maxterrenal-hash.github.io/amsone/osmaklogo.png" alt="OsMak Logo" className="h-10 w-auto object-contain" />
            <h3 className="text-xl font-bold">Antimicrobial Request Form</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Patient Mode Toggle */}
          <div className="inline-flex rounded-full border border-gray-300 bg-white shadow-sm mb-4">
            <button
              type="button"
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${patientMode === 'adult' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              onClick={() => handleModeChange('adult')}
            >Adult</button>
            <button
              type="button"
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${patientMode === 'pediatric' ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              onClick={() => handleModeChange('pediatric')}
            >Pediatric</button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Patient Information */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider">Patient Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormGroup label="Patient Name (Last, First)" className="lg:col-span-2">
                  <Input id="patient_name" name="patient_name" value={formData.patient_name} onChange={handleChange} placeholder="e.g. Dela Cruz, Juan" className={validationErrors.patient_name ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Hospital Number">
                  <Input id="hospital_number" name="hospital_number" value={formData.hospital_number} onChange={handleChange} placeholder="ID Number" className={validationErrors.hospital_number ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Request Date">
                  <Input type="date" id="req_date" name="req_date" value={formData.req_date} onChange={handleChange} className={validationErrors.req_date ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Age (years)">
                  <Input type="number" id="age" name="age" value={formData.age} onChange={handleChange} min={0} className={validationErrors.age ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Sex">
                  <Select id="sex" name="sex" value={formData.sex} onChange={handleChange} className={validationErrors.sex ? 'border-red-500 ring-red-200' : ''}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Weight (kg)">
                  <Input type="number" id="weight_kg" name="weight_kg" value={formData.weight_kg} onChange={handleChange} min={0} step={0.1} className={validationErrors.weight_kg ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Height (cm)" className={patientMode === 'pediatric' ? '' : 'hidden'}>
                  <Input type="number" id="height_cm" name="height_cm" value={formData.height_cm} onChange={handleChange} min={0} step={0.1} className={validationErrors.height_cm ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Ward / Unit" className="lg:col-span-2">
                  <div className="flex gap-2">
                    <Select
                      id="ward_select"
                      name="ward_select"
                      value={isCustomWard ? 'Others' : (WARDS.includes(formData.ward) ? formData.ward : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Others') {
                          setIsCustomWard(true);
                          setFormData(prev => ({ ...prev, ward: '' }));
                        } else {
                          setIsCustomWard(false);
                          setFormData(prev => ({ ...prev, ward: val }));
                        }
                      }}
                      className={validationErrors.ward ? 'border-red-500 ring-red-200' : ''}
                    >
                      <option value="">Select Ward</option>
                      {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                      <option value="Others">Others (Specify)</option>
                    </Select>
                  </div>
                  {isCustomWard && (
                    <Input
                      id="ward"
                      name="ward"
                      value={formData.ward}
                      onChange={handleChange}
                      placeholder="Specify Ward"
                      className={`mt-2 ${validationErrors.ward ? 'border-red-500 ring-red-200' : ''}`}
                    />
                  )}
                </FormGroup>
              </div>
            </div>

            {/* Clinical & Lab Data */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider">Clinical & Laboratory Data</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormGroup label="Diagnosis" className="md:col-span-2">
                  <Input id="diagnosis" name="diagnosis" value={formData.diagnosis} onChange={handleChange} className={validationErrors.diagnosis ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>

                <FormGroup label="Indication Type" className="lg:col-span-2">
                    <div className="flex flex-wrap gap-2">
                        {(['Empiric', 'Prophylactic', 'Therapeutic'] as const).map(ind => (
                            <button
                                key={ind}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, selectedIndicationType: ind }))}
                                className={`px-3 py-1 text-sm rounded-full border transition-colors ${formData.selectedIndicationType === ind ? 'bg-green-100 border-green-500 text-green-700 font-semibold' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
                            >{ind}</button>
                        ))}
                    </div>
                    {indicationDescription && (
                      <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100 mt-2">
                        {indicationDescription}
                      </p>
                    )}
                </FormGroup>

                <FormGroup label="Basis for Indication" className="col-span-full">
                  <Textarea id="basis_indication" name="basis_indication" value={formData.basis_indication} onChange={handleChange} placeholder="Describe rationale (clinical findings, suspected source, guideline basis, pending cultures, etc.)" rows={3} className={validationErrors.basis_indication ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                
                <FormGroup label="SGPT (U/L)">
                  <Input type="number" id="sgpt" name="sgpt" value={formData.sgpt} onChange={handleChange} min={0} className={validationErrors.sgpt ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="SCr (µmol/L)">
                  <Input type="number" id="scr_mgdl" name="scr_mgdl" value={formData.scr_mgdl} onChange={handleChange} min={0} step={0.01} disabled={scrNotAvailable} className={validationErrors.scr_mgdl ? 'border-red-500 ring-red-200' : ''} />
                  <label className="flex items-center text-xs text-gray-600 mt-1">
                    <input type="checkbox" checked={scrNotAvailable} onChange={(e) => setScrNotAvailable(e.target.checked)} className="mr-2 accent-green-600" />
                    Creatinine not yet available
                  </label>
                </FormGroup>
                <FormGroup label={patientMode === 'adult' ? "Renal Function (CKD-EPI eGFR)" : "Renal Function (CKiD eGFR)"} className="md:col-span-2">
                  <div className="rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-gray-100 text-gray-700">{formData.egfr_text || '—'}</div>
                </FormGroup>
              </div>
            </div>

            {/* Antimicrobial Selection */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
              <h4 className="text-xs font-bold text-blue-800 uppercase mb-4 tracking-wider">Antimicrobial Selection</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Custom Antimicrobial Field with View Monograph Button */}
                <div className="md:col-span-2 flex flex-col gap-1">
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-semibold text-gray-700">Antimicrobial</label>
                        {formData.antimicrobial && (
                            <button 
                                type="button" 
                                onClick={() => setShowMonograph(!showMonograph)}
                                className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 transition-colors font-semibold"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {showMonograph ? 'Hide Monograph' : 'View Monograph'}
                            </button>
                        )}
                    </div>
                    <Select id="antimicrobial" name="antimicrobial" value={formData.antimicrobial} onChange={handleChange} className={validationErrors.antimicrobial ? 'border-red-500 ring-red-200' : ''}>
                        <option value="">Select drug</option>
                        {drugLists[patientMode].map(drug => (
                        <option key={drug.value} value={drug.value}>{drug.label} ({drug.type})</option>
                        ))}
                    </Select>
                </div>

                <FormGroup label="Drug Type">
                  <Input type="text" value={formData.drug_type} readOnly className="bg-blue-100 text-blue-800 font-semibold cursor-default" />
                </FormGroup>
                
                {/* Renal Alert Banner */}
                {isCheckingRenal && <div className="col-span-full text-xs text-gray-500 italic animate-pulse">Checking renal dosing guidelines...</div>}
                {renalAnalysis && (
                  <div className="col-span-full bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm my-2">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm leading-5 font-medium text-yellow-800">
                          Renal Dosing Alert
                        </h3>
                        <div className="mt-2 text-sm leading-5 text-yellow-700">
                          <p>
                            Patient eGFR ({formData.egfr_text}) indicates potential renal impairment.
                            <br/>
                            <strong>Guideline Recommendation:</strong> {renalAnalysis.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Weight-Based Dosing Banner */}
                {isCheckingWeightDose && <div className="col-span-full text-xs text-gray-500 italic animate-pulse">Analyzing weight-based safety...</div>}
                {weightDosingAnalysis && (
                  <div className={`col-span-full border-l-4 p-4 rounded-md shadow-sm my-2 ${weightDosingAnalysis.status === 'SAFE' ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-400'}`}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        {weightDosingAnalysis.status === 'SAFE' ? (
                           <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                           </svg>
                        ) : (
                           <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                           </svg>
                        )}
                      </div>
                      <div className="ml-3">
                        <h3 className={`text-sm leading-5 font-medium ${weightDosingAnalysis.status === 'SAFE' ? 'text-green-800' : 'text-yellow-800'}`}>
                          {weightDosingAnalysis.status === 'SAFE' ? 'Dosing Verified' : 'Dosing Caution'}
                        </h3>
                        <div className={`mt-2 text-sm leading-5 ${weightDosingAnalysis.status === 'SAFE' ? 'text-green-700' : 'text-yellow-700'}`}>
                          <p>{weightDosingAnalysis.message}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <FormGroup label="Dose">
                  <Input id="dose" name="dose" value={formData.dose} onChange={handleChange} placeholder="e.g. 1g" className={validationErrors.dose ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Frequency">
                  <Input id="frequency" name="frequency" value={formData.frequency} onChange={handleChange} placeholder="e.g. q8h" className={validationErrors.frequency ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Duration (days)">
                  <Input id="duration" name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g. 7 days" className={validationErrors.duration ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
              </div>
              
              {/* Monograph Box - Conditionally Rendered */}
              {showMonograph && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-6 animate-fade-in transition-all duration-300">
                    <h4 className="text-sm font-bold text-gray-800 mb-2">Drug Monograph</h4>
                    <div className="text-sm text-gray-700 max-h-48 overflow-y-auto" dangerouslySetInnerHTML={{ __html: monographHtml }}></div>
                </div>
              )}
            </div>

            {/* Microbiology & History */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm transition-all duration-300">
              <div 
                className="flex justify-between items-center cursor-pointer select-none" 
                onClick={() => setIsMicroCollapsed(!isMicroCollapsed)}
              >
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  Microbiology & History
                </h4>
                <button type="button" className="text-gray-500 hover:text-gray-700">
                  {isMicroCollapsed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                  )}
                </button>
              </div>

              {!isMicroCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fade-in">
                  <FormGroup label="Previous / Current Antibiotics">
                    <div className="space-y-1">
                      {prevAbxRows.map(row => (
                        <PrevAbxRow key={row.id} id={row.id} value={row} onChange={updatePrevAbxRow} onRemove={removePrevAbxRow} />
                      ))}
                      <button type="button" onClick={addPrevAbxRow} className="flex items-center text-green-600 hover:text-green-800 text-sm font-medium gap-1 mt-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Antibiotic</button>
                    </div>
                  </FormGroup>
                  <div>
                    <FormGroup label="Specimen Type">
                      <Input id="specimen" name="specimen" value={formData.specimen} onChange={handleChange} placeholder="e.g. Blood, Sputum, Urine" />
                    </FormGroup>

                    <FormGroup label="Organisms" className="mt-4">
                      {organismBlocks.map(block => (
                        <OrganismBlock key={block.id} id={block.id} value={block} onChange={updateOrganismBlock} onRemove={removeOrganismBlock} />
                      ))}
                      <button type="button" onClick={addOrganismBlock} className="flex items-center text-green-600 hover:text-green-800 text-sm font-medium gap-1 mt-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Organism</button>
                    </FormGroup>
                  </div>
                </div>
              )}
            </div>

            {/* Requesting Personnel */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider">Requesting Personnel</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormGroup label="Resident In-Charge">
                  <Input id="resident_name" name="resident_name" value={formData.resident_name} onChange={handleChange} className={validationErrors.resident_name ? 'border-red-500 ring-red-200' : ''} />
                </FormGroup>
                <FormGroup label="Clinical Department">
                  <Select id="clinical_dept" name="clinical_dept" value={formData.clinical_dept} onChange={handleChange} className={validationErrors.clinical_dept ? 'border-red-500 ring-red-200' : ''}>
                    <option value="">Select Department</option>
                    {CLINICAL_DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </Select>
                </FormGroup>
                {formData.drug_type === DrugType.RESTRICTED && (
                  <>
                    <FormGroup label={patientMode === 'adult' ? "Internal Medicine Resident's Name" : "Pediatrics Resident's Name"}>
                      <Input id="service_resident_name" name="service_resident_name" value={formData.service_resident_name} onChange={handleChange} className={validationErrors.service_resident_name ? 'border-red-500 ring-red-200' : ''} />
                    </FormGroup>
                    <FormGroup label="Infectious Disease Specialist">
                      <Select id="id_specialist" name="id_specialist" value={formData.id_specialist} onChange={handleChange} className={validationErrors.id_specialist ? 'border-red-500 ring-red-200' : ''}>
                        <option value="">Select</option>
                        {(patientMode === 'adult' ? IDS_SPECIALISTS_ADULT : IDS_SPECIALISTS_PEDIATRIC).map(name => (<option key={name} value={name}>{name}</option>))}
                      </Select>
                    </FormGroup>
                  </>
                )}
              </div>
            </div>
            {Object.keys(validationErrors).length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                    Please correct the following errors:
                    <ul className="list-disc pl-5 mt-2">
                        {Object.values(validationErrors).map((msg, idx) => <li key={idx}>{msg}</li>)}
                    </ul>
                </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors" disabled={loading}>Cancel</button>
              <button type="submit" disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>

        {/* Review/Summary Modal */}
        <div className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm ${showReviewModal ? 'block' : 'hidden'}`} onClick={() => setShowReviewModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800">Review Antimicrobial Request</h3>
                    <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-700 rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="p-4 text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: reviewSummary }}></div>
                <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                    <button onClick={() => setShowReviewModal(false)} className="px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">Edit</button>
                    <button onClick={confirmAndSubmit} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2" disabled={loading}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {loading ? 'Submitting...' : 'Confirm & Submit'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AntimicrobialRequestForm;