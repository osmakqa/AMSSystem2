import React from 'react';
import { LOGO_URL } from '../constants';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#009a3e] text-white px-6 py-4 flex justify-between items-center shadow-md shrink-0">
            <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Logo" className="h-8 w-8 bg-white rounded-full p-0.5" />
                <h3 className="text-lg font-bold">User Manual</h3>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto font-sans text-gray-900 leading-relaxed">
            
            {/* Title Page Simulation */}
            <div className="text-center mb-10 border-b border-gray-200 pb-8">
                <img src={LOGO_URL} alt="Logo" className="h-24 w-24 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-green-900 mb-2">Ospital ng Makati Antimicrobial Stewardship System</h1>
                <h2 className="text-xl text-gray-800">User Manual</h2>
                <p className="text-sm text-gray-600 mt-2">Digital Decision Support & Compliance Monitoring</p>
            </div>

            {/* 1. System Overview */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">1</span>
                    System Overview
                </h3>
                <p className="text-gray-800 text-sm">
                    The OsMak Antimicrobial Stewardship (AMS) System is a digital platform designed to streamline the request, review, and approval process for antimicrobial prescriptions. It ensures patient safety through AI-powered guardrails and enforces hospital policy regarding Restricted and Monitored drugs.
                </p>
            </section>

            {/* 2. Getting Started */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">2</span>
                    Getting Started
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-2 text-sm">Login Credentials</h4>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-700">
                                <th className="pb-2">User Role</th>
                                <th className="pb-2">Navigation</th>
                                <th className="pb-2">Password</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-800">
                            <tr><td className="py-2 font-medium">Resident / Physician</td><td>Submit Request</td><td className="font-mono text-gray-800">[None]</td></tr>
                            <tr><td className="py-2 font-medium">Pharmacist</td><td>Pending, History</td><td className="font-mono text-gray-800">********</td></tr>
                            <tr><td className="py-2 font-medium">ID Specialist (IDS)</td><td>Pending, History</td><td className="font-mono text-gray-800">********</td></tr>
                            <tr><td className="py-2 font-medium">AMS Admin</td><td>Data Analysis</td><td className="font-mono text-gray-800">********</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 3. Guide for Residents */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">3</span>
                    Guide for Residents & Physicians
                </h3>
                <div className="space-y-2 text-sm text-gray-800 pl-2 border-l-4 border-green-200">
                    <p><strong>1. Go to the login page.</strong></p>
                    <p><strong>2. Click "Submit New Antimicrobial Request".</strong></p>
                    <p><strong>3. Step 1: Patient Info</strong> – Enter Name, ID, Age, Weight. <em>Pediatrics require Height for eGFR.</em></p>
                    <p><strong>4. Step 2: Clinical Data</strong> – Enter Diagnosis, Indication, and Lab results (SCr). <em>AI feature displays renal-dosing alerts.</em></p>
                    <p><strong>5. Step 3: Medication</strong> – Select antimicrobial.</p>
                    <ul className="list-disc pl-6 text-gray-800">
                        <li><span className="text-blue-700 font-bold">Monitored:</span> Reviewed by Pharmacy.</li>
                        <li><span className="text-red-700 font-bold">Restricted:</span> Requires IDS approval.</li>
                    </ul>
                    <p><strong>6. Step 4: Micro & History</strong> – Add history of antibiotics/organisms.</p>
                    <p><strong>7. Submit</strong> the request.</p>
                </div>
            </section>

            {/* 4. Guide for Pharmacists */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">4</span>
                    Guide for Pharmacists
                </h3>
                <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1 mb-3">
                    <li>Log in as <strong>Pharmacist</strong>.</li>
                    <li>View requests from the <strong>"Pending"</strong> tab.</li>
                    <li>Click a request card to view: Monograph, Labs, History.</li>
                </ul>
                <h4 className="font-bold text-gray-900 text-sm mb-1">Taking Action</h4>
                <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                    <li><strong>Monitored Drugs:</strong> Approve or Disapprove.</li>
                    <li><strong>Restricted Drugs:</strong> Click <strong>"For IDS Approval"</strong>.</li>
                    <li><strong>Pediatric Safety:</strong> System auto-calculates mg/kg dose.</li>
                    <li><strong>Review Findings:</strong> Add structured comments like <em>Wrong Dose, Wrong Duration</em>.</li>
                </ul>
            </section>

            {/* 5. Guide for IDS */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">5</span>
                    Guide for ID Specialists (IDS)
                </h3>
                <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                    <li>Log in as <strong>IDS</strong>.</li>
                    <li>Review requests forwarded by Pharmacy.</li>
                    <li><strong>Approve</strong> or <strong>Disapprove</strong> to finalize.</li>
                </ul>
            </section>

            {/* 6. Guide for AMS Admins */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">6</span>
                    Guide for AMS Admins
                </h3>
                
                <h4 className="font-bold text-gray-900 text-sm mt-3 mb-1 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-700" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>
                    Data Analysis
                </h4>
                <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1 mb-4">
                    <li>Log in as <strong>AMS</strong>. Default tab opens <strong>Data Analysis</strong>.</li>
                    <li>Filter using Month/Year dropdowns.</li>
                    <li>Charts show: Volume, Top Drugs, Restricted vs Monitored, Turnaround Times.</li>
                    <li>Click any chart or KPI to <strong>Export to CSV</strong>.</li>
                </ul>

                <h4 className="font-bold text-gray-900 text-sm mt-3 mb-1 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                    AMS Audit Tool
                </h4>
                <ol className="list-decimal pl-5 text-sm text-gray-800 space-y-1">
                    <li>Click <strong>"AMS Audit"</strong> tab.</li>
                    <li><strong>New Audit:</strong> Fill Context, Patient Info, Dosing, Codes (Diagnosis/Indication).</li>
                    <li><strong>AI Guardrails</strong> check renal and weight dosing automatically.</li>
                    <li><strong>Review & Submit</strong> summary.</li>
                    <li><strong>Manage Logs:</strong> Review, Edit, and update audit notes.</li>
                </ol>
            </section>

            {/* 7. Troubleshooting */}
            <section className="mb-8">
                <h3 className="text-xl font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-900 w-8 h-8 flex items-center justify-center rounded-full text-sm">7</span>
                    Troubleshooting
                </h3>
                <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                    <li><strong>"Database Error":</strong> Contact IPC.</li>
                    <li><strong>"Loading..." stuck:</strong> Refresh or check connection.</li>
                </ul>
            </section>

        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
            <button onClick={onClose} className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm">
                Close Manual
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserManualModal;