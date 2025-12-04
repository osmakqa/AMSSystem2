# Osmak AMS System - User Manual

## **1. System Overview**
The **Osmak Antimicrobial Stewardship (AMS) System** is a digital platform designed to streamline the request, review, and approval process for antimicrobial prescriptions. It ensures patient safety through AI-powered guardrails and enforces hospital policy regarding Restricted and Monitored drugs.

---

## **2. Getting Started**

### **Login Credentials**
*   **System Password (for actions):** `osmak123`
*   **Pharmacist / IDS Login:** Select your name from the dropdown and use the password above.
*   **AMS Admin Login:** Select the "AMS" tab and use the password above.

---

## **3. Guide for Residents & Physicians**

### **Submitting a New Request**
1.  Go to the Login Page.
2.  Click the large button: **"Submit New Antimicrobial Request"**.
3.  **Step 1: Patient Info**: Enter Name, ID, Age, Weight. *Note: For Pediatrics, Height is required for eGFR.*
4.  **Step 2: Clinical Data**: Enter Diagnosis, Indication, and Lab results (SCr).
    *   *AI Feature:* As you enter SCr/eGFR, watch for **Renal Dosing Alerts** if the patient has kidney impairment.
5.  **Step 3: Medication**: Select the Antimicrobial.
    *   **Monitored Drugs** (Blue): Reviewed by Pharmacy.
    *   **Restricted Drugs** (Red): Require an ID Specialist and Service Resident name.
6.  **Step 4: Micro & History**: Enter previous antibiotics and isolated organisms.
7.  **Submit**: Click "Submit Request".

---

## **4. Guide for Pharmacists**

### **Reviewing Requests**
1.  Log in as a **Pharmacist**.
2.  The **"Pending"** tab shows all new requests.
3.  Click a card to view details (Monograph, Labs, History).

### **Taking Action**
*   **For Monitored Drugs:**
    *   Click **Approve** if appropriate.
    *   Click **Disapprove** if incorrect (select reason).
*   **For Restricted Drugs:**
    *   You cannot Approve these directly.
    *   Click **"For IDS Approval"** to forward the request to the Infectious Disease Specialist.
*   **Pediatric Safety:** The system will automatically verify the `mg/kg` dose. Look for the Green (Safe) or Yellow (Alert) banner in the details modal.
*   **Review Findings:** You can click on specific sections (e.g. Clinical Data, Medication) to add structured findings (e.g. "Wrong Dose", "Wrong Duration"). These are saved with the record.

---

## **5. Guide for ID Specialists (IDS)**

1.  Log in as **IDS**.
2.  Your **"Pending"** tab contains only Restricted drugs forwarded by Pharmacy.
3.  Review the clinical details.
4.  Click **Approve** or **Disapprove**. This finalizes the request.

---

## **6. Guide for AMS Admins**

### **Data Analysis**
*   Log in as **AMS**.
*   The default view is **"Data Analysis"**.
*   **Filters:** Use the Month/Year dropdowns (or select "All") to filter the dataset.
*   **Charts:**
    *   **General:** Overall volume and top drugs.
    *   **Restricted/Monitored:** Specific drill-downs.
    *   **Pharmacy/IDS:** Performance metrics and turnaround times.
*   **Export:** Click on any chart title or KPI card to open the data list, then click **"Export to CSV"**.

### **AMS Audit Tool**
The Audit Tool allows for retrospective auditing of patient charts for AMS compliance.

1.  **Access:** Click the **"AMS Audit"** tab.
2.  **New Audit:** Click **"New Audit"** to open the form.
    *   **Context:** Enter Auditor, Ward, Shift.
    *   **Patient:** Enter Hospital No, DOB (Age is auto-calculated), Weight, and SCr.
    *   **AI Guardrails:** The form automatically checks **Renal Dosing** (based on calculated eGFR) and **Weight-Based Dosing** for safety.
    *   **Coding:** Use the **"Diagnosis Code Guide"** and **"Indication Type Guide"** buttons to select standardized codes (e.g., HAI2-VAP, SP1).
    *   **General Note:** Use the "General Audit Notes" field at the bottom to summarize the case or add clinical opinions.
3.  **Review & Submit:** Review the summary and confirm.
4.  **Managing Logs:**
    *   Click **"Review"** on a row to view the audit details. You can **Edit** the General Audit Note here to add post-audit thoughts.
    *   Click **"Edit"** to modify the original audit data if errors were made during entry.

---

## **7. Troubleshooting**
*   **"Database Error"**: If you see an RLS or column error, contact IT to run the SQL migration scripts.
*   **"Loading..." hangs**: Refresh the page or check your internet connection.
