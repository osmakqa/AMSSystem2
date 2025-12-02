# Software Requirements Specification (SRS) (ISO 9001:2015 Clause 8.3.3)

**Project:** Osmak Antimicrobial Stewardship (AMS) System
**Version:** 1.6

---

## 1. Introduction
This document defines the requirements for the Osmak AMS System, an application designed to manage the authorization of antimicrobial prescriptions within the hospital.

## 2. Functional Requirements

### 2.1 User Roles & Access
*   **Resident / Physician:**
    *   Can submit new Antimicrobial Requests via the public portal or dashboard.
    *   Must provide clinical data (Diagnosis, eGFR, Weight, Indication).
*   **Pharmacist:**
    *   View "Pending" requests.
    *   **Monitored Drugs:** Can Approve or Disapprove directly.
    *   **Restricted Drugs:** Must forward to IDS (Status: `FOR_IDS_APPROVAL`).
*   **Infectious Disease Specialist (IDS):**
    *   View requests forwarded by Pharmacy (`FOR_IDS_APPROVAL`).
    *   Can Approve or Disapprove Restricted drugs.
*   **AMS Admin:**
    *   Access to "Data Analysis" dashboard.
    *   View all records (Restricted/Monitored).

### 2.2 Clinical Decision Support (AI)
*   **Renal Guardrail:** System must trigger an alert if the patient's eGFR conflicts with the selected drug's renal dosing monograph.
*   **Pediatric Guardrail:** System must verify if the `mg/kg` dose is within safe limits for pediatric patients.
*   **Weight-Based Check:** For specific adult drugs (e.g., Vancomycin), verify dosing against weight.

### 2.3 Workflow Logic
1.  **Submission:** Status = `PENDING`.
2.  **Pharmacy Review:**
    *   If Drug = Monitored -> Action: Approve/Disapprove -> Status = `APPROVED` / `DISAPPROVED`.
    *   If Drug = Restricted -> Action: Forward -> Status = `FOR_IDS_APPROVAL`.
3.  **IDS Review:**
    *   Action: Approve/Disapprove -> Status = `APPROVED` / `DISAPPROVED`.

### 2.4 Data Analysis & Reporting
*   Dashboard must display:
    *   Total requests and Approval Rates.
    *   Top 5 Antimicrobials requested.
    *   Average Turnaround Time for IDS reviews.
    *   Pie charts for decision outcomes.
*   Export capability to CSV for reporting.

## 3. Data Integrity & Security
*   **Password Protection:** Critical actions (Approve/Disapprove/Delete) require password confirmation (`osmak123`).
*   **Audit Trail:** System must record `requested_by`, `dispensed_by`, `ids_specialist`, and timestamps for all actions.

---
**Verified By:** _________________________ (Project Lead)
**Date:** _________________________