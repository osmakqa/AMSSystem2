# Verification Record - Test Scripts (ISO 9001:2015 Clause 8.3.4)

**Project:** Osmak Antimicrobial Stewardship (AMS) System
**Test Date:** [Insert Date]
**Tester:** [Insert Name]

---

| Test ID | Feature Tested | Description / Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-001** | **New Request (Resident)** | Click "Submit New Request". Fill form (Adult, Meropenem, eGFR=90). Click Submit. | System alerts "Submitted successfully". Entry appears in DB. | |
| **TC-002** | **Renal AI Alert** | Create Request. Select "Meropenem". Enter SCr = 4.0 (Low eGFR). | Yellow Warning Banner appears: "Renal Dosing Alert". | |
| **TC-003** | **Pediatric Guardrail** | Select "Pediatric". Wt=10kg. Drug=Vancomycin. Dose=500mg (High). | Yellow Warning Banner appears: "Dosing Caution". | |
| **TC-004** | **Pharmacist - Monitored** | Login as Pharmacist. Find Pending "Ceftriaxone" (Monitored). Click Approve. | Status changes to `APPROVED`. Moved to Approved tab. | |
| **TC-005** | **Pharmacist - Restricted** | Login as Pharmacist. Find Pending "Meropenem" (Restricted). Click "For IDS Approval". | Status changes to `FOR_IDS_APPROVAL`. Removed from Pending tab. | |
| **TC-006** | **IDS Workflow** | Login as IDS. Find the forwarded "Meropenem". Click Approve. | Status changes to `APPROVED`. | |
| **TC-007** | **Disapproval Logic** | Click Disapprove. Select Reason "Wrong Dose". Enter remarks. Confirm. | Status changes to `DISAPPROVED`. Reason saved in details. | |
| **TC-008** | **Admin Dashboard** | Login as AMS Admin. Click "Data Analysis". Filter by Month. | Charts update. KPI cards show correct counts. | |
| **TC-009** | **CSV Export** | Open "All Requests" modal. Click "Export to CSV". | Browser downloads `.csv` file with correct columns. | |

---
**Overall Test Result:**
[ ] Passed
[ ] Failed

**Tester Signature:** _________________________
**Date:** _________________________