
import { UserRole } from './types';

// Based on the provided images and requirements
export const PHARMACISTS = [
  "Abello, Corazon L.",
  "Barroquillo, John Patrick L.",
  "Calma, Annalyn B.",
  "Carpio, Leiz Anne M.",
  "Cruz, Noemee Hyacinth D.",
  "Dela Cruz, Shella M.",
  "Delas Alas, Allysa Marie J.",
  "Domingo, Deanne P.",
  "Enriquez, Joan M.",
  "Fallasgon, Charmen Joy G.",
  "Fernandez, Rudy R.",
  "Hermoso, Zenaida R.",
  "Maglalang, Jose Philip G.",
  "Mulbog, Rhozen Z.",
  "Navales, Hyra Mae R.",
  "Oasay, Victoria C.",
  "Obregon, Jose Nicolas F.",
  "Parane, Ruth D.",
  "Pasion, Kathleen Leah M.",
  "Quintana, Marshiel L.",
  "Romero, Sienna Marie D.",
  "Tan, Ma. Guillene B.",
  "Tse, Clarice Kimba D.",
  "Valencia, Adhelyn Jay E.",
  "Villanueva, Roxan D.",
  "Ybalane, Jeremy V."
].sort();

export const IDS_SPECIALISTS_ADULT = [
  "Dr. Christopher John Tibayan",
  "Dr. Jelly Ann Gozun-Recuenco",
  "Dr. Paulo Garcia"
].sort();

export const IDS_SPECIALISTS_PEDIATRIC = [
  "Dr. Michelle Carandang-Cuvin",
  "Dr. Pia Catrina Tolentino Torres"
].sort();

export const IDS_SPECIALISTS = [
  ...IDS_SPECIALISTS_ADULT,
  ...IDS_SPECIALISTS_PEDIATRIC
].sort();

export const WARDS = [
  "6th Floor Ward",
  "7th Floor Ward",
  "ARI 2",
  "Dengue Ward",
  "Emergency Room Complex",
  "ICU",
  "Infectious Ward",
  "Medicine Female",
  "Medicine Isolation Room",
  "Medicine Male",
  "NICU",
  "NICU Transition",
  "NON-SARI",
  "OB Gyne Ward",
  "Pedia 3 Pulmo (Hema Ward)",
  "Pedia ICU",
  "Pedia ISO (4th)",
  "Pedia Isolation",
  "Pedia Ward 1 Stepdown",
  "Pedia Ward 3",
  "Pedia Ward 3 Extension",
  "Respiratory ICU",
  "SARI",
  "SARI 1",
  "SARI 2",
  "SARI 3",
  "Surgery Ward"
].sort();

export const MONITORED_DRUGS = [
  "Imipenem", "Meropenem", "Ertapenem", "Doripenem", "Gentamicin", 
  "Amikacin", "Ciprofloxacin", "Levofloxacin", "Moxifloxacin", 
  "Aztreonam", "Ceftolozane-Tazobactam", "Colistin", "Linezolid", 
  "Tigecycline", "Vancomycin", "Cefepime"
].sort();

export const RESTRICTED_DRUGS = [
  "Ciprofloxacin", "Levofloxacin", "Moxifloxacin", "Ceftriaxone", 
  "Cefotaxime", "Ceftazidime", "Cefixime", "Cefpodoxime", 
  "Gentamicin", "Amikacin", "Clindamycin"
].sort();

export const DEFAULT_PASSWORD = "osmak123";

export const LOGO_URL = "https://maxterrenal-hash.github.io/amsone/osmaklogo.png";

// Supabase Configuration
export const SUPABASE_URL = "https://dofdxmkqqlsmvjchgdwe.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZmR4bWtxcWxzbXZqY2hnZHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTkyODAsImV4cCI6MjA3OTY5NTI4MH0.tnBC--0vLTidLhtJOgmU90s769j4W3iksdvmnGZdoPQ";

// Google Apps Script Web App URL for Sheets backup
export const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzc3oDXYvKL89d38VZQDnakrxJu5H_P4LVtKLc3QEZSUgks8Xzc2nS9dbUPECu4374WHg/exec";
