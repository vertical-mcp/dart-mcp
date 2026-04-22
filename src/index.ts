#!/usr/bin/env node
/**
 * DART MCP Server
 *
 * MCP server for Korea's DART (Data Analysis, Retrieval and Transfer)
 * electronic disclosure system, operated by the Financial Supervisory
 * Service (FSS). Exposes company disclosures, company profiles, and
 * financial statements via the OpenDART public API.
 *
 * Runs in two modes:
 *   1. Local stdio (CLI):  `npx @vertical-mcp/dart-mcp`
 *      -> file is executed directly, main() bootstraps StdioServerTransport.
 *   2. Smithery-hosted HTTP: Smithery imports the default export
 *      (`createServer`) and wraps it in their StreamableHTTP transport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { pathToFileURL } from "url";

import {
  searchDisclosures,
  getCompanyInfo,
  getFinancialSummary,
} from "./providers/opendart.js";

// --------------------------------------------------------------------------
// Smithery session config
// --------------------------------------------------------------------------

export const configSchema = z.object({
  dartApiKey: z
    .string()
    .optional()
    .describe(
      "OpenDART API key (40-character string). Register free at " +
        "https://opendart.fss.or.kr. Required for all tools — without it " +
        "every call returns an authentication error."
    ),
});

export type Config = z.infer<typeof configSchema>;

// --------------------------------------------------------------------------
// Tool input schemas (zod — internal validation)
// --------------------------------------------------------------------------

const SearchDisclosuresSchema = z.object({
  corp_code: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("OpenDART 8-digit corp_code. Omit to search all companies."),
  bgn_de: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("Begin date YYYYMMDD. Defaults to 30 days ago."),
  end_de: z
    .string()
    .regex(/^\d{8}$/)
    .optional()
    .describe("End date YYYYMMDD. Defaults to today."),
  pblntf_ty: z
    .string()
    .optional()
    .describe(
      "Disclosure type code: A=regular/periodic, B=bond issuance, " +
        "C=equity issuance, D=major mgmt matters, E=public takeover, " +
        "F=external audit, G=corporate merger, H=dividend, I=exchange, " +
        "J=reporting. Omit for all types."
    ),
  corp_cls: z
    .enum(["Y", "K", "N", "E", "ALL"])
    .default("ALL")
    .describe("Market: Y=KOSPI, K=KOSDAQ, N=KONEX, E=other, ALL=no filter."),
  page_count: z.number().int().min(1).max(100).default(20),
  page_no: z.number().int().min(1).default(1),
});

const GetCompanyInfoSchema = z.object({
  corp_code: z
    .string()
    .regex(/^\d{8}$/)
    .describe("OpenDART 8-digit corp_code."),
});

const GetFinancialSummarySchema = z.object({
  corp_code: z.string().regex(/^\d{8}$/),
  bsns_year: z
    .string()
    .regex(/^\d{4}$/)
    .describe("Business year YYYY."),
  reprt_code: z
    .enum(["11011", "11012", "11013", "11014"])
    .default("11011")
    .describe(
      "Report code: 11011=annual (default), 11012=half-year, " +
        "11013=Q1, 11014=Q3."
    ),
  fs_div: z
    .enum(["CFS", "OFS"])
    .default("CFS")
    .describe("CFS=consolidated, OFS=separate (parent-only)."),
});

// --------------------------------------------------------------------------
// Factory: create a fully-wired MCP Server
// --------------------------------------------------------------------------

export default function createServer(
  { config }: { config?: Config } = {}
): Server {
  if (config?.dartApiKey && !process.env.DART_API_KEY) {
    process.env.DART_API_KEY = config.dartApiKey;
  }

  const server = new Server(
    {
      name: "dart-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_disclosures",
        description:
          "Search Korean company disclosures filed with the FSS. Returns " +
          "filings with receipt numbers, titles, filers, and dates. Filter " +
          "by date range, company corp_code, disclosure type, and market " +
          "(KOSPI/KOSDAQ/KONEX).",
        inputSchema: {
          type: "object",
          properties: {
            corp_code: { type: "string", pattern: "^\\d{8}$" },
            bgn_de: { type: "string", pattern: "^\\d{8}$" },
            end_de: { type: "string", pattern: "^\\d{8}$" },
            pblntf_ty: { type: "string" },
            corp_cls: {
              type: "string",
              enum: ["Y", "K", "N", "E", "ALL"],
              default: "ALL",
            },
            page_count: { type: "number", default: 20 },
            page_no: { type: "number", default: 1 },
          },
        },
      },
      {
        name: "get_company_info",
        description:
          "Get company profile from DART: name, CEO, registration numbers, " +
          "address, homepage, IR page, industry code, establishment date, " +
          "fiscal year-end month. Requires DART corp_code (8-digit).",
        inputSchema: {
          type: "object",
          properties: {
            corp_code: { type: "string", pattern: "^\\d{8}$" },
          },
          required: ["corp_code"],
        },
      },
      {
        name: "get_financial_summary",
        description:
          "Get full financial statement line items (BS/IS/CIS/CF/SCE) for a " +
          "company for a given year and report. Supports consolidated (CFS) " +
          "or separate (OFS) statements. Report codes: 11011=annual, " +
          "11012=half-year, 11013=Q1, 11014=Q3.",
        inputSchema: {
          type: "object",
          properties: {
            corp_code: { type: "string", pattern: "^\\d{8}$" },
            bsns_year: { type: "string", pattern: "^\\d{4}$" },
            reprt_code: {
              type: "string",
              enum: ["11011", "11012", "11013", "11014"],
              default: "11011",
            },
            fs_div: {
              type: "string",
              enum: ["CFS", "OFS"],
              default: "CFS",
            },
          },
          required: ["corp_code", "bsns_year"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "search_disclosures": {
          const input = SearchDisclosuresSchema.parse(args);
          const results = await searchDisclosures(input);
          return {
            content: [
              { type: "text", text: JSON.stringify(results, null, 2) },
            ],
          };
        }

        case "get_company_info": {
          const input = GetCompanyInfoSchema.parse(args);
          const profile = await getCompanyInfo(input);
          return {
            content: [
              { type: "text", text: JSON.stringify(profile, null, 2) },
            ],
          };
        }

        case "get_financial_summary": {
          const input = GetFinancialSummarySchema.parse(args);
          const fin = await getFinancialSummary(input);
          return {
            content: [
              { type: "text", text: JSON.stringify(fin, null, 2) },
            ],
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// --------------------------------------------------------------------------
// Smithery sandbox factory (build-time tool scanning)
// --------------------------------------------------------------------------
// Smithery scans tools/resources without real credentials. We export
// `configSchema`, so a `createSandboxServer` is required. Safe placeholders:
// no real API calls happen during scanning — tool discovery only.

export function createSandboxServer(): Server {
  return createServer({
    config: {
      dartApiKey: undefined,
    },
  });
}

// --------------------------------------------------------------------------
// Local stdio bootstrap (only when executed directly, not imported)
// --------------------------------------------------------------------------

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("dart-mcp server running on stdio");
}

// In ESM, detect "run as script" by comparing import.meta.url to argv[1].
// Smithery imports this file as a module, so argv[1] won't match and main()
// won't fire.
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
