import React, { useState, useMemo } from 'react';
import { Prescription, PrescriptionStatus, ActionType } from '../types';

interface PrescriptionTableProps {
  items: Prescription[];
  onAction: (id: number, action: ActionType) => void;
  onView: (item: Prescription) => void;
  statusType: PrescriptionStatus | 'ALL_VIEW'; // Added 'ALL_VIEW' for Admin All tab
}

const PrescriptionTable: React.FC<PrescriptionTableProps> = ({ items, onAction, onView, statusType }) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof Prescription | 'req_date', direction: 'asc' | 'desc' }>({ key: 'req_date', direction: 'desc' });

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: keyof Prescription) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Prescription) => {
    if (sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="text-green-600 ml-1">↑</span> : <span className="text-green-600 ml-1">↓</span>;
  };

  if (items.length === 0) return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">No records found.</div>;
  
  const formatStatus = (status: string) => {
    if (!status) return 'N/A';
    if (status === 'for_ids_approval') return 'For IDS Approval';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status: string) => {
      const s = status.toLowerCase();
      if (s === 'approved') return 'text-green-800 bg-green-100';
      if (s === 'disapproved') return 'text-red-800 bg-red-100';
      if (s === 'for_ids_approval') return 'text-yellow-800 bg-yellow-100';
      return 'text-gray-800 bg-gray-100';
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 flex flex-col">
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 relative">
          <thead className="bg-green-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer select-none hover:bg-green-100" onClick={() => requestSort('req_date')}>Req Date {getSortIcon('req_date')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer select-none hover:bg-green-100" onClick={() => requestSort('patient_name')}>Patient {getSortIcon('patient_name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer select-none hover:bg-green-100" onClick={() => requestSort('antimicrobial')}>Antimicrobial {getSortIcon('antimicrobial')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer select-none hover:bg-green-100" onClick={() => requestSort('status')}>Status {getSortIcon('status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider cursor-pointer select-none hover:bg-green-100" onClick={() => requestSort('requested_by')}>Requester {getSortIcon('requested_by')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Dispensed By</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-green-800 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => onView(item)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.req_date ? new Date(item.req_date).toLocaleDateString() : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{item.patient_name}</div><div className="text-xs text-gray-500">{item.hospital_number}</div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{item.antimicrobial}</div><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.drug_type === 'Restricted' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{item.drug_type}</span></td>
                <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(item.status)}`}>{formatStatus(item.status)}</span></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.requested_by}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.dispensed_by || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2 items-center">
                    {/* Allow status reversal ONLY if specific status view, NOT in All/Monitored/Restricted summary views to prevent accidents */}
                    {statusType === PrescriptionStatus.APPROVED && (<button onClick={() => onAction(item.id, ActionType.REVERSE_TO_DISAPPROVE)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 rounded text-xs transition-colors">Disapprove</button>)}
                    {statusType === PrescriptionStatus.DISAPPROVED && (<button onClick={() => onAction(item.id, ActionType.REVERSE_TO_APPROVE)} className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1 rounded text-xs transition-colors">Approve</button>)}
                    {(statusType === PrescriptionStatus.FOR_IDS_APPROVAL) && (<button onClick={() => onAction(item.id, ActionType.REVERSE_TO_DISAPPROVE)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 rounded text-xs transition-colors">Disapprove</button>)}
                    
                    {/* View Only Actions for Admin Lists */}
                    {statusType === 'ALL_VIEW' && (
                       <button className="text-gray-400 cursor-not-allowed" disabled>View Only</button>
                    )}

                    <button onClick={() => onAction(item.id, ActionType.DELETE)} className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-gray-100 rounded-full transition-colors" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PrescriptionTable;