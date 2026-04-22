/**
 * OpenDART API client.
 *
 * OpenDART (https://opendart.fss.or.kr) is Korea FSS's public disclosure
 * platform. All endpoints authenticate via the `crtfc_key` query parameter
 * (40-character API key registered at https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do).
 *
 * Response envelope: every endpoint returns
 *   { status: "000", message: "정상" | ..., list?: [...] | single-object-fields }
 * Status "000" = success; non-"000" codes indicate errors (013 = no data,
 * 100 = invalid key, 101 = unauthorized key, 800 = system error, 900 = other).
 */

import { request } from "undici";
import type {
  Disclosure,
  CompanyInfo,
  FinancialSummary,
  FinancialLineItem,
  SearchDisclosuresInput,
  GetCompanyInfoInput,
  GetFinancialSummaryInput,
} from "../types.js";

const BASE_URL = "https://opendart.fss.or.kr/api";

/** Read the OpenDART API key from env. Throws if missing. */
function getApiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new Error(
      "DART_API_KEY not set. Register at https://opendart.fss.or.kr " +
        "and set the key via environment variable or MCP session config."
    );
  }
  return key;
}

/** Low-level JSON GET with query-param auth. */
async function dartGet<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const key = getApiKey();
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("crtfc_key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await request(url.toString(), { method: "GET" });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`OpenDART HTTP ${res.statusCode} on ${endpoint}`);
  }
  const body = (await res.body.json()) as {
    status: string;
    message: string;
  } & Record<string, unknown>;

  if (body.status !== "000" && body.status !== "013") {
    // 013 = "조회된 데이터가 없습니다" (no data) — not an error, just empty.
    throw new Error(
      `OpenDART error ${body.status}: ${body.message} (endpoint=${endpoint})`
    );
  }
  return body as T;
}

// --------------------------------------------------------------------------
// search_disclosures — /api/list.json
// --------------------------------------------------------------------------

export async function searchDisclosures(
  input: SearchDisclosuresInput
): Promise<Disclosure[]> {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const defaultEnd = fmt(today);
  const defaultBegin = fmt(
    new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  );

  const body = await dartGet<{
    status: string;
    list?: Disclosure[];
  }>("list.json", {
    corp_code: input.corp_code,
    bgn_de: input.bgn_de ?? defaultBegin,
    end_de: input.end_de ?? defaultEnd,
    pblntf_ty: input.pblntf_ty,
    corp_cls: input.corp_cls && input.corp_cls !== "ALL" ? input.corp_cls : undefined,
    page_count: input.page_count,
    page_no: input.page_no,
  });

  return body.list ?? [];
}

// --------------------------------------------------------------------------
// get_company_info — /api/company.json
// --------------------------------------------------------------------------

export async function getCompanyInfo(
  input: GetCompanyInfoInput
): Promise<CompanyInfo> {
  const body = await dartGet<CompanyInfo & { status: string }>(
    "company.json",
    { corp_code: input.corp_code }
  );

  // company.json returns fields at top level (not inside `list`)
  const { status: _s, ...profile } = body;
  return profile as CompanyInfo;
}

// --------------------------------------------------------------------------
// get_financial_summary — /api/fnlttSinglAcntAll.json
// --------------------------------------------------------------------------

export async function getFinancialSummary(
  input: GetFinancialSummaryInput
): Promise<FinancialSummary> {
  const reprt_code = input.reprt_code ?? "11011";
  const fs_div = input.fs_div ?? "CFS";

  const body = await dartGet<{
    status: string;
    list?: FinancialLineItem[];
  }>("fnlttSinglAcntAll.json", {
    corp_code: input.corp_code,
    bsns_year: input.bsns_year,
    reprt_code,
    fs_div,
  });

  return {
    corp_code: input.corp_code,
    bsns_year: input.bsns_year,
    reprt_code,
    items: body.list ?? [],
  };
}
