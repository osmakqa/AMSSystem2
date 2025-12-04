
import React, { useState, useEffect } from 'react';
import { AMSAudit, AuditFinding } from '../types';
import AMSAuditSummary from './AMSAuditSummary';
import { updateAudit } from '../services/dataService';
import { supabase } from '../services/supabaseClient';

interface AMSAuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: AMSAudit | null;
  onEdit: (audit: AMSAudit) => void;
  onSave?: () => void; // Callback to refresh parent data
}

const FINDING_CATEGORIES = [
  'Wrong Choice',
  'Wrong Route',
  'Wrong Dose',
  'Wrong Duration',
  'No Infection',
  'Others'
];

const AMSAuditDetailModal: React.FC<AMSAuditDetailModalProps> = ({ isOpen, onClose, audit, onEdit, onSave }) => {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeSectionName, setActiveSectionName] = useState<string>('');
  
  // Structured Finding Inputs
  const [currentCategory, setCurrentCategory] = useState('');
  const [currentDetails, setCurrentDetails] = useState('');
  
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (audit && isOpen) {
        const fetchFreshFindings = async () => {
            try {
                // Fetch fresh findings from DB to ensure no stale data from parent
                const { data, error } = await supabase
                    .from('audits')
                    .select('audit_findings')
                    .eq('id', audit.id)
                    .single();

                if (data && data.audit_findings) {
                    const loadedFindings = (data.audit_findings || []).map((f: any) => ({
                        id: f.id || Date.now().toString() + Math.random(),
                        section: f.section || f.sectionId, 
                        category: f.category || 'Others',
                        details: f.details || f.note || '',
                        timestamp: f.timestamp || new Date().toISOString(),
                        user: f.user || 'Reviewer'
                    }));
                    setFindings(loadedFindings);
                } else {
                    // Fallback to prop data if DB fetch returns empty or error
                    const fallbackFindings = (audit.audit_findings || []).map((f: any) => ({
                        id: f.id || Date.now().toString() + Math.random(),
                        section: f.section || f.sectionId,
                        category: f.category || 'Others',
                        details: f.details || f.note || '',
                        timestamp: f.timestamp || new Date().toISOString(),
                        user: f.user || 'Reviewer'
                    }));
                    setFindings(fallbackFindings);
                }
            } catch (err) {
                console.error("Error fetching fresh findings:", err);
                // Fallback to existing prop data
                const fallbackFindings = (audit.audit_findings || []).map((f: any) => ({
                        id: f.id || Date.now().toString() + Math.random(),
                        section: f.section || f.sectionId,
                        category: f.category || 'Others',
                        details: f.details || f.note || '',
                        timestamp: f.timestamp || new Date().toISOString(),
                        user: f.user || 'Reviewer'
                }));
                setFindings(fallbackFindings);
            }
        };

        fetchFreshFindings();
        
        setActiveSectionId(null);
        setCurrentCategory('');
        setCurrentDetails('');
    }
  }, [audit, isOpen]);

  if (!isOpen || !audit) return null;

  const handleSectionSelect = (id: string, name: string) => {
    setActiveSectionId(id);
    setActiveSectionName(name);
    // Reset form for new entry
    setCurrentCategory('');
    setCurrentDetails('');
  };

  const handleAddFinding = () => {
    if (!activeSectionId || !currentCategory) return;

    const newFinding: AuditFinding = {
        id: Date.now().toString(),
        section: activeSectionId, // We use the ID to link back to the summary view
        category: currentCategory,
        details: currentDetails,
        timestamp: new Date().toISOString(),
        user: 'AMS Admin' // Ideally comes from context, hardcoded for now
    };

    setFindings(prev => [...prev, newFinding]);
    
    // Clear inputs but keep section active for more entries
    setCurrentCategory('');
    setCurrentDetails('');
  };

  const removeFinding = (id: string) => {
    setFindings(prev => prev.filter(f => f.id !== id));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
        // Send updated findings to DB
        await updateAudit(audit.id, { audit_findings: findings });
        
        // Refresh parent data
        if (onSave) onSave();
        
        alert("Audit findings saved successfully!"); 
        onClose();
    } catch (e) {
        console.error(e);
        alert("Failed to save findings. Please check your internet connection or permissions.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
        
        {/* LEFT PANE: Interactive Summary */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-gray-50/50">
             <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 flex justify-between items-center text-white shadow-md">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Audit Record #{audit.id}
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 opacity-80">Click any section below to add findings.</p>
                </div>
                <button onClick={() => onEdit(audit)} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors">Edit Original Data</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                <AMSAuditSummary 
                    data={audit} 
                    onSectionSelect={handleSectionSelect} 
                    highlightedSections={findings.map(f => f.section)} 
                />
            </div>
        </div>

        {/* RIGHT PANE: Audit Findings / Notes */}
        <div className="w-[400px] flex flex-col bg-white shadow-[-5px_0_15px_rgba(0,0,0,0.05)] z-10">
            <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                 <h4 className="font-bold text-yellow-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    Audit Findings
                 </h4>
                 <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Active Editing Area */}
                {activeSectionId ? (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="text-xs font-bold text-blue-800 uppercase">Adding Finding For:</h5>
                            <button onClick={() => setActiveSectionId(null)} className="text-blue-400 hover:text-blue-600">&times;</button>
                        </div>
                        <p className="text-sm font-bold text-gray-800 mb-3 border-b border-blue-200 pb-2">{activeSectionName}</p>
                        
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

                {/* List of Existing Findings */}
                {findings.length > 0 && (
                    <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                        <h5 className="text-xs font-bold text-gray-400 uppercase">Recorded Findings ({findings.length})</h5>
                        {findings.map((f, idx) => (
                            <div key={idx} className="bg-red-50 border-l-4 border-red-400 p-3 rounded-md shadow-sm relative group">
                                <button 
                                    onClick={() => removeFinding(f.id)}
                                    className="absolute top-2 right-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    &times;
                                </button>
                                <p className="text-xs font-bold text-red-800 uppercase mb-1">{f.section}</p>
                                <p className="text-sm font-bold text-gray-900">{f.category}</p>
                                <p className="text-xs text-gray-600 mt-1">{f.details}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button 
                    onClick={handleSaveChanges} 
                    disabled={isSaving}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-green-700 transition-all flex justify-center items-center gap-2"
                >
                    {isSaving ? 'Saving...' : 'Save Audit Findings'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AMSAuditDetailModal;
