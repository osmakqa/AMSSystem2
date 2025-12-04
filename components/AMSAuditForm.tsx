
import React, { useState, useEffect, useRef } from 'react';
import { createAudit, updateAudit } from '../services/dataService';
import { AMSAudit } from '../types';
import AMSAuditSummary from './AMSAuditSummary';
import { checkRenalDosing, verifyWeightBasedDosing, verifyPediatricDosing } from '../services/geminiService';
import { ADULT_MONOGRAPHS } from '../data/adultMonographs';
import { PEDIATRIC_MONOGRAPHS } from '../data/pediatricMonographs';

// --- CONSTANTS ---
const AREAS = [
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
  "Surgery Male",
  "Others (Specify)"
];

const AUDITORS = ["Max", "Micha", "Miko", "Belle", "Michael"];
const SHIFTS = ["6 to 2", "2 to 10", "10 to 6"];

const INDICATION_CATEGORIES_OPTIONS = ["CAI", "HAI", "SP", "MP", "OTH", "UNK"];
const HAI_SUB_CATEGORIES_OPTIONS = ["HAI1", "HAI2", "HAI3", "HAI4", "HAI5", "HAI6"];
const HAI2_SPECIFIC_OPTIONS = ["HAI2-CVC-BSI", "HAI2-PVC-BSI", "HAI2-VAP", "HAI2-CAUTI"];
const SP_TYPES_OPTIONS = ["SP1", "SP2", "SP3"];

const RES_TYPES = ["MRSA", "MRCoNS", "PNSP", "MLS", "VRE", "ESBL", "3GCREB", "CRE", "ESBL-NF", "CR-NF", "other MDRO"];
const MISS_REASONS = ["stock out", "could not purchase", "patient refused", "other reason", "multiple reasons", "unknown"];

const MONITORED_DRUGS = ["Imipenem", "Meropenem", "Ertapenem", "Doripenem", "Gentamicin", "Amikacin", "Ciprofloxacin", "Levofloxacin", "Moxifloxacin", "Aztreonam", "Ceftolozane-Tazobactam", "Colistin", "Linezolid", "Tigecycline", "Vancomycin", "Cefepime"];
const RESTRICTED_DRUGS = ["Ciprofloxacin", "Levofloxacin", "Moxifloxacin", "Ceftriaxone", "Cefotaxime", "Ceftazidime", "Cefixime", "Cefpodoxime", "Gentamicin", "Amikacin", "Clindamycin"];

const DIAG_PRIMARY = ["Therapeutic", "Prophylaxis", "Neonates"];

const SITE_CATEGORIES = ["CNS", "EYE", "ENT", "RESP", "CVS", "GI", "SSTBJ", "UTI", "GUOB", "No defined site (NDS)"];

const THER_CODES: Record<string, string[]> = {
  "CNS": ["CNS", "Proph CNS"],
  "EYE": ["EYE", "Proph EYE"],
  "ENT": ["ENT", "AOM", "Proph ENT"],
  "RESP": ["LUNG", "URTI", "Bron", "Pneu", "COVID-19", "TB", "CF", "Proph RESP"],
  "CVS": ["CVS", "Proph CVS"],
  "GI": ["GI", "IA", "CDIF", "Proph GI"],
  "SSTBJ": ["SST", "BJ", "Proph BJ"],
  "UTI": ["Cys", "Pye", "ASB", "Proph UTI"],
  "GUOB": ["OBGY", "GUM", "Proph OBGY"],
  "No defined site (NDS)": ["BAC", "SEPSIS", "Malaria", "HIV", "PUO", "PUO-HO", "FN", "LYMPH", "Sys-DI", "Other", "MP-GEN", "UNK", "PROK"]
};

const PROPH_CODES: Record<string, string[]> = {
  "CNS": ["Proph CNS"],
  "EYE": ["Proph EYE"],
  "ENT": ["Proph ENT"],
  "RESP": ["Proph RESP"],
  "CVS": ["Proph CVS"],
  "GI": ["Proph GI"],
  "SSTBJ": ["Proph BJ"],
  "UTI": ["Proph UTI"],
  "GUOB": ["Proph OBGY"],
  "No defined site (NDS)": ["MP-GEN", "UNK", "PROK", "BAC", "SEPSIS", "Malaria", "HIV", "PUO", "PUO-HO", "FN", "LYMPH", "Sys-DI", "Other"], 
  "Neonatal": ["MP-MAT", "NEO-MP", "CLD"]
};

const NEO_CODES = ["MP-MAT", "NEO-MP", "CLD"];

