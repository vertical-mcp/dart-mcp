# @vertical-mcp/dart-mcp

MCP server for Korea's **DART** (Data Analysis, Retrieval and Transfer) electronic disclosure system, operated by the Financial Supervisory Service (FSS). Exposes company disclosures, company profiles, and financial statements via the [OpenDART public API](https://opendart.fss.or.kr/guide/main.do).

한국 금융감독원(FSS)이 운영하는 **DART**(전자공시시스템)의 공개 API(OpenDART)를 MCP 서버로 래핑한 패키지. 기업 공시, 기업 개황, 재무제표를 Claude·Cursor 등 MCP 호환 클라이언트에서 바로 조회할 수 있다.

---

## Tools

| Tool | Description |
|------|-------------|
| `search_disclosures` | Search disclosures by date range, company `corp_code`, disclosure type, and market (KOSPI / KOSDAQ / KONEX). |
| `get_company_info` | Get company profile: name, CEO, registration numbers, address, homepage, IR page, industry code, establishment date, fiscal year-end month. |
| `get_financial_summary` | Get full financial statement line items (BS / IS / CIS / CF / SCE) for a given year and report. Supports consolidated (CFS) or separate (OFS). |

---

## Quick start

### 1. Register for an OpenDART API key

Register free at <https://opendart.fss.or.kr>. You'll receive a 40-character `crtfc_key`. The key is issued immediately after email verification.

### 2. Install

```bash
npx @vertical-mcp/dart-mcp
```

Or install globally:

```bash
npm install -g @vertical-mcp/dart-mcp
dart-mcp
```

### 3. Configure your MCP client

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "dart-mcp": {
      "command": "npx",
      "args": ["-y", "@vertical-mcp/dart-mcp"],
      "env": {
        "DART_API_KEY": "your-40-char-key-here"
      }
    }
  }
}
```

#### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "dart-mcp": {
      "command": "npx",
      "args": ["-y", "@vertical-mcp/dart-mcp"],
      "env": {
        "DART_API_KEY": "your-40-char-key-here"
      }
    }
  }
}
```

#### Smithery-hosted (coming soon)

When the Smithery hosted deploy is live, you can register the session-scoped `dartApiKey` via Smithery's config UI — no local env var needed.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DART_API_KEY` | **Yes** | 40-character OpenDART API key from <https://opendart.fss.or.kr>. |

---

## Examples

### Find Samsung Electronics disclosures in the last week

```
search_disclosures({
  corp_code: "00126380",
  bgn_de: "20260415",
  end_de: "20260422",
  page_count: 20
})
```

### Get Hyundai Motor's company profile

```
get_company_info({ corp_code: "00164742" })
```

### Get SK Hynix 2024 annual consolidated financials

```
get_financial_summary({
  corp_code: "00164779",
  bsns_year: "2024",
  reprt_code: "11011",
  fs_div: "CFS"
})
```

---

## Finding `corp_code`

OpenDART uses its own 8-digit `corp_code` — **not** the 6-digit stock ticker. You can fetch the full mapping (CORPCODE.xml, ~120 k entries) from OpenDART's `/api/corpCode.xml` endpoint. A helper `list_corp_codes` tool is on the v0.2 roadmap.

---

## Development

```bash
git clone https://github.com/vertical-mcp/dart-mcp.git
cd dart-mcp
npm install
npm run build
npm start
```

### Scripts

- `npm run dev` — watch mode via `tsx`
- `npm run build` — compile to `dist/`
- `npm run typecheck` — no-emit type check
- `npm run clean` — remove `dist/`

---

## Roadmap

- **v0.1** — `search_disclosures`, `get_company_info`, `get_financial_summary` (this release)
- **v0.2** — `list_corp_codes`, `get_major_shareholders`, `get_audit_report`, disclosure document full-text fetch
- **v0.3** — XBRL normalization, multi-period trend queries, insider transactions

---

## Legal / attribution

- Data source: [OpenDART](https://opendart.fss.or.kr) — Korea Financial Supervisory Service.
- This package is an unofficial community wrapper. It is not affiliated with or endorsed by the FSS.
- Rate limit: ~20,000 requests/day per API key (OpenDART policy).

---

## License

MIT © 2026 Yongbum Kim
