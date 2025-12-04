# Software Requirements Specification (SRS) (ISO 9001:2015 Clause 8.3.3)

**Project:** Osmak Antimicrobial Stewardship (AMS) System
**Version:** 1.7

---

## 1. Introduction
This document defines the requirements for the Osmak AMS System, an application designed to manage the authorization of antimicrobial prescriptions and facilitate clinical auditing within the hospital.

## 2. Functional Requirements

### 2.1 User Roles & Access
*   **Resident / Physician:**
    *   Can submit new Antimicrobial Requests via the public portal or dashboard.
    *   Must provide clinical data (Diagnosis, eGFR, Weight, Indication).
*   **Pharmacist:**
    *   View "Pending" requests.
    *   **Monitored Drugs:** Can Approve or Disapprove directly.
    *   **Restricted Drugs:** Must forward to IDS (Status: `FOR_IDS_APPROVAL`).
    *   **Review Findings:** Can select specific sections (e.g., Dosing, Indication) to add structured findings (e.g., "Wrong Dose", "Wrong Duration") saved to the record.
*   **Infectious Disease Specialist (IDS):**
    *   View requests forwarded by Pharmacy (`FOR_IDS_APPROVAL`).
    *   Can Approve or Disapprove Restricted drugs.
*   **AMS Admin / Auditor:**
    *   Access to "Data Analysis" dashboard.
    *   **AMS Audit Tool:** Can create, edit, and view detailed clinical audits of patient cases.
    *   View all records (Restricted/Monitored).

### 2.2 Clinical Decision Support (AI)
*   **Renal Guardrail:** System must trigger an alert if the patient's eGFR conflicts with the selected drug's renal dosing monograph.
*   **Pediatric Guardrail:** System must verify if the `mg/kg` dose is within safe limits for pediatric patients based on weight.
*   **Weight-Based Check:** For specific adult drugs (e.g., Vancomycin, Aminoglycosides), verify dosing against weight.
*   *Note:* AI Guardrails must be active in both the **Request Form** and the **AMS Audit Form**.

### 2.3 Workflow Logic
1.  **Submission:** Status = `PENDING`.
2.  **Pharmacy Review:**
    *   Reviewer uses "Split-View" to validate clinical data against guidelines.
    *   If findings exist, they are saved as structured data (Category + Details).
    *   If Drug = Monitored -> Action: Approve/Disapprove -> Status = `APPROVED` / `DISAPPROVED`.
    *   If Drug = Restricted -> Action: Forward -> Status = `FOR_IDS_APPROVAL`.
3.  **IDS Review:**
    *   Action: Approve/Disapprove -> Status = `APPROVED` / `DISAPPROVED`.

### 2.4 Data Analysis & Reporting
*   Dashboard must display:
    *   Total requests and Approval Rates.
    *   Top 5 Antimicrobials requested.
    *   Average Turnaround Time for IDS reviews.
    *   Pie charts for decision outcomes and Intervention Types (Findings).
*   Export capability to CSV for reporting.

### 2.5 AMS Audit Tool
*   **Audit Form:**
    *   Capture Auditor, Area, Shift, and extensive Patient Demographics (Height, Weight, Sex, SCr).
    *   Auto-calculate eGFR based on CKD-EPI (Adult) or CKiD (Pediatric) formulas.
    *   Log up to 5 antimicrobials per patient with detailed indication/diagnosis coding (HAI/CAI/SP/MP).
*   **Microbiology:**
    *   Dynamic entry of organisms and resistance patterns (e.g., MRSA, ESBL).
*   **Audit Notes:**
    *   **General Audit Note:** A specific field for auditors to add a high-level summary or clinical opinion on the case.
    *   This note is editable within the "Review" modal for continuous updating.

## 3. Data Integrity & Security
*   **Password Protection:** Critical actions (Approve/Disapprove/Delete) require password confirmation (`osmak123`).
*   **Audit Trail:** System must record `requested_by`, `dispensed_by`, `ids_specialist`, `findings`, and timestamps for all actions.
*   **Persistence:** All requests and audits are stored in a cloud database (Supabase) with real-time synchronization.

---
**Verified By:** _________________________ (Project Lead)
**Date:** _________________________