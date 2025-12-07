# Software Requirements Specification (SRS) (ISO 9001:2015 Clause 8.3.3)

**Project:** Osmak Antimicrobial Stewardship (AMS) System
**Version:** 1.8

---

## 1. Introduction
This document defines the requirements for the Osmak AMS System, an application designed to manage the authorization of antimicrobial prescriptions and facilitate clinical auditing within the hospital.

## 2. Functional Requirements

### 2.1 User Roles & Access
*   **Resident / Physician:**
    *   **Public Access:** Can submit new requests via the public portal.
    *   **Dashboard Access:** Can log in to view "Disapproved" requests.
    *   **Edit & Resend:** Can modify disapproval requests and resubmit them, resetting status to `PENDING`.
*   **Pharmacist:**
    *   View "Pending" requests.
    *   **Monitored Drugs:** Approve or Disapprove.
    *   **Restricted Drugs:** Forward to IDS (`FOR_IDS_APPROVAL`).
    *   **Review Findings:** Add structured findings (e.g., "Wrong Dose") to records.
    *   **Analytics:** Access to Pharmacy-specific data analysis charts.
*   **Infectious Disease Specialist (IDS):**
    *   View requests forwarded by Pharmacy.
    *   Approve or Disapprove Restricted drugs.
*   **AMS Admin / Auditor:**
    *   Full "Data Analysis" dashboard.
    *   **AMS Audit Tool:** Create, edit, and view clinical audits.

### 2.2 Clinical Decision Support (AI)
*   **Renal Guardrail:** Alert if eGFR conflicts with dosing monograph.
*   **Pediatric Guardrail:** Verify `mg/kg` dose safety based on weight.
*   **Weight-Based Check:** Adult weight-based dosing verification.

### 2.3 Workflow Logic
1.  **Submission:** Status = `PENDING`.
2.  **Pharmacy Review:**
    *   Drug = Monitored -> Approve/Disapprove.
    *   Drug = Restricted -> Forward to IDS.
3.  **IDS Review:**
    *   Approve/Disapprove.
4.  **Resubmission Loop:**
    *   If `DISAPPROVED`, Resident can Edit -> Status resets to `PENDING`.

### 2.4 Data Analysis & Reporting
*   Dashboards for AMS Admin and Pharmacists.
*   Metrics: Volume, Approval Rates, Turnaround Time, Top Drugs, Interventions.
*   Export to CSV.

### 2.5 AMS Audit Tool
*   Retrospective auditing form with Patient Demographics, eGFR auto-calc, and up to 5 antimicrobials.
*   **General Audit Note:** Editable field for high-level case summaries.

## 3. Data Integrity & Security
*   **Password Policies:** User credentials are role-based and managed by the system administrator. Unique password formats are assigned to each user group (Resident, Pharmacist, IDS, AMS).
*   **Audit Trail:** Record all actions, timestamps, and active users.
*   **Persistence:** Supabase cloud database with real-time sync.

---
**Verified By:** _________________________ (Project Lead)
**Date:** _________________________