# Design and Development Change Log (ISO 9001:2015 Clause 8.3.6)

**Project:** Osmak Antimicrobial Stewardship (AMS) System

---

| Version | Date | Description of Change | Reason for Change | Review/Auth By |
| :--- | :--- | :--- | :--- | :--- |
| **v1.0** | [Date] | **Initial Release** | Replacement of paper-based antimicrobial request forms. Basic CRUD functionality. | AMS Committee Head |
| **v1.1** | [Date] | **Role-Based Access Control (RBAC)** | Implementation of distinct views and permissions for Pharmacists, IDS, and AMS Admins. | IT Head |
| **v1.2** | [Date] | **Supabase Integration** | Transition to cloud database for real-time data persistence and multi-user access. | IT Head |
| **v1.3** | [Date] | **Restricted vs. Monitored Logic** | Implemented workflow branching: Restricted drugs must be forwarded to IDS; Monitored drugs approved by Pharmacy. | AMS Committee Head |
| **v1.4** | [Date] | **AI Clinical Guardrails** | Integration of Gemini API for Real-time Renal Dosing checks and Pediatric Dosing verification. | QA Head / AMS Head |
| **v1.5** | [Date] | **Analytics Dashboard** | Added "Data Analysis" tab for AMS Admins with utilization charts, IDS turnaround times, and export features. | AMS Committee Head |
| **v1.6** | [Date] | **Public Request Portal** | Added "Submit New Request" button on login page for Residents to submit without full account access. | IT Head |

---
*This log controls changes made during or subsequent to the design and development of products and services.*