const CODE_DESCRIPTIONS: Record<string, string> = {
  "Proph CNS": "Prophylaxis for CNS (neurosurgery, meningococcal)",
  "CNS": "Infections of the Central Nervous System",
  "Proph EYE": "Prophylaxis for Eye operations",
  "EYE": "Therapy for Eye infections (e.g., endophthalmitis)",
  "Proph ENT": "Prophylaxis for Ear, Nose, Throat (surgical or medical prophylaxis = SP/MP)",
  "ENT": "Therapy for Ear, Nose, Throat infections including mouth, sinuses, larynx",
  "AOM": "Acute otitis media",
  "Proph RESP": "Pulmonary surgery, prophylaxis for respiratory pathogens (e.g., aspergillosis)",
  "LUNG": "Lung abscess including aspergilloma",
  "URTI": "Upper respiratory tract viral infections (including influenza but not ENT)",
  "Bron": "Acute bronchitis or exacerbations of chronic bronchitis",
  "Pneu": "Pneumonia or LRTI (lower respiratory tract infections)",
  "COVID-19": "Coronavirus disease caused by SARS-CoV-2 infection",
  "TB": "Pulmonary tuberculosis",
  "CF": "Cystic fibrosis",
  "Proph CVS": "Cardiac or vascular surgery prophylaxis; endocarditis prophylaxis",
  "CVS": "Cardiovascular system infections: endocarditis, endovascular device infection (e.g., pacemaker, vascular graft)",
  "Proph GI": "Gastrointestinal tract surgery, liver/biliary tree procedures; GI prophylaxis in neutropenic patients or hepatic failure",
  "GI": "Gastrointestinal infections (salmononellosis, Campylobacter, parasitic infections)",
  "IA": "Intra-abdominal sepsis including hepatobiliary and intra-abdominal abscess",
  "CDIF": "Clostridioides difficile infection",
  "Proph BJ": "Prophylaxis for Skin & Soft Tissue (SST), plastic or orthopedic surgery (Bone or Joint)",
  "SST": "Skin and soft tissue infections: cellulitis, surgical site infection, deep soft tissue infection not involving bone (e.g., infected pressure ulcer, diabetic ulcer, abscess)",
  "BJ": "Bone/Joint infections: septic arthritis (including prosthetic joint), osteomyelitis",
  "Proph UTI": "Prophylaxis for urological surgery (SP) or recurrent urinary tract infection (MP)",
  "Cys": "Lower urinary tract infection (UTI): cystitis",
  "Pye": "Upper UTI including catheter-related UTI, pyelonephritis",
  "ASB": "Asymptomatic bacteriuria",
  "Proph OBGY": "Prophylaxis for obstetric or gynecological surgery (SP: caesarean section, no episiotomy; MP: carriage of group B streptococcus)",
  "OBGY": "Obstetric/gynecological infections, sexually transmitted diseases (STD) in women",
  "GUM": "Genito-urinary males + prostatitis, epididymo-orchitis, STD in men",
  "BAC": "Bacteraemia or fungaemia with no clear anatomic site and no shock",
  "SEPSIS": "Sepsis of any origin (e.g., urosepsis, pulmonary sepsis), sepsis syndrome or septic shock with no clear anatomic site; includes fungaemia (candidemia) with septic symptoms",
  "Malaria": "Malaria",
  "HIV": "Human immunodeficiency virus",
  "PUO": "Pyrexia of Unknown Origin; fever syndrome without identified source or site",
  "PUO-HO": "Fever syndrome in non-neutropenic hemato-oncology patients with no identified source",
  "FN": "Fever in the neutropenic patient",
  "LYMPH": "Lymphatics as the primary source of infection (e.g., suppurative lymphadenitis)",
  "Sys-DI": "Disseminated infection (viral infections such as measles, CMV, etc.)",
  "Other": "Antimicrobial prescribed with documentation but no defined diagnosis group",
  "MP-GEN": "Medical prophylaxis in general without targeting a specific site (e.g., antifungal prophylaxis during immunosuppression)",
  "UNK": "Completely unknown indication",
  "PROK": "Antimicrobial (e.g., erythromycin) prescribed for prokinetic use",
  "MP-MAT": "Medical prophylaxis for maternal risk factors (e.g., prolonged rupture of membranes)",
  "NEO-MP": "Medical prophylaxis for newborn risk factors (e.g., VLBW, IUGR)",
  "CLD": "Chronic lung disease: long-term respiratory problems in premature babies (bronchopulmonary dysplasia)",
  "CAI": "Community-acquired infection: Symptoms started ≤48 hours from admission (or present on admission).",
  "HAI": "Healthcare-associated infection: Symptoms start >48 hours after admission.",
  "HAI1": "Post-operative surgical site infection (within 30 days of surgery OR 90 days after implant surgery).",
  "HAI2": "Intervention-related infections of mixed origin (mix of CVC-BSI, PVC-BSI, VAP, CAUTI; or infections related to tubes/drains).",
  "HAI2-CVC-BSI": "Central venous catheter-related bloodstream infection.",
  "HAI2-PVC-BSI": "Peripheral vascular catheter-related bloodstream infection.",
  "HAI2-VAP": "Ventilator-associated pneumonia.",
  "HAI2-CAUTI": "Catheter-associated urinary tract infection.",
  "HAI3": "Clostridioides difficile–associated diarrhoea (CDAD) (>48h post-admission or <30 days after discharge from previous admission).",
  "HAI4": "Other hospital-acquired infection of mixed or undefined origin (HAP, UTI, BSI).",
  "HAI4-BSI": "Bloodstream infection, not intervention-related.",
  "HAI4-HAP": "Non-intervention-related hospital-acquired pneumonia (not VAP).",
  "HAI4-UTI": "Urinary tract infection, not intervention-related.",
  "HAI5": "Patient readmitted <48h after staying in another hospital, with infection present on current admission or within 48 hours (infection likely from another hospital).",
  "HAI6": "Infection present on admission from long-term care facility (LTCF) or nursing home.",
  "SP": "Surgical prophylaxis category.", 
  "SP1": "Single dose.",
  "SP2": "One day.",
  "SP3": "More than 1 day.",
  "MP": "Medical prophylaxis. Examples: long-term use to prevent UTIs, antifungals in chemotherapy patients, penicillin prophylaxis in asplenia, etc.",
  "OTH": "Any other use. Example: erythromycin as a motility agent (motilin agonist).",
};

// --- HELPERS FOR eGFR CALCULATION ---
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

// --- TYPES ---
interface AntimicrobialEntry {
  id: number;
  class: string;
  drug: string;
  start: string;
  dose: string;
  unit: string;
  freq: string;
  perday: string;
  route: string;
  diagP: string;
  diagS: string;
  diagSub: string;
  indicationCategory: string;
  indicationSubCategory: string;
  indicationSpecificType: string;
  reason: string;
  guide: string;
  stop: string;
  miss: string;
  missWhy: string;
  treat: string;
  auditNote: string; 
  isOpen: boolean; 
}

interface MicroEntry {
  id: number;
  org: string;
  res: string;
  note: string;
}

interface AMSAuditFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AMSAudit | null;
}

