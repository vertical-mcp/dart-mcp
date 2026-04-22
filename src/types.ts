/**
 * Unified DART (Data Analysis, Retrieval and Transfer) schemas.
 *
 * OpenDART is Korea's FSS electronic disclosure system. Endpoints return
 * JSON/XML over HTTPS. Native fields are in Korean; these interfaces
 * normalize common fields to English for MCP consumers, while preserving
 * raw values in `raw` for callers who need full fidelity.
 */

// --------------------------------------------------------------------------
// Disclosure list item (from /api/list.json)
// --------------------------------------------------------------------------

export interface Disclosure {
  /** OpenDART corp code (8-digit, not to be confused with stock ticker). */
  corp_code: string;
  /** Company name (Korean). */
  corp_name: string;
  /** Market: KOSPI "Y" / KOSDAQ "K" / KONEX "N" / other "E". */
  corp_cls: "Y" | "K" | "N" | "E" | string;
  /** Stock ticker (6-digit). Empty for unlisted. */
  stock_code?: string;
  /** Disclosure title. */
  report_nm: string;
  /** Receipt number — primary key for document detail APIs. */
  rcept_no: string;
  /** Submitter name (company or filer). */
  flr_nm: string;
  /** Receipt date (YYYYMMDD). */
  rcept_dt: string;
  /** Remarks (amendments, etc.). */
  rm?: string;
}

// --------------------------------------------------------------------------
// Company profile (from /api/company.json)
// --------------------------------------------------------------------------

export interface CompanyInfo {
  corp_code: string;
  corp_name: string;
  corp_name_eng?: string;
  stock_name?: string;
  stock_code?: string;
  ceo_nm?: string;
  corp_cls?: string;
  jurir_no?: string;  // corporate registration number
  bizr_no?: string;   // business registration number
  adres?: string;
  hm_url?: string;
  ir_url?: string;
  phn_no?: string;
  fax_no?: string;
  induty_code?: string;
  est_dt?: string;    // establishment date (YYYYMMDD)
  acc_mt?: string;    // fiscal year-end month
}

// --------------------------------------------------------------------------
// Financial statement summary (from /api/fnlttSinglAcntAll.json)
// --------------------------------------------------------------------------

export interface FinancialLineItem {
  account_nm: string;   // account name (Korean)
  account_id?: string;  // IFRS-ID if available
  fs_div: "CFS" | "OFS" | string;  // consolidated vs separate
  fs_nm?: string;       // statement name
  sj_div?: string;      // BS / IS / CIS / CF / SCE
  sj_nm?: string;
  thstrm_nm?: string;   // current period label
  thstrm_amount?: string;  // current-period amount (string — may contain commas)
  frmtrm_amount?: string;  // prior-year
  bfefrmtrm_amount?: string;  // prior-prior-year
  currency?: string;
}

export interface FinancialSummary {
  corp_code: string;
  bsns_year: string;       // business year (YYYY)
  reprt_code: string;      // report code (11011=annual, 11012=H1, 11013=Q1, 11014=Q3)
  items: FinancialLineItem[];
}

// --------------------------------------------------------------------------
// Tool input schemas
// --------------------------------------------------------------------------

export interface SearchDisclosuresInput {
  /** Company corp_code (8-digit) OR empty to search all companies. */
  corp_code?: string;
  /** Date range start (YYYYMMDD). Defaults to 30 days ago. */
  bgn_de?: string;
  /** Date range end (YYYYMMDD). Defaults to today. */
  end_de?: string;
  /** Disclosure type code (A=regular, B=bond, ...). Optional. */
  pblntf_ty?: string;
  /** Market filter: Y=KOSPI, K=KOSDAQ, N=KONEX, E=other, ALL default. */
  corp_cls?: "Y" | "K" | "N" | "E" | "ALL";
  /** Results per page (1-100). */
  page_count: number;
  /** Page number (1-based). */
  page_no: number;
}

export interface GetCompanyInfoInput {
  corp_code: string;
}

export interface GetFinancialSummaryInput {
  corp_code: string;
  bsns_year: string;
  /** Report code. 11011=annual (default), 11012=H1, 11013=Q1, 11014=Q3. */
  reprt_code?: "11011" | "11012" | "11013" | "11014";
  /** Consolidated (CFS) vs separate (OFS). */
  fs_div?: "CFS" | "OFS";
}
