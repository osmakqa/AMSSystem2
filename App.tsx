
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import PrescriptionCard from './components/PrescriptionCard';
import PrescriptionTable from './components/PrescriptionTable';
import StatsChart from './components/StatsChart';
import PasswordModal from './components/PasswordModal';
import NewRequestModal from './components/NewRequestModal';
import DetailModal from './components/DetailModal';
import DisapproveModal from './components/DisapproveModal';
import ChartDetailModal from './components/ChartDetailModal';
import WorkflowModal from './components/WorkflowModal'; 
import AntimicrobialRequestForm from './components/AntimicrobialRequestForm'; 
import AMSAuditForm from './components/AMSAuditForm'; 
import AMSAuditTable from './components/AMSAuditTable'; 
import AMSAuditDetailModal from './components/AMSAuditDetailModal'; 
import { User, UserRole, Prescription, PrescriptionStatus, ActionType, DrugType, AMSAudit } from './types';
import { 
  fetchPrescriptions, 
  updatePrescriptionStatus, 
  createPrescription,
  fetchAudits 
} from './services/dataService';
import { supabase } from './services/supabaseClient';

// ... (FilterControls and tabsConfig remain same)
const FilterControls = ({ selectedMonth, onMonthChange, selectedYear, onYearChange }: any) => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">Month:</label>
        <select 
          value={selectedMonth} 
          onChange={(e) => onMonthChange(parseInt(e.target.value))} 
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-green-200 focus:border-green-500 outline-none shadow-sm transition-colors hover:border-gray-400"
        >
          <option value={-1}>All Months</option>
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">Year:</label>
        <select 
          value={selectedYear} 
          onChange={(e) => onYearChange(parseInt(e.target.value))} 
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-green-200 focus:border-green-500 outline-none shadow-sm transition-colors hover:border-gray-400"
        >
          <option value={0}>All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

