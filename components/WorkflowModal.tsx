import React from 'react';

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowStep = ({ number, title, description, statuses, color, icon }: { number: string, title: string, description: string, statuses: { text: string, color: string }[], color: string, icon: React.ReactNode }) => (
  <div className={`bg-white rounded-lg shadow-md p-5 border-t-4 ${color}`}>
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold flex-shrink-0">{number}</div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h4 className="font-bold text-gray-800">{title}</h4>
        </div>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <div className="flex flex-wrap gap-2">
          {statuses.map(s => (
            <span key={s.text} className={`text-xs font-bold px-2 py-1 rounded-full ${s.color}`}>{s.text}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const WorkflowModal: React.FC<WorkflowModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="flex items-center justify-between gap-4 bg-[#009a3e] text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <h3 className="text-xl font-bold">Antimicrobial Stewardship Workflow</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Step 1 */}
            <WorkflowStep 
              number="1"
              title="Request Creation"
              description="A Pharmacist receives an antimicrobial request and enters the complete details into the system."
              statuses={[{ text: 'PENDING', color: 'bg-yellow-100 text-yellow-800' }]}
              color="border-yellow-400"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
            />
            {/* Step 2 */}
            <WorkflowStep 
              number="2"
              title="Pharmacist Review"
              description="The Pharmacist reviews the request. If Monitored, they can approve/disapprove. If Restricted, they must forward to an IDS."
              statuses={[
                { text: 'APPROVED', color: 'bg-green-100 text-green-800' },
                { text: 'DISAPPROVED', color: 'bg-red-100 text-red-800' },
                { text: 'FOR IDS APPROVAL', color: 'bg-indigo-100 text-indigo-800' }
              ]}
              color="border-blue-400"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            />
            {/* Step 3 */}
            <WorkflowStep 
              number="3"
              title="IDS Review"
              description="An Infectious Disease Specialist reviews forwarded Restricted drug requests and provides a final decision."
              statuses={[
                { text: 'APPROVED', color: 'bg-green-100 text-green-800' },
                { text: 'DISAPPROVED', color: 'bg-red-100 text-red-800' }
              ]}
              color="border-purple-400"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" /></svg>}
            />
             {/* Step 4 */}
            <WorkflowStep 
              number="4"
              title="Finalization"
              description="The request is finalized with an 'Approved' or 'Disapproved' status, creating a permanent record."
              statuses={[
                { text: 'RECORDED', color: 'bg-gray-100 text-gray-800' }
              ]}
              color="border-gray-400"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
            />
             {/* Step 5 */}
            <WorkflowStep 
              number="5"
              title="Data Analysis"
              description="The AMS Admin reviews comprehensive analytics on drug usage, turnaround times, and other key metrics to improve the program."
              statuses={[
                { text: 'INSIGHTS', color: 'bg-teal-100 text-teal-800' }
              ]}
              color="border-teal-400"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
          </div>
        </div>
        {/* Footer */}
        <footer className="text-center text-xs text-gray-600 p-4 border-t border-gray-200 bg-white">
          Ospital ng Makati Antimicrobial Stewardship System
        </footer>
      </div>
    </div>
  );
};

export default WorkflowModal;