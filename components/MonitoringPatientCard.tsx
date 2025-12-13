
import React from 'react';
import { MonitoringPatient } from '../types';

interface MonitoringPatientCardProps {
  patient: MonitoringPatient;
  onClick: (patient: MonitoringPatient) => void;
}

const MonitoringPatientCard: React.FC<MonitoringPatientCardProps> = ({ patient, onClick }) => {
  const activeDrugs = patient.antimicrobials?.filter(a => a.status === 'Active') || [];
  
  const calculateDay = (startDate: string) => {
      const start = new Date(startDate);
      const now = new Date();
      // Normalize to start of day to avoid time differences
      start.setHours(0,0,0,0);
      now.setHours(0,0,0,0);
      const diffTime = now.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays >= 0 ? diffDays + 1 : 1; // Day 1 is the start date
  };

  const statusColor = patient.status === 'Discharged' ? 'bg-gray-100 border-gray-200' : 
                      patient.status === 'Expired' ? 'bg-red-50 border-red-200' : 'bg-white border-blue-100';

  return (
    <div 
      onClick={() => onClick(patient)}
      className={`rounded-xl shadow-sm border p-0 cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all duration-300 group flex flex-col h-full overflow-hidden ${statusColor}`}
    >
      <div className="p-4 border-b border-gray-100 bg-white/50">
          <div className="flex justify-between items-start mb-2">
            <div>
                <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-700 transition-colors leading-tight">{patient.patient_name}</h3>
                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{patient.hospital_number}</span>
            </div>
            <div className="text-right flex flex-col items-end">
                <span className="block text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wide">{patient.ward}</span>
                <span className="text-xs font-semibold text-gray-600 mt-1">Bed {patient.bed_number}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
             <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium border border-gray-200">{patient.age}y / {patient.sex}</span>
             {patient.dialysis_status === 'Yes' && <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-100">Dialysis</span>}
          </div>
      </div>

      <div className="p-4 bg-white flex-1 flex flex-col">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Active Therapy</p>
          <div className="space-y-2 flex-1">
              {activeDrugs.length > 0 ? activeDrugs.slice(0, 3).map((drug, i) => (
                  <div key={i} className="flex justify-between text-sm items-center bg-gray-50 p-1.5 rounded border border-gray-100">
                      <span className="font-semibold text-gray-700 truncate mr-2">{drug.drug_name}</span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                          Day {calculateDay(drug.start_date)}
                      </span>
                  </div>
              )) : (
                  <div className="text-xs text-gray-400 italic py-2 text-center bg-gray-50 rounded border border-dashed border-gray-200">No active antimicrobials</div>
              )}
              {activeDrugs.length > 3 && <p className="text-xs text-center text-blue-600 font-bold bg-blue-50 py-1 rounded">+ {activeDrugs.length - 3} more</p>}
          </div>
      </div>
    </div>
  );
};

export default MonitoringPatientCard;