const tabsConfig: Record<UserRole, string[]> = {
  [UserRole.PHARMACIST]: ['Pending', 'Approved', 'Disapproved', 'For IDS Approval'],
  [UserRole.IDS]: ['Pending', 'Approved Restricted', 'Disapproved Restricted'],
  [UserRole.AMS_ADMIN]: ['Data Analysis', 'Restricted', 'Monitored', 'All', 'AMS Audit'],
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Prescription[]>([]);
  const [auditData, setAuditData] = useState<AMSAudit[]>([]); 
  const [activeTab, setActiveTab] = useState('Pending');
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Action state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isDisapproveModalOpen, setIsDisapproveModalOpen] = useState(false);
  const [selectedItemForView, setSelectedItemForView] = useState<Prescription | null>(null);
  const [pendingAction, setPendingAction] = useState<{id: number, type: ActionType} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isAntimicrobialRequestFormOpen, setIsAntimicrobialRequestFormOpen] = useState(false); 
  
  // Audit States
  const [isAMSAuditFormOpen, setIsAMSAuditFormOpen] = useState(false);
  const [selectedAuditToEdit, setSelectedAuditToEdit] = useState<AMSAudit | null>(null);
  const [selectedAuditForView, setSelectedAuditForView] = useState<AMSAudit | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user) {
      loadData();
      
      const channel = supabase
        .channel('requests_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'requests' },
          (payload) => {
            console.log('Change received', payload);
            loadData();
          }
        )
        .subscribe();
      
      let auditChannel: any;
      if (user.role === UserRole.AMS_ADMIN) {
          auditChannel = supabase
            .channel('audits_changes')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'audits' },
              () => loadAudits()
            )
            .subscribe();
      }

      return () => {
        supabase.removeChannel(channel);
        if (auditChannel) supabase.removeChannel(auditChannel);
      };
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    const { data: result, error } = await fetchPrescriptions();
    if (error) {
      setDbError(error);
      setData([]);
    } else {
      setData(result.filter(item => item.status !== PrescriptionStatus.DELETED));
    }
    setLoading(false);
  };

  const loadAudits = async () => {
    const { data: result, error } = await fetchAudits();
    if (error) {
       console.error("Failed to load audits:", error);
    } else {
       setAuditData(result);
    }
  };

  useEffect(() => {
    if (activeTab === 'AMS Audit' && user?.role === UserRole.AMS_ADMIN) {
        loadAudits();
    }
  }, [activeTab, user]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === UserRole.IDS || loggedInUser.role === UserRole.PHARMACIST) {
      setActiveTab('Pending');
    } else {
      setActiveTab('Data Analysis');
      loadAudits();
    }
  };

  const handleLogout = () => {
    setUser(null);
    setData([]);
    setAuditData([]);
    setDbError(null);
  };

  const handleViewDetails = (item: Prescription) => {
    setSelectedItemForView(item);
  };

  const handleActionClick = (id: number, type: ActionType, payload?: any) => {
    // If payload contains findings, it comes from DetailModal and we execute immediately
    // Handle Save Findings explicitly too
    if (payload?.findings && (type === ActionType.DISAPPROVE || type === ActionType.APPROVE || type === ActionType.SAVE_FINDINGS)) {
        executeAction(id, type, { findings: payload.findings });
        return;
    }

    switch (type) {
      case ActionType.APPROVE:
      case ActionType.REVERSE_TO_APPROVE:
        executeAction(id, type);
        break;
      
      case ActionType.DISAPPROVE:
      case ActionType.REVERSE_TO_DISAPPROVE:
        // Fallback to simple modal if action triggered from Table/Card without review details
        setPendingAction({ id, type });
        setIsDisapproveModalOpen(true);
        break;

      case ActionType.DELETE:
      case ActionType.FORWARD_IDS:
        setPendingAction({ id, type });
        setIsPasswordModalOpen(true);
        break;
    }
  };

  const handleConfirmPassword = () => {
    setIsPasswordModalOpen(false);
    if (!pendingAction) return;
    executeAction(pendingAction.id, pendingAction.type);
    setPendingAction(null);
  };

  const handleDisapproveSubmit = async (reason: string, details: string) => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    const fullReason = reason === 'Others' && details ? `${reason}: ${details}` : reason;
    await executeAction(pendingAction.id, pendingAction.type, { disapprovedReason: fullReason });
    setIsDisapproveModalOpen(false);
    setPendingAction(null);
    setIsSubmitting(false);
  };

  const executeAction = async (id: number, type: ActionType, extraData?: any) => {
    try {
      if (!user) return;
      
      const updates: { [key: string]: any } = {};
      let statusToUpdate: PrescriptionStatus | null = null;
      
      if (type !== ActionType.FORWARD_IDS && type !== ActionType.DELETE && type !== ActionType.SAVE_FINDINGS) {
        if (user.role === UserRole.PHARMACIST) {
          updates.dispensed_by = user.name;
        } else if (user.role === UserRole.IDS) {
          updates.id_specialist = user.name;
        }
      }
      
      if (extraData?.disapprovedReason) {
        updates.disapproved_reason = extraData.disapprovedReason;
      }
      if (extraData?.findings) {
        updates.findings = extraData.findings;
        // Also copy consolidated text to disapproved_reason for backward compatibility if needed
        if (type === ActionType.DISAPPROVE && !updates.disapproved_reason) {
            updates.disapproved_reason = "See Review Findings";
        }
      }
      
      switch (type) {
        case ActionType.APPROVE:
        case ActionType.REVERSE_TO_APPROVE:
          statusToUpdate = PrescriptionStatus.APPROVED;
          if (user.role === UserRole.IDS) {
            updates.ids_approved_at = new Date().toISOString();
          } else { 
            updates.dispensed_date = new Date().toISOString();
          }
          break;
        case ActionType.DISAPPROVE:
        case ActionType.REVERSE_TO_DISAPPROVE:
          statusToUpdate = PrescriptionStatus.DISAPPROVED;
          if (user.role === UserRole.IDS) {
            updates.ids_disapproved_at = new Date().toISOString();
          } else { 
            updates.dispensed_date = new Date().toISOString();
          }
          break;
        case ActionType.FORWARD_IDS:
          statusToUpdate = PrescriptionStatus.FOR_IDS_APPROVAL;
          updates.dispensed_by = user.name; 
          updates.dispensed_date = new Date().toISOString();
          break;
        case ActionType.DELETE:
          statusToUpdate = PrescriptionStatus.DELETED;
          break;
        case ActionType.SAVE_FINDINGS:
          // No status change, just update findings
          break;
      }

      const shouldUpdate = statusToUpdate !== null || Object.keys(updates).length > 0;

      if (shouldUpdate) {
        await updatePrescriptionStatus(id, statusToUpdate, updates);
      }
      
      loadData();
    } catch (err: any) {
      const errorMessage = err.message || JSON.stringify(err);
      console.error("Action failed:", errorMessage);
      alert(`Error: Action could not be completed. Details: ${errorMessage}`);
      loadData();
    }
  };

  const handleNewRequestSubmit = async (formData: any) => {
    if (!user) return; 
    setIsSubmitting(true);
    try {
      await createPrescription({ ...formData, status: PrescriptionStatus.PENDING, requested_by: user.name });
      setIsNewRequestModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Failed to create request", err);
      alert("Failed to create request. Please check RLS policies in Supabase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmissionFromLogin = async (formData: any) => {
    setIsSubmitting(true);
    try {
      await createPrescription({ ...formData }); 
      setIsAntimicrobialRequestFormOpen(false);
      alert("Antimicrobial Request submitted successfully!");
    } catch (err) {
      console.error("Failed to create request from login form", err);
      alert("Failed to create request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusMatches = (itemStatus: string, targetStatus: PrescriptionStatus) => {
    return itemStatus?.toLowerCase().trim() === targetStatus.toLowerCase();
  };

  const getFilteredDataForCurrentView = () => {
    // ... (Filter logic remains identical)
    const isIdsUnfilteredView = user?.role === UserRole.IDS && (activeTab === 'Approved Restricted' || activeTab === 'Disapproved Restricted');
    const isPendingView = activeTab === 'Pending';
    const isAmsAdminView = user?.role === UserRole.AMS_ADMIN;
    
    let items = data;

    if (!isPendingView && !isIdsUnfilteredView && !(isAmsAdminView && (activeTab === 'Data Analysis' || activeTab === 'AMS Audit'))) {
      items = items.filter(item => {
        const itemDate = item.req_date ? new Date(item.req_date) : new Date(item.created_at || Date.now());
        const monthMatch = selectedMonth === -1 || itemDate.getMonth() === selectedMonth;
        const yearMatch = selectedYear === 0 || itemDate.getFullYear() === selectedYear;
        return monthMatch && yearMatch;
      });
    }

    if (user?.role === UserRole.PHARMACIST) {
      switch (activeTab) {
        case 'Pending': return items.filter(i => statusMatches(i.status, PrescriptionStatus.PENDING));
        case 'Approved': return items.filter(i => statusMatches(i.status, PrescriptionStatus.APPROVED) && i.drug_type === DrugType.MONITORED);
        case 'Disapproved': return items.filter(i => statusMatches(i.status, PrescriptionStatus.DISAPPROVED) && i.drug_type === DrugType.MONITORED);
        case 'For IDS Approval': return items.filter(i => statusMatches(i.status, PrescriptionStatus.FOR_IDS_APPROVAL));
      }
    }
    
    if (user?.role === UserRole.IDS) {
      switch (activeTab) {
        case 'Pending': return items.filter(i => statusMatches(i.status, PrescriptionStatus.FOR_IDS_APPROVAL));
        case 'Approved Restricted': return items.filter(i => statusMatches(i.status, PrescriptionStatus.APPROVED) && i.drug_type === DrugType.RESTRICTED);
        case 'Disapproved Restricted': return items.filter(i => statusMatches(i.status, PrescriptionStatus.DISAPPROVED) && i.drug_type === DrugType.RESTRICTED);
      }
    }
    
    if (user?.role === UserRole.AMS_ADMIN) {
      switch (activeTab) {
        case 'Data Analysis': return data; 
        case 'Restricted': return items.filter(i => i.drug_type === DrugType.RESTRICTED);
        case 'Monitored': return items.filter(i => i.drug_type === DrugType.MONITORED);
        case 'All': return items;
        case 'AMS Audit': return []; 
      }
    }

    return items;
  };
  
  const FilterHeader = () => {
    // ... (Same logic)
    const showFilters = user?.role !== UserRole.AMS_ADMIN || (activeTab !== 'Data Analysis' && activeTab !== 'AMS Audit');

    if (!showFilters || activeTab === 'Pending' || 
        (user?.role === UserRole.IDS && (activeTab === 'Approved Restricted' || activeTab === 'Disapproved Restricted'))) {
      return null;
    }

    return (
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filter by Date
        </h3>
        <FilterControls 
          selectedMonth={selectedMonth} 
          onMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />
      </div>
    );
  };

  const renderContent = () => {
    if (dbError) {
      // ... (Error handling)
      const isColumnMissing = dbError.includes('column') && dbError.includes('does not exist');
      return (
        <div className="p-12 bg-white rounded-lg shadow-md border-l-4 border-red-500 my-8">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Database Error</h3>
          <p className="bg-red-50 p-4 rounded border border-red-100 font-mono text-sm break-words">{dbError}</p>
          {isColumnMissing && (
              <div className="bg-gray-800 p-4 rounded text-xs font-mono w-full max-w-2xl overflow-x-auto mt-6">
                  <p className="text-green-400 mb-2 font-sans font-bold uppercase tracking-wide">SQL to Fix Missing Columns:</p>
                  <pre className="text-gray-300 whitespace-pre-wrap">
{`-- Run these in your Supabase SQL Editor:
alter table requests add column if not exists dispensed_by text;
alter table requests add column if not exists dispensed_date timestamp with time zone;
alter table requests add column if not exists ids_approved_at timestamp with time zone;
alter table requests add column if not exists ids_disapproved_at timestamp with time zone;
alter table requests add column if not exists disapproved_reason text;
alter table requests add column if not exists mode text;
alter table requests add column if not exists findings jsonb default '[]'::jsonb;`}
                  </pre>
              </div>
          )}
           <p className="text-center text-gray-600 mt-6">If you've added columns, try <button onClick={() => loadData()} className="text-blue-600 hover:underline">reloading data</button>.</p>
        </div>
      );
    }

    if (activeTab === 'AMS Audit' && user?.role === UserRole.AMS_ADMIN) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">AMS Audit Logs</h2>
                    <button 
                        onClick={() => {
                            setSelectedAuditToEdit(null); 
                            setIsAMSAuditFormOpen(true);
                        }} 
                        className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 font-medium text-sm flex items-center gap-2"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                         New Audit
                    </button>
                </div>
                <AMSAuditTable 
                    items={auditData} 
                    onView={(audit) => setSelectedAuditForView(audit)}
                    onEdit={(audit) => {
                        setSelectedAuditToEdit(audit);
                        setIsAMSAuditFormOpen(true);
                    }}
                />
            </div>
        );
    }

    const viewData = getFilteredDataForCurrentView();

    if (viewData.length === 0 && !loading && activeTab !== 'Pending' && !(user?.role === UserRole.AMS_ADMIN && activeTab === 'Data Analysis')) {
      return (
        <div className="text-center p-12 bg-white rounded-lg shadow-sm border">
          <h3 className="text-lg font-bold text-gray-800">No Records Found for this View</h3>
          <p className="text-gray-500 mt-2">Try adjusting the filters or check if data exists for this category.</p>
        </div>
      );
    }
    
    if (loading) return <div className="text-center p-20 text-gray-500">Loading records...</div>;

    switch(activeTab) {
      case 'Pending':
        return (
          <div>
             <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Pending Requests ({viewData.length})</h2>
              {user?.role === UserRole.PHARMACIST && <button onClick={() => setIsNewRequestModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow text-sm font-medium">New Request</button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {viewData.length === 0 ? <p className="col-span-full text-center py-10 bg-white rounded-lg">No items requiring review.</p> : viewData.map(item => (
                <PrescriptionCard key={item.id} item={item} role={user!.role} onAction={handleActionClick} onView={handleViewDetails} />
              ))}
            </div>
          </div>
        );
      
      case 'Approved':
      case 'Approved Restricted':
        return <PrescriptionTable items={viewData} onAction={handleActionClick} onView={handleViewDetails} statusType={PrescriptionStatus.APPROVED} />;

      case 'Disapproved':
      case 'Disapproved Restricted':
        return <PrescriptionTable items={viewData} onAction={handleActionClick} onView={handleViewDetails} statusType={PrescriptionStatus.DISAPPROVED} />;
      
      case 'For IDS Approval':
        return <PrescriptionTable items={viewData} onAction={handleActionClick} onView={handleViewDetails} statusType={PrescriptionStatus.FOR_IDS_APPROVAL} />;

      case 'Data Analysis':
        return <StatsChart 
                  data={data} 
                  allData={data} 
                  role={user?.role}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear} 
                />;
      
      case 'Restricted':
      case 'Monitored':
      case 'All':
         return (
           <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold text-gray-700">{activeTab} Requests</h3>
               <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{viewData.length} records</span>
             </div>
             <PrescriptionTable items={viewData} onAction={handleActionClick} onView={handleViewDetails} statusType={'ALL_VIEW'} />
           </div>
         );

      default:
        return null;
    }
  };
  
  const currentTabs = user ? tabsConfig[user.role] : tabsConfig[UserRole.PHARMACIST]; 

  return (
    <>
      <WorkflowModal isOpen={isWorkflowModalOpen} onClose={() => setIsWorkflowModalOpen(false)} />
      <AntimicrobialRequestForm 
        isOpen={isAntimicrobialRequestFormOpen}
        onClose={() => setIsAntimicrobialRequestFormOpen(false)}
        onSubmit={handleFormSubmissionFromLogin}
        loading={isSubmitting}
      />
      
      {/* Audit Form */}
      <AMSAuditForm 
        isOpen={isAMSAuditFormOpen}
        initialData={selectedAuditToEdit}
        onClose={() => {
            setIsAMSAuditFormOpen(false);
            setSelectedAuditToEdit(null); 
            if (user?.role === UserRole.AMS_ADMIN) loadAudits();
        }}
      />

      {/* Audit Detail Modal */}
      <AMSAuditDetailModal
        isOpen={!!selectedAuditForView}
        onClose={() => setSelectedAuditForView(null)}
        audit={selectedAuditForView}
        onEdit={(audit) => {
            setSelectedAuditToEdit(audit);
            setIsAMSAuditFormOpen(true);
        }}
        onSave={loadAudits} 
      />

      {!user ? (
        <Login 
          onLogin={handleLogin} 
          onOpenWorkflow={() => setIsWorkflowModalOpen(true)} 
          onOpenAntimicrobialRequestForm={() => setIsAntimicrobialRequestFormOpen(true)}
          onOpenAuditForm={() => {
              setSelectedAuditToEdit(null);
              setIsAMSAuditFormOpen(true);
          }}
        />
      ) : (
        <Layout user={user} onLogout={handleLogout}>
          <PasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} onConfirm={handleConfirmPassword} />
          <NewRequestModal isOpen={isNewRequestModalOpen} onClose={() => setIsNewRequestModalOpen(false)} onSubmit={handleNewRequestSubmit} loading={isSubmitting} />
          <DisapproveModal isOpen={isDisapproveModalOpen} onClose={() => setIsDisapproveModalOpen(false)} onSubmit={handleDisapproveSubmit} loading={isSubmitting} />
          <DetailModal isOpen={!!selectedItemForView} onClose={() => setSelectedItemForView(null)} item={selectedItemForView} role={user.role} onAction={handleActionClick} />
          
          <div className="mb-6 border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-8">
              {currentTabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>
              ))}
            </nav>
          </div>
          
          {FilterHeader()}
          {renderContent()}
        </Layout>
      )}
    </>
  );
}

export default App;
