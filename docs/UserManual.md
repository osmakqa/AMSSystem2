# Osmak AMS System - User Manual

## **1. System Overview**
The **Osmak Antimicrobial Stewardship (AMS) System** is a digital platform designed to streamline the request, review, and approval process for antimicrobial prescriptions. It ensures patient safety through AI-powered guardrails and enforces hospital policy regarding Restricted and Monitored drugs.

---

## **2. Getting Started**

### **Login Credentials**
Log in using the credentials provided by the AMS Committee or IT Department. Passwords are case-sensitive. If you have forgotten your password, please contact the system administrator.

---

## **3. Guide for Residents & Physicians**

### **Option A: Submit Request (No Login)**
1.  Go to the Login Page.
2.  Click the large button: **"Submit New Antimicrobial Request"**.
3.  **Step 1: Patient Info**: Enter Name, ID, Age, Weight. *Note: For Pediatrics, Height is required for eGFR.*
4.  **Step 2: Clinical Data**: Enter Diagnosis, Indication, and Lab results (SCr).
    *   *AI Feature:* Watch for **Renal Dosing Alerts** if eGFR is low.
5.  **Step 3: Medication**: Select the Antimicrobial.
    *   **Monitored Drugs**: Reviewed by Pharmacy.
    *   **Restricted Drugs**: Require an ID Specialist name.
6.  **Step 4: Micro & History**: Enter previous antibiotics and isolated organisms.
7.  **Submit**: Click "Submit Request".

### **Option B: Resident Dashboard (Login)**
1.  Select the **"Resident"** tab on the login screen.
2.  Enter your assigned password.
3.  **Disapproved Requests**: Your dashboard displays requests that were rejected by Pharmacy or IDS.
4.  **Edit & Resend**:
    *   Click on a disapproved card to see the reason.
    *   Click the **"Edit"** button.
    *   The form opens with your previous data. Correct the errors (e.g., adjust dose, change drug).
    *   Click **"Update & Resend"**. The request will be re-queued as **PENDING**.

---

## **4. Guide for Pharmacists**

### **Reviewing Requests**
1.  Log in as a **Pharmacist**.
2.  The **"Pending"** tab shows all new requests.
3.  Click a card to view details (Monograph, Labs, History).

### **Taking Action**
*   **For Monitored Drugs:** Approve or Disapprove.
*   **For Restricted Drugs:** Click **"For IDS Approval"** to forward to IDS.
*   **Pediatric Safety:** The system automatically verifies `mg/kg` dosing.
*   **Review Findings:** Click specific sections (e.g., Medication) to add structured notes like "Wrong Dose" or "Wrong Duration".

### **Data Analysis**
*   Click the **"Data Analysis"** tab to view your performance metrics, top drugs processed, and intervention statistics.

---

## **5. Guide for ID Specialists (IDS)**

1.  Log in as **IDS**.
2.  Your **"Pending"** tab contains only Restricted drugs forwarded by Pharmacy.
3.  Review the clinical details.
4.  Click **Approve** or **Disapprove** to finalize.

---

## **6. Guide for AMS Admins**

### **Data Analysis**
*   Log in as **AMS**.
*   **Filters:** Use Month/Year dropdowns.
*   **Charts:** View Volume, Top Drugs, Pharmacy Performance, and IDS Turnaround Times.
*   **Export:** Click on any chart title to export data to CSV.

### **AMS Audit Tool**
1.  Click **"AMS Audit"** tab.
2.  **New Audit:** Fill Context, Patient Info, Dosing, Codes.
3.  **AI Guardrails:** Auto-checks Renal and Weight-based dosing.
4.  **Review & Submit:** Confirm audit details.
5.  **Manage Logs:** Review audits and update the "General Audit Note" for case summaries.

---

## **7. Troubleshooting**
*   **"Database Error"**: Contact IT support.
*   **"Loading..." hangs**: Refresh the page or check internet connection.