// --- SUB-COMPONENTS ---
const FormGroup = ({ label, required, children, className = '' }: { label: string, required?: boolean, children: React.ReactNode, className?: string }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className={`text-xs font-bold text-gray-600 uppercase tracking-wide ${required ? "after:content-['*'] after:text-red-500 after:ml-0.5" : ""}`}>{label}</label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-500 transition-all ${props.className || ''}`} />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-500 transition-all ${props.className || ''}`} />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 disabled:bg-gray-50 disabled:text-gray-500 transition-all ${props.className || ''}`} />
);

// Consistent Section Header
const FormSectionHeader = ({ title, icon }: { title: string, icon?: React.ReactNode }) => (
  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
    {icon}
    {title}
  </h2>
);

// --- GUIDE MODAL ---
interface DiagnosisGuideModalProps {
  onClose: () => void;
  onSelectCode: (diagP: string, diagS: string, diagSub: string) => void;
}

const DiagnosisGuideModal: React.FC<DiagnosisGuideModalProps> = ({ onClose, onSelectCode }) => {
  const allCodes = Object.entries(CODE_DESCRIPTIONS).filter(([code]) => 
    !INDICATION_CATEGORIES_OPTIONS.includes(code) &&
    !HAI_SUB_CATEGORIES_OPTIONS.includes(code) &&
    !HAI2_SPECIFIC_OPTIONS.includes(code) &&
    !SP_TYPES_OPTIONS.includes(code)
  );

  const handleSelect = (code: string) => {
    let diagP = "Therapeutic";
    let diagS = "";
    let diagSub = code;

    if (NEO_CODES.includes(code)) {
      diagP = "Neonates";
      diagS = "Neonatal";
    } else {
      for (const siteCategory of SITE_CATEGORIES) {
        if (THER_CODES[siteCategory]?.includes(code)) {
          diagS = siteCategory;
          if (PROPH_CODES[siteCategory]?.includes(code)) {
              diagP = "Prophylaxis";
          } else {
              diagP = "Therapeutic";
          }
          break;
        } else if (PROPH_CODES[siteCategory]?.includes(code)) { 
          diagS = siteCategory;
          diagP = "Prophylaxis";
          break;
        }
      }
      if (!diagS && SITE_CATEGORIES.includes("No defined site (NDS)")) {
          const ndsCodes = [...(THER_CODES["No defined site (NDS)"] || []), ...(PROPH_CODES["No defined site (NDS)"] || [])];
          if (ndsCodes.includes(code)) {
              diagS = "No defined site (NDS)";
              if (PROPH_CODES["No defined site (NDS)"]?.includes(code) && !THER_CODES["No defined site (NDS)"]?.includes(code)) {
                  diagP = "Prophylaxis";
              } else if (THER_CODES["No defined site (NDS)"]?.includes(code) && !PROPH_CODES["No defined site (NDS)"]?.includes(code)) {
                  diagP = "Therapeutic";
              } else {
                  diagP = "Therapeutic";
              }
          }
      }
    }
    
    if (!diagS) diagS = "No defined site (NDS)"; 
    if (code === "UNK" || code === "Other" || code === "MP-GEN" || code === "PROK") {
        if (PROPH_CODES["No defined site (NDS)"]?.includes(code)) {
            diagP = "Prophylaxis";
        } else {
            diagP = "Therapeutic";
        }
    }

    onSelectCode(diagP, diagS, diagSub);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Appendix II - Diagnostic Codes Guide</h3>
          <button onClick={onClose}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="overflow-y-auto p-6">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border p-2 font-bold text-gray-700">Site</th>
                <th className="border p-2 font-bold text-gray-700">Code</th>
                <th className="border p-2 font-bold text-gray-700">Description / Examples</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map(([code, desc]) => {
                const site = SITE_CATEGORIES.find(cat => THER_CODES[cat]?.includes(code) || PROPH_CODES[cat]?.includes(code)) || (NEO_CODES.includes(code) ? "Neonatal" : "No defined site (NDS)");
                
                return (
                  <tr 
                    key={code} 
                    className="border-b cursor-pointer hover:bg-green-50 transition-colors"
                    onClick={() => handleSelect(code)}
                  >
                    <td className="border p-2 font-semibold text-gray-600">{site}</td>
                    <td className="border p-2 font-bold text-green-700">{code}</td>
                    <td className="border p-2 text-gray-800">{desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


interface IndicationGuideModalProps {
  onClose: () => void;
  onSelectIndication: (category: string, subCategory: string, specificType: string) => void;
}

const IndicationGuideModal: React.FC<IndicationGuideModalProps> = ({ onClose, onSelectIndication }) => {

  const handleSelect = (category: string, subCategory: string = '', specificType: string = '') => {
    onSelectIndication(category, subCategory, specificType);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Indication Type Guide</h3>
          <button onClick={onClose}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="overflow-y-auto p-6">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border p-2 font-bold text-gray-700">Category</th>
                <th className="border p-2 font-bold text-gray-700">Sub-category / Type</th>
                <th className="border p-2 font-bold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {INDICATION_CATEGORIES_OPTIONS.map(cat => (
                <React.Fragment key={cat}>
                  <tr 
                    className="border-b bg-gray-50 cursor-pointer hover:bg-green-50 transition-colors"
                    onClick={() => handleSelect(cat)}
                  >
                    <td className="border p-2 font-semibold text-green-700">{cat}</td>
                    <td className="border p-2 font-medium text-gray-600"></td>
                    <td className="border p-2 text-gray-800">{CODE_DESCRIPTIONS[cat]}</td>
                  </tr>
                  {cat === 'HAI' && HAI_SUB_CATEGORIES_OPTIONS.map(subCat => (
                    <React.Fragment key={subCat}>
                      <tr 
                        className="border-b cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => handleSelect(cat, subCat)}
                      >
                        <td className="border p-2"></td>
                        <td className="border p-2 font-bold text-blue-700">{subCat}</td>
                        <td className="border p-2 text-gray-800">{CODE_DESCRIPTIONS[subCat]}</td>
                      </tr>
                      {subCat === 'HAI2' && HAI2_SPECIFIC_OPTIONS.map(specType => (
                        <tr 
                          key={specType} 
                          className="border-b bg-blue-50/20 cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => handleSelect(cat, subCat, specType)}
                        >
                          <td className="border p-2"></td>
                          <td className="border p-2 pl-6 font-bold text-blue-600">{specType}</td>
                          <td className="border p-2 text-gray-800">{CODE_DESCRIPTIONS[specType]}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {cat === 'SP' && SP_TYPES_OPTIONS.map(spType => (
                    <tr 
                      key={spType} 
                      className="border-b cursor-pointer hover:bg-purple-50 transition-colors"
                      onClick={() => handleSelect(cat, spType)}
                    >
                      <td className="border p-2"></td>
                      <td className="border p-2 font-bold text-purple-700">{spType}</td>
                      <td className="border p-2 text-gray-800">{CODE_DESCRIPTIONS[spType]}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const AMSAuditForm: React.FC<AMSAuditFormProps> = ({ isOpen, onClose, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [showDiagnosisGuide, setShowDiagnosisGuide] = useState(false);
  const [showIndicationGuide, setShowIndicationGuide] = useState(false);
  const [showReview, setShowReview] = useState(false);
  
  // --- FORM STATE ---
  const [audit, setAudit] = useState({ auditor: '', auditorOther: '', area: '', areaOther: '', date: new Date().toISOString().slice(0, 10), shift: '' });
  const [generalNote, setGeneralNote] = useState(''); // NEW GENERAL NOTE
  
  const [patientMode, setPatientMode] = useState<'adult' | 'pediatric'>('adult');
  const [patient, setPatient] = useState({ 
      hospNo: '', 
      dob: '', 
      ageString: '',
      sex: '', // Added Sex
      weight: '', 
      height: '',
      scr: '', 
      egfr: '' 
  });

  // Diagnostics
  const [dx, setDx] = useState({
    bioYN: 'No', bioType: '', bioTypeOther: '', bioFluid: '', bioFluidOther: '',
    cultDone: 'No', cultType: '', cultTypeOther: ''
  });

  // Antimicrobials (5 slots)
  const [abx, setAbx] = useState<AntimicrobialEntry[]>(
    Array.from({ length: 5 }).map((_, i) => ({
      id: i, class: '', drug: '', start: '', dose: '', unit: '', freq: '', perday: '', route: '',
      diagP: '', diagS: '', diagSub: '', 
      indicationCategory: '', indicationSubCategory: '', indicationSpecificType: '', 
      reason: '', guide: '', stop: '', miss: '', missWhy: '', treat: '',
      auditNote: '', 
      isOpen: i === 0 
    }))
  );
  const [activeAbxIndex, setActiveAbxIndex] = useState<number | null>(0); 

  // AI Guardrail States (Per drug index)
  const [aiAnalysis, setAiAnalysis] = useState<Record<number, {
      renal?: { requiresAdjustment: boolean; recommendation: string },
      weight?: { status: 'SAFE' | 'WARNING'; message: string },
      pediatric?: { isSafe: boolean; message: string }
  }>>({});

  // Microorganisms - Dynamic
  const [isMicroCollapsed, setIsMicroCollapsed] = useState(true);
  const [micro, setMicro] = useState<MicroEntry[]>([]);
  const nextMicroId = useRef(0);

  // History
  const [hist, setHist] = useState({ prevHosp: '', prevAbx: '' });

  // --- INITIALIZATION FOR EDIT MODE ---
  useEffect(() => {
    if (initialData) {
        // Map Auditor
        const isAuditorCustom = !AUDITORS.includes(initialData.auditor);
        setAudit({
            auditor: isAuditorCustom ? 'Others (Specify)' : initialData.auditor,
            auditorOther: isAuditorCustom ? initialData.auditor : '',
            area: AREAS.includes(initialData.area) ? initialData.area : 'Others (Specify)',
            areaOther: AREAS.includes(initialData.area) ? '' : initialData.area,
            date: initialData.audit_date,
            shift: initialData.shift
        });
        
        // Map General Note
        setGeneralNote(initialData.general_audit_note || '');

        // Map Patient
        // Check age string to auto-set patient mode if possible
        const isPediatric = initialData.patient_age_string?.includes('mo') || (parseInt(initialData.patient_age_string) < 19 && initialData.patient_age_string?.includes('yr'));
        setPatientMode(isPediatric ? 'pediatric' : 'adult');

        setPatient({
            hospNo: initialData.patient_hosp_no,
            dob: initialData.patient_dob,
            ageString: initialData.patient_age_string,
            // Extended fields (might be undefined if coming from old record)
            sex: (initialData.diagnostics as any)?.sex || '', // Load Sex
            weight: (initialData.diagnostics as any)?.weight || '',
            height: (initialData.diagnostics as any)?.height || '',
            scr: (initialData.diagnostics as any)?.scr || '',
            egfr: (initialData.diagnostics as any)?.egfr || ''
        });

        // Map Diagnostics
        setDx({
            bioYN: initialData.diagnostics.biomarkerUsed,
            bioType: initialData.diagnostics.biomarkerType || '',
            bioTypeOther: initialData.diagnostics.biomarkerTypeOther || '',
            bioFluid: initialData.diagnostics.fluidSample || '',
            bioFluidOther: initialData.diagnostics.fluidSampleOther || '',
            cultDone: initialData.diagnostics.cultureDone,
            cultType: initialData.diagnostics.cultureSpecimen || '',
            cultTypeOther: initialData.diagnostics.cultureSpecimenOther || ''
        });

        // Map History
        setHist({
            prevHosp: initialData.history.prevHosp3mo,
            prevAbx: initialData.history.prevAbx1mo
        });

        // Map Microorganisms
        const mappedMicro = (initialData.microorganisms || []).map((m: any, idx: number) => ({
            id: idx,
            org: m.organism,
            res: m.resistance,
            note: m.note
        }));
        setMicro(mappedMicro);
        nextMicroId.current = mappedMicro.length;

        // Map Antimicrobials (Fill up to 5 slots)
        const mappedAbx = Array.from({ length: 5 }).map((_, i) => {
            const existing = initialData.antimicrobials && initialData.antimicrobials[i];
            if (existing) {
                return {
                    id: i,
                    class: existing.class,
                    drug: existing.drug,
                    start: existing.startDate,
                    dose: existing.unitDose?.toString() || '',
                    unit: existing.unit,
                    freq: existing.frequency || '',
                    perday: existing.dosesPerDay?.toString() || '',
                    route: existing.route,
                    diagP: existing.diagnosis,
                    diagS: existing.systemSite,
                    diagSub: existing.subSite,
                    indicationCategory: existing.indicationCategory || '',
                    indicationSubCategory: existing.indicationSubCategory || '',
                    indicationSpecificType: existing.indicationSpecificType || '',
                    reason: existing.reasonInNote,
                    guide: existing.guidelinesCompliance,
                    stop: existing.stopReviewDocumented,
                    miss: existing.missedN?.toString() || '',
                    missWhy: existing.missedReason,
                    treat: existing.treatment,
                    auditNote: existing.auditNote || '', // Map Audit Note
                    isOpen: false
                };
            } else {
                 return {
                    id: i, class: '', drug: '', start: '', dose: '', unit: '', freq: '', perday: '', route: '',
                    diagP: '', diagS: '', diagSub: '', indicationCategory: '', indicationSubCategory: '', indicationSpecificType: '',
                    reason: '', guide: '', stop: '', miss: '', missWhy: '', treat: '',
                    auditNote: '',
                    isOpen: false
                 };
            }
        });
        if (mappedAbx.length > 0) mappedAbx[0].isOpen = true;
        setAbx(mappedAbx);
    }
  }, [initialData]);

  // --- CALCULATE AGE BASED ON AUDIT DATE ---
  useEffect(() => {
    if (patient.dob && audit.date) {
      const dobDate = new Date(patient.dob);
      const auditDate = new Date(audit.date);

      if (dobDate > auditDate) {
        setPatient(prev => ({ ...prev, ageString: "Invalid: DOB after Audit Date" }));
        return;
      }

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

  // --- AUTO CALCULATE eGFR ---
  useEffect(() => {
    // Requires: Age, Sex, SCr (Adult) OR Height, SCr (Pediatric)
    if (!patient.scr) {
      // If SCr is cleared, clear eGFR
      if (patient.egfr && patient.egfr !== '—' && patient.egfr !== 'Pending') {
         setPatient(prev => ({...prev, egfr: ''}));
      }
      return;
    }

    let egfrText = '—';
    const scrNum = parseFloat(patient.scr);
    
    // Check if valid SCr
    if (isNaN(scrNum) || scrNum <= 0) {
       setPatient(prev => ({...prev, egfr: ''}));
       return;
    }
    
    // Convert µmol/L to mg/dL for calculation
    const scrMgDl = scrNum / 88.4; 

    if (patientMode === 'adult') {
        // Need Age and Sex
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
        // Pediatric: Needs Height (cm)
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


  // --- AI GUARDRAIL TRIGGERS ---
  useEffect(() => {
      if (activeAbxIndex === null) return;
      const idx = activeAbxIndex; // Guardrail index for async closure
      const currentDrug = abx[idx];
      if (!currentDrug.drug) return;

      const runChecks = async () => {
          let results: any = { ...aiAnalysis[idx] };
          let hasChanges = false;

          // 1. Renal Check
          const monograph = patientMode === 'adult' ? ADULT_MONOGRAPHS[currentDrug.drug] : PEDIATRIC_MONOGRAPHS[currentDrug.drug];
          if (patient.egfr && monograph?.renal) {
              const renalRes = await checkRenalDosing(currentDrug.drug, patient.egfr, monograph.renal);
              if (renalRes) {
                  results.renal = renalRes;
                  hasChanges = true;
              }
          }

          // 2. Weight-Based & Pediatric Check
          if (patient.weight && currentDrug.dose) {
              if (patientMode === 'pediatric') {
                  const pediaRes = await verifyPediatricDosing(currentDrug.drug, patient.weight, patient.ageString, currentDrug.dose, currentDrug.freq, PEDIATRIC_MONOGRAPHS[currentDrug.drug]?.dosing || '');
                  if (pediaRes) {
                      results.pediatric = pediaRes;
                      hasChanges = true;
                  }
              } else {
                   // Adult Weight Check (for specific drugs)
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
              setAiAnalysis(prev => ({ ...prev, [idx]: results }));
          }
      };

      // Debounce logic
      const timer = setTimeout(() => {
          runChecks();
      }, 1500);
      return () => clearTimeout(timer);
  }, [
      activeAbxIndex, 
      activeAbxIndex !== null ? abx[activeAbxIndex]?.drug : undefined, 
      activeAbxIndex !== null ? abx[activeAbxIndex]?.dose : undefined, 
      activeAbxIndex !== null ? abx[activeAbxIndex]?.freq : undefined, 
      patient.egfr, 
      patient.weight, 
      patientMode
  ]);


  // --- HANDLERS ---
  const updateAbx = (index: number, field: keyof AntimicrobialEntry, value: any) => {
    setAbx(prev => prev.map((item, i) => {
      if (i !== index) return item;

      let updated = { ...item, [field]: value };

      // Logic: Frequency auto-calc
      if (field === 'freq') {
        const freqVal = parseFloat(value);
        if (!isNaN(freqVal) && freqVal > 0) {
            updated.perday = (24 / freqVal).toString();
        } else if (value === '') {
            updated.perday = '';
        }
      }

      // Logic: Clear Dependent Fields for Diagnosis
      if (field === 'class') updated.drug = '';
      if (field === 'diagP') { updated.diagS = ''; updated.diagSub = ''; }
      if (field === 'diagS') updated.diagSub = '';
      
      // Logic: Clear Dependent Fields for Indication
      if (field === 'indicationCategory') {
        updated.indicationSubCategory = '';
        updated.indicationSpecificType = '';
      }
      if (field === 'indicationSubCategory') {
        updated.indicationSpecificType = '';
      }

      if (field === 'miss' && (Number(value) <= 0 || value === '')) updated.missWhy = '';

      return updated;
    }));
  };

  const toggleAbxAccordion = (index: number) => {
    setAbx(prev => prev.map((item, i) => i === index ? { ...item, isOpen: !item.isOpen } : item));
    setActiveAbxIndex(index); 
  };

  const addMicroorganism = () => {
    setMicro(prev => [...prev, { id: nextMicroId.current++, org: '', res: '', note: '' }]);
    setIsMicroCollapsed(false);
  };

  const removeMicroorganism = (id: number) => {
    setMicro(prev => prev.filter(m => m.id !== id));
  };

  const updateMicroorganism = (id: number, field: keyof MicroEntry, value: string) => {
    setMicro(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // --- Callbacks for Guide Modals ---
  const handleSelectDiagnosisCode = (diagP: string, diagS: string, diagSub: string) => {
    if (activeAbxIndex !== null) {
      setAbx(prev => prev.map((item, i) => {
        if (i === activeAbxIndex) {
          return {
            ...item,
            diagP,
            diagS,
            diagSub,
          };
        }
        return item;
      }));
    }
  };

  const handleSelectIndication = (category: string, subCategory: string, specificType: string) => {
    if (activeAbxIndex !== null) {
      setAbx(prev => prev.map((item, i) => {
        if (i === activeAbxIndex) {
          return {
            ...item,
            indicationCategory: category,
            indicationSubCategory: subCategory,
            indicationSpecificType: specificType,
          };
        }
        return item;
      }));
    }
  };


  // --- VALIDATION & SUBMIT ---
  const validate = () => {
    if (!audit.auditor) return "Auditor is required.";
    if (audit.auditor === 'Others (Specify)' && !audit.auditorOther) return "Specify Auditor name.";
    if (!audit.area) return "Ward/Area is required.";
    if (audit.area === 'Others (Specify)' && !audit.areaOther) return "Specify Ward/Area.";
    if (!audit.date) return "Date is required.";
    if (!audit.shift) return "Shift is required.";
    if (!patient.hospNo) return "Hospital Number is required.";
    if (!patient.dob) return "Date of Birth is required.";

    if (dx.bioYN === 'Yes' && !dx.bioType) return "Specify biomarker type.";
    if (dx.bioYN === 'Yes' && dx.bioType === 'Others' && !dx.bioTypeOther) return "Specify Other biomarker type.";
    if (dx.bioYN === 'Yes' && !dx.bioFluid) return "Specify biological sample.";
    if (dx.bioYN === 'Yes' && dx.bioFluid === 'Others' && !dx.bioFluidOther) return "Specify Other fluid sample.";
    if (dx.cultDone === 'Yes' && !dx.cultType) return "Select culture specimen type.";
    if (dx.cultDone === 'Yes' && dx.cultType === 'Other' && !dx.cultTypeOther) return "Specify Other culture specimen.";

    const activeAbx = abx.filter(a => a.drug || a.start || a.dose);
    if (activeAbx.length === 0) return "Enter at least one antimicrobial.";

    for (let i = 0; i < activeAbx.length; i++) {
      const a = activeAbx[i];
      const num = a.id + 1;
      if (!a.class) return `Antimicrobial ${num}: Select Monitored/Restricted.`;
      if (!a.drug) return `Antimicrobial ${num}: Select Drug.`;
      if (!a.start) return `Antimicrobial ${num}: Start Date required.`;
      if (!a.dose || Number(a.dose) <= 0) return `Antimicrobial ${num}: Invalid dose.`;
      if (!a.unit) return `Antimicrobial ${num}: Unit required.`;
      if (!a.perday) return `Antimicrobial ${num}: Doses/day required.`;
      if (!a.route) return `Antimicrobial ${num}: Route required.`;
      if (!a.diagP) return `Antimicrobial ${num}: Diagnosis Type required.`;
      if ((a.diagP === 'Therapeutic' || a.diagP === 'Prophylaxis') && !a.diagS) return `Antimicrobial ${num}: System/Site required.`;
      if ((a.diagP === 'Therapeutic' || a.diagP === 'Prophylaxis') && THER_CODES[a.diagS]?.length > 0 && !a.diagSub && !PROPH_CODES[a.diagS]?.length) return `Antimicrobial ${num}: Sub-site required.`; 
      if (a.diagP === 'Neonates' && !a.diagSub) return `Antimicrobial ${num}: Neonatal code required.`;
      
      if (!a.indicationCategory) return `Antimicrobial ${num}: Indication Category required.`;
      if ((a.indicationCategory === 'HAI' || a.indicationCategory === 'SP') && !a.indicationSubCategory) return `Antimicrobial ${num}: Indication Sub-category required.`;
      if (a.indicationCategory === 'HAI' && a.indicationSubCategory === 'HAI2' && !a.indicationSpecificType) return `Antimicrobial ${num}: Indication Specific Type for HAI2 required.`;

      if (!a.reason) return `Antimicrobial ${num}: Reason in note required.`;
      if (!a.guide) return `Antimicrobial ${num}: Guidelines Compliance required.`;
      if (!a.treat) return `Antimicrobial ${num}: Treatment type required.`;
      if (Number(a.miss) > 0 && !a.missWhy) return `Antimicrobial ${num}: Missed dose reason required.`;
    }

    if (!hist.prevHosp) return "Previous Hospitalization history required.";
    if (!hist.prevAbx) return "Previous Antibiotic history required.";

    return null;
  };

  const prepareAuditData = () => {
    const activeAbx = abx.filter(a => a.drug || a.start || a.dose).map(a => ({
      class: a.class,
      drug: a.drug,
      startDate: a.start,
      unitDose: Number(a.dose),
      unit: a.unit,
      frequency: a.freq, 
      dosesPerDay: Number(a.perday),
      route: a.route,
      diagnosis: a.diagP,
      systemSite: a.diagS || "",
      subSite: a.diagSub || "",
      indicationCategory: a.indicationCategory,
      indicationSubCategory: a.indicationSubCategory || "",
      indicationSpecificType: a.indicationSpecificType || "",
      reasonInNote: a.reason,
      guidelinesCompliance: a.guide,
      stopReviewDocumented: a.stop,
      missedN: Number(a.miss) || 0,
      missedReason: a.missWhy || "",
      treatment: a.treat,
      auditNote: a.auditNote
    }));

    const activeMicro = micro.filter(m => m.org || m.res || m.note).map(m => ({
      organism: m.org.trim(),
      resistance: m.res,
      note: m.note.trim()
    }));

    const finalAuditor = audit.auditor === 'Others (Specify)' ? audit.auditorOther : audit.auditor;
    const finalArea = audit.area === 'Others (Specify)' ? audit.areaOther : audit.area;

    const data: Partial<AMSAudit> = {
      audit_date: audit.date,
      auditor: finalAuditor,
      area: finalArea,
      shift: audit.shift,
      patient_hosp_no: patient.hospNo,
      patient_dob: patient.dob,
      patient_age_string: patient.ageString,
      general_audit_note: generalNote, // NEW
      diagnostics: {
        biomarkerUsed: dx.bioYN,
        biomarkerType: dx.bioType,
        fluidSample: dx.bioFluid,
        biomarkerTypeOther: dx.bioType === 'Others' ? dx.bioTypeOther : "",
        fluidSampleOther: dx.bioFluid === 'Others' ? dx.bioFluidOther : "",
        cultureDone: dx.cultDone,
        cultureSpecimen: dx.cultType,
        cultureSpecimenOther: dx.cultType === 'Other' ? dx.cultTypeOther : "",
        // Save new fields
        sex: patient.sex, // Added Sex
        weight: patient.weight,
        height: patient.height,
        scr: patient.scr,
        egfr: patient.egfr
      },
      history: {
        prevHosp3mo: hist.prevHosp,
        prevAbx1mo: hist.prevAbx
      },
      antimicrobials: activeAbx,
      microorganisms: activeMicro,
      created_at: initialData ? initialData.created_at : new Date().toISOString()
    };
    return data;
  };

  const handleInitialSubmit = () => {
    const error = validate();
    if (error) {
      alert(error);
      return;
    }
    setShowReview(true);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    const newAudit = prepareAuditData();

    try {
      if (initialData && initialData.id) {
         await updateAudit(initialData.id, newAudit);
         alert("Audit Log Updated Successfully.");
      } else {
         await createAudit(newAudit);
         alert("Audit Log Created Successfully.");
      }
      setShowReview(false);
      onClose();
    } catch (e: any) {
      console.error("Submission error", e);
      alert("Submission failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const getIndicationDescription = (item: AntimicrobialEntry) => {
    if (item.indicationSpecificType && CODE_DESCRIPTIONS[item.indicationSpecificType]) {
      return CODE_DESCRIPTIONS[item.indicationSpecificType];
    }
    if (item.indicationSubCategory && CODE_DESCRIPTIONS[item.indicationSubCategory]) {
      return CODE_DESCRIPTIONS[item.indicationSubCategory];
    }
    if (item.indicationCategory && CODE_DESCRIPTIONS[item.indicationCategory]) {
      return CODE_DESCRIPTIONS[item.indicationCategory];
    }
    return '';
  };


  if (!isOpen) return null;

  return (
    <>
      {showDiagnosisGuide && <DiagnosisGuideModal onClose={() => setShowDiagnosisGuide(false)} onSelectCode={handleSelectDiagnosisCode} />}
      {showIndicationGuide && <IndicationGuideModal onClose={() => setShowIndicationGuide(false)} onSelectIndication={handleSelectIndication} />}
      
      {/* Review Modal - Matched to Detail Modal Style */}
      {showReview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4 backdrop-blur-md">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in border border-gray-200">
                <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 flex justify-between items-center text-white shadow-md">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Confirm Audit Submission
                    </h3>
                    <button onClick={() => setShowReview(false)} className="bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <AMSAuditSummary data={prepareAuditData()} />
                </div>

                <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                    <button onClick={() => setShowReview(false)} className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">Edit</button>
                    <button onClick={handleFinalSubmit} disabled={loading} className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold shadow-sm hover:shadow-lg transition-all flex items-center gap-2">
                        {loading ? 'Submitting...' : (initialData ? 'Update Audit Log' : 'Confirm Submission')}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <header className="flex items-center justify-between gap-4 bg-gradient-to-r from-gray-800 to-gray-700 text-white px-6 py-4 sticky top-0 z-10 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-1.5 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <h3 className="text-xl font-bold tracking-tight">{initialData ? `Edit Audit Log #${initialData.id}` : 'AMS Audit Tool'}</h3>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </header>

          {/* Form Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">

            {/* Mode Toggle */}
            <div className="flex justify-end">
                 <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button 
                        type="button" 
                        onClick={() => setPatientMode('adult')}
                        className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${patientMode === 'adult' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                        Adult
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setPatientMode('pediatric')}
                        className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${patientMode === 'pediatric' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                        Pediatric
                    </button>
                </div>
            </div>

            {/* Section 1: Audit & Patient */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                <FormSectionHeader title="Audit Information" />
                <div className="grid grid-cols-2 gap-4">
                  <FormGroup label="Auditor" required>
                    <Select value={audit.auditor} onChange={e => setAudit({ ...audit, auditor: e.target.value })}>
                      <option value="">Select</option>
                      {AUDITORS.map(o => <option key={o} value={o}>{o}</option>)}
                      <option value="Others (Specify)">Others (Specify)</option>
                    </Select>
                  </FormGroup>
                  {audit.auditor === 'Others (Specify)' && (
                    <FormGroup label="Specify Auditor" required>
                      <Input value={audit.auditorOther} onChange={e => setAudit({ ...audit, auditorOther: e.target.value })} />
                    </FormGroup>
                  )}
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                      <FormGroup label="Area" required>
                          <Select value={audit.area} onChange={e => setAudit({ ...audit, area: e.target.value })}>
                              <option value="">Select Ward</option>
                              {AREAS.map(o => <option key={o} value={o}>{o}</option>)}
                          </Select>
                      </FormGroup>
                      {audit.area === 'Others (Specify)' && (
                          <FormGroup label="Specify Area" required>
                              <Input value={audit.areaOther} onChange={e => setAudit({ ...audit, areaOther: e.target.value })} />
                          </FormGroup>
                      )}
                  </div>
                  <FormGroup label="Date of Audit" required><Input type="date" value={audit.date} onChange={e => setAudit({ ...audit, date: e.target.value })} /></FormGroup>
                  <FormGroup label="Shift" required><Select value={audit.shift} onChange={e => setAudit({ ...audit, shift: e.target.value })}><option value="">Select</option>{SHIFTS.map(o => <option key={o} value={o}>{o}</option>)}</Select></FormGroup>
                </div>
              </section>

              <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                <FormSectionHeader title="Patient Information" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><FormGroup label="Hospital Number" required><Input value={patient.hospNo} onChange={e => setPatient({ ...patient, hospNo: e.target.value })} placeholder="Enter ID" /></FormGroup></div>
                  <FormGroup label="Date of Birth" required>
                    <Input type="date" value={patient.dob} onChange={e => setPatient({ ...patient, dob: e.target.value })} />
                  </FormGroup>
                  <FormGroup label="Age (On Audit Date)">
                    <Input value={patient.ageString} readOnly className="bg-gray-100 font-medium text-green-800 border-transparent cursor-default" />
                  </FormGroup>
                  
                  {/* New Fields for AI */}
                  <FormGroup label="Sex">
                     <Select value={patient.sex} onChange={e => setPatient({ ...patient, sex: e.target.value })}>
                         <option value="">Select</option>
                         <option value="Male">Male</option>
                         <option value="Female">Female</option>
                     </Select>
                  </FormGroup>
                  <FormGroup label="Weight (kg)">
                      <Input type="number" value={patient.weight} onChange={e => setPatient({ ...patient, weight: e.target.value })} placeholder="Required for AI" />
                  </FormGroup>
                  {patientMode === 'pediatric' && (
                      <FormGroup label="Height (cm)">
                          <Input type="number" value={patient.height} onChange={e => setPatient({ ...patient, height: e.target.value })} placeholder="Required for eGFR" />
                      </FormGroup>
                  )}
                  <FormGroup label="SCr (µmol/L)">
                      <Input type="number" value={patient.scr} onChange={e => setPatient({ ...patient, scr: e.target.value })} placeholder="Required for eGFR" />
                  </FormGroup>
                  <FormGroup label="eGFR" className="col-span-1">
                      <Input type="text" value={patient.egfr} readOnly className="bg-gray-100 font-medium text-blue-800 border-transparent cursor-default" placeholder="Auto-calculated" />
                  </FormGroup>
                </div>
              </section>
            </div>

            {/* Section 2: Diagnostics */}
            <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <FormSectionHeader title="Diagnostics & Biomarkers" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <FormGroup label="Biomarker/WBC Guided?" required><Select value={dx.bioYN} onChange={e => setDx({ ...dx, bioYN: e.target.value })}><option value="No">No</option><option value="Yes">Yes</option></Select></FormGroup>
                <FormGroup label="Biomarker">
                  <Select disabled={dx.bioYN !== 'Yes'} value={dx.bioType} onChange={e => setDx({ ...dx, bioType: e.target.value })}>
                    <option value="">Select</option><option value="CRP">CRP</option><option value="PCT">PCT</option><option value="WBC">WBC</option><option value="Others">Others</option>
                  </Select>
                  {dx.bioType === 'Others' && <Input placeholder="Specify" className="mt-2" value={dx.bioTypeOther} onChange={e => setDx({ ...dx, bioTypeOther: e.target.value })} />}
                </FormGroup>
                <FormGroup label="Fluid Sample">
                  <Select disabled={dx.bioYN !== 'Yes'} value={dx.bioFluid} onChange={e => setDx({ ...dx, bioFluid: e.target.value })}>
                    <option value="">Select</option><option value="Blood">Blood</option><option value="Urine">Urine</option><option value="Others">Others</option>
                  </Select>
                  {dx.bioFluid === 'Others' && <Input placeholder="Specify" className="mt-2" value={dx.bioFluidOther} onChange={e => setDx({ ...dx, bioFluidOther: e.target.value })} />}
                </FormGroup>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormGroup label="Culture Done?" required><Select value={dx.cultDone} onChange={e => setDx({ ...dx, cultDone: e.target.value })}><option value="No">No</option><option value="Yes">Yes</option></Select></FormGroup>
                <FormGroup label="Specimen">
                  <Select disabled={dx.cultDone !== 'Yes'} value={dx.cultType} onChange={e => setDx({ ...dx, cultType: e.target.value })}>
                    <option value="">Select</option><option value="Blood">Blood</option><option value="Urine">Urine</option><option value="Stool">Stool</option><option value="CSF">CSF</option><option value="Wound">Wound</option><option value="Sputum.Bronchial aspirate">Sputum/Asp</option><option value="Other">Other</option>
                  </Select>
                  {dx.cultType === 'Other' && <Input placeholder="Specify" className="mt-2" value={dx.cultTypeOther} onChange={e => setDx({ ...dx, cultTypeOther: e.target.value })} />}
                </FormGroup>
              </div>
            </section>

            {/* Section 3: Antimicrobials */}
            <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Antimicrobials (Max 5)
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowDiagnosisGuide(true)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Diagnosis Code Guide
                    </button>
                    <button 
                      onClick={() => setShowIndicationGuide(true)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Indication Type Guide
                    </button>
                  </div>
              </div>
              
              <div className="space-y-3">
                {abx.map((item, idx) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200 hover:border-gray-300">
                    <button
                      onClick={() => toggleAbxAccordion(idx)}
                      className={`w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left ${item.isOpen ? 'border-b border-gray-200' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${item.drug ? item.drug : "Antimicrobial"} ${item.drug ? 'text-green-700' : 'text-gray-500'}`}>
                            {idx + 1}. {item.drug ? item.drug : "Antimicrobial"}
                          </span>
                          {/* Indicator for audit note */}
                          {item.auditNote && (
                              <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded border border-yellow-200 font-bold">Note Added</span>
                          )}
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-white border border-gray-200 px-2 py-1 rounded text-gray-500">{item.isOpen ? 'Collapse' : 'Expand'}</span>
                    </button>

                    {item.isOpen && (
                      <div className="p-5 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in">
                        <FormGroup label="Class" required>
                          <Select value={item.class} onChange={e => updateAbx(idx, 'class', e.target.value)}>
                            <option value="">Select</option><option value="Monitored">Monitored</option><option value="Restricted">Restricted</option>
                          </Select>
                        </FormGroup>
                        <FormGroup label="Antimicrobial" required>
                          <Select value={item.drug} onChange={e => updateAbx(idx, 'drug', e.target.value)} disabled={!item.class}>
                            <option value="">Select</option>
                            {(item.class === 'Monitored' ? MONITORED_DRUGS : item.class === 'Restricted' ? RESTRICTED_DRUGS : []).map(d => <option key={d} value={d}>{d}</option>)}
                          </Select>
                        </FormGroup>
                        <FormGroup label="Start Date" required><Input type="date" value={item.start} onChange={e => updateAbx(idx, 'start', e.target.value)} /></FormGroup>
                        <div className="lg:col-span-2"></div>

                        {/* AI ALERTS */}
                        {aiAnalysis[idx]?.renal?.requiresAdjustment && (
                            <div className="col-span-full bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-md shadow-sm">
                                <div className="flex">
                                    <div className="flex-shrink-0"><svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                                    <div className="ml-3"><h3 className="text-xs font-bold text-yellow-800 uppercase tracking-wide">Renal Guardrail</h3><p className="text-sm text-yellow-700 mt-1">{aiAnalysis[idx].renal?.recommendation}</p></div>
                                </div>
                            </div>
                        )}
                        {aiAnalysis[idx]?.pediatric && !aiAnalysis[idx].pediatric?.isSafe && (
                            <div className="col-span-full bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r-md shadow-sm">
                                <div className="flex">
                                    <div className="flex-shrink-0"><svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                                    <div className="ml-3"><h3 className="text-xs font-bold text-orange-800 uppercase tracking-wide">Pediatric Safety</h3><p className="text-sm text-orange-700 mt-1">{aiAnalysis[idx].pediatric?.message}</p></div>
                                </div>
                            </div>
                        )}


                        {/* Dosing Row */}
                        <FormGroup label="Unit Dose" required><Input type="number" min={0} step={0.001} value={item.dose} onChange={e => updateAbx(idx, 'dose', e.target.value)} /></FormGroup>
                        <FormGroup label="Unit" required><Select value={item.unit} onChange={e => updateAbx(idx, 'unit', e.target.value)}><option value="">Select</option><option value="g">g</option><option value="mg">mg</option><option value="IU">IU</option><option value="MU">MU</option></Select></FormGroup>
                        <FormGroup label="Freq (Every _ hrs)">
                            <Input type="number" min={0} value={item.freq} onChange={e => updateAbx(idx, 'freq', e.target.value)} placeholder="8" />
                        </FormGroup>
                        <FormGroup label="Doses/Day" required>
                            <Input type="number" min={0} value={item.perday} onChange={e => updateAbx(idx, 'perday', e.target.value)} />
                        </FormGroup>
                        <FormGroup label="Route" required><Select value={item.route} onChange={e => updateAbx(idx, 'route', e.target.value)}><option value="">Select</option><option value="IM">IM</option><option value="IV">IV</option><option value="O">PO</option><option value="R">Rectal</option></Select></FormGroup>

                        {/* Diagnosis Indication Row */}
                        <FormGroup label="Diagnosis Type" required>
                          <Select value={item.diagP} onChange={e => updateAbx(idx, 'diagP', e.target.value)}>
                            <option value="">Select</option>{DIAG_PRIMARY.map(d => <option key={d} value={d}>{d}</option>)}
                          </Select>
                        </FormGroup>
                        
                        {item.diagP === 'Neonates' ? (
                            <FormGroup label="Neonatal Code">
                                <Select value={item.diagSub} onChange={e => updateAbx(idx, 'diagSub', e.target.value)}>
                                  <option value="">Select</option>
                                  {NEO_CODES.map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                            </FormGroup>
                        ) : (
                            <>
                                <FormGroup label="System/Site">
                                  <Select value={item.diagS} onChange={e => updateAbx(idx, 'diagS', e.target.value)} disabled={!item.diagP || item.diagP === 'Neonates'}>
                                    <option value="">Select</option>
                                    {SITE_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </Select>
                                </FormGroup>
                                <FormGroup label="Sub-site / Code">
                                  <Select value={item.diagSub} onChange={e => updateAbx(idx, 'diagSub', e.target.value)} disabled={!item.diagS}>
                                    <option value="">Select</option>
                                    {item.diagS && (
                                        (item.diagP === 'Therapeutic' ? THER_CODES[item.diagS] : (item.diagP === 'Prophylaxis' ? PROPH_CODES[item.diagS] : []))?.map(s => <option key={s} value={s}>{s}</option>)
                                    )}
                                  </Select>
                                </FormGroup>
                            </>
                        )}
                        <div className="lg:col-span-2"></div> 

                        {/* Dynamic Diagnosis Description Box */}
                        {item.diagSub && CODE_DESCRIPTIONS[item.diagSub] && (
                            <div className="col-span-full bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-800 flex items-start gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span><strong>{item.diagSub}:</strong> {CODE_DESCRIPTIONS[item.diagSub]}</span>
                            </div>
                        )}

                        {/* NEW Indication Type fields */}
                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <FormGroup label="Indication Category" required>
                                <Select value={item.indicationCategory} onChange={e => updateAbx(idx, 'indicationCategory', e.target.value)}>
                                    <option value="">Select</option>
                                    {INDICATION_CATEGORIES_OPTIONS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </Select>
                            </FormGroup>

                            {(item.indicationCategory === 'HAI' || item.indicationCategory === 'SP') && (
                                <FormGroup label="Sub-Category" required>
                                    <Select value={item.indicationSubCategory} onChange={e => updateAbx(idx, 'indicationSubCategory', e.target.value)}>
                                        <option value="">Select</option>
                                        {item.indicationCategory === 'HAI' && HAI_SUB_CATEGORIES_OPTIONS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                        {item.indicationCategory === 'SP' && SP_TYPES_OPTIONS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                    </Select>
                                </FormGroup>
                            )}

                            {item.indicationCategory === 'HAI' && item.indicationSubCategory === 'HAI2' && (
                                <FormGroup label="Specific Type" required>
                                    <Select value={item.indicationSpecificType} onChange={e => updateAbx(idx, 'indicationSpecificType', e.target.value)}>
                                        <option value="">Select</option>
                                        {HAI2_SPECIFIC_OPTIONS.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                                    </Select>
                                </FormGroup>
                            )}
                        </div>

                        {/* Dynamic Indication Description Box */}
                        {getIndicationDescription(item) && (
                            <div className="col-span-full bg-indigo-50 border border-indigo-100 rounded p-2 text-xs text-indigo-800 flex items-start gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>{getIndicationDescription(item)}</span>
                            </div>
                        )}

                        <FormGroup label="Reason in Note?" required><Select value={item.reason} onChange={e => updateAbx(idx, 'reason', e.target.value)}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></Select></FormGroup>
                        
                        <FormGroup label="Guidelines Compliance" required><Select value={item.guide} onChange={e => updateAbx(idx, 'guide', e.target.value)}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option><option value="No Local Guidelines">No Local Guidelines</option><option value="No information">No information</option></Select></FormGroup>
                        <FormGroup label="Stop/Review Documented?"><Select value={item.stop} onChange={e => updateAbx(idx, 'stop', e.target.value)}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></Select></FormGroup>
                        <FormGroup label="Missed Doses (N)"><Input type="number" min={0} value={item.miss} onChange={e => updateAbx(idx, 'miss', e.target.value)} placeholder="0" /></FormGroup>
                        <FormGroup label="Reason for Missed">
                          <Select value={item.missWhy} onChange={e => updateAbx(idx, 'missWhy', e.target.value)} disabled={Number(item.miss) <= 0}>
                            <option value="">Select</option>{MISS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </Select>
                        </FormGroup>
                        <FormGroup label="Treatment" required><Select value={item.treat} onChange={e => updateAbx(idx, 'treat', e.target.value)}><option value="">Select</option><option value="Empirical">Empirical</option><option value="Targeted">Targeted</option></Select></FormGroup>

                        {/* Audit Note Field */}
                        <div className="col-span-full mt-2">
                             <FormGroup label="Audit Note / Clinical Comments">
                                <Textarea 
                                    value={item.auditNote} 
                                    onChange={e => updateAbx(idx, 'auditNote', e.target.value)} 
                                    placeholder="Enter your clinical observations or audit findings here..."
                                    rows={2}
                                />
                             </FormGroup>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4: Micro & History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 transition-all duration-300">
                 <div 
                   className="flex justify-between items-center cursor-pointer select-none border-b border-gray-200 pb-2 mb-4" 
                   onClick={() => setIsMicroCollapsed(!isMicroCollapsed)}
                 >
                   <h2 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                     Microorganisms & Resistance
                   </h2>
                   <button type="button" className="text-gray-500 hover:text-green-700 transition-colors">
                      {isMicroCollapsed ? (
                        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide">Show <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide">Hide <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></span>
                      )}
                   </button>
                 </div>
                
                {!isMicroCollapsed && (
                  <div className="space-y-4 animate-fade-in">
                    {micro.length === 0 && <p className="text-sm text-gray-400 italic text-center py-2">No microorganisms added.</p>}
                    {micro.map((m, i) => (
                      <div key={m.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative group">
                        <button onClick={() => removeMicroorganism(m.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Microorganism {i + 1}</p>
                        <div className="grid grid-cols-1 gap-2">
                          <Input placeholder="Organism" value={m.org} onChange={e => updateMicroorganism(m.id, 'org', e.target.value)} />
                          <Select value={m.res} onChange={e => updateMicroorganism(m.id, 'res', e.target.value)}>
                            <option value="">Resistance Type</option>{RES_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                          </Select>
                          <Input placeholder="Notes" value={m.note} onChange={e => updateMicroorganism(m.id, 'note', e.target.value)} />
                        </div>
                      </div>
                    ))}
                    <button onClick={addMicroorganism} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold text-sm hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                       Add Organism
                    </button>
                  </div>
                )}
              </section>

              <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-fit">
                <FormSectionHeader title="Recent History" />
                <div className="space-y-4">
                  <FormGroup label="Previous hospitalization < 3 months" required>
                    <Select value={hist.prevHosp} onChange={e => setHist({ ...hist, prevHosp: e.target.value })}>
                      <option value="">Select</option><option value="Yes-ICU">Yes-ICU</option><option value="Yes-Other">Yes-Other</option><option value="No">No</option><option value="Unknown">Unknown</option>
                    </Select>
                  </FormGroup>
                  <FormGroup label="Previous antibiotic course < 1 month" required>
                    <Select value={hist.prevAbx} onChange={e => setHist({ ...hist, prevAbx: e.target.value })}>
                      <option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option><option value="Unknown">Unknown</option>
                    </Select>
                  </FormGroup>
                </div>
              </section>
            </div>

            {/* General Note */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
               <FormSectionHeader title="General Audit Notes" />
               <Textarea 
                  value={generalNote}
                  onChange={e => setGeneralNote(e.target.value)}
                  placeholder="Enter general comments about this audit case that apply to the whole patient or process..."
                  rows={3}
               />
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
            <button onClick={onClose} className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors" disabled={loading}>Cancel</button>
            <button onClick={handleInitialSubmit} disabled={loading} className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
              {loading ? 'Processing...' : (initialData ? 'Update & Review' : 'Review Audit')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AMSAuditForm;
