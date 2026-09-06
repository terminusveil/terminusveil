/**
 * The public reads, described once. Served at `/api/openapi.json` and read by
 * the docs; the shapes mirror `api-shape.ts`. No auth, no key, no write.
 */
export function openapiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Terminus Veil public reads",
      version: "0.1.0",
      description:
        "Read-only JSON from the desk: corporate actions on Robinhood Chain stock tokens, as read from the contract and the issuer feed. A preview of the phase 2 feed; limits may follow.",
      contact: { name: "Terminus Veil", url: "https://x.com/terminus_veil" },
    },
    servers: [{ url: origin }],
    paths: {
      "/api/health": {
        get: {
          summary: "The build that answered and the reading it holds",
          responses: {
            "200": {
              description: "Never cached",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
            },
          },
        },
      },
      "/api/pending": {
        get: {
          summary: "Every veiled or due ticker with its four reads",
          responses: {
            "200": {
              description: "30 s at the edge",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Pending" } } },
            },
          },
        },
      },
      "/api/ticker/{ticker}": {
        get: {
          summary: "One ticker: four reads, terminus, oracle, contract",
          parameters: [
            {
              name: "ticker",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^[A-Za-z0-9.-]{1,12}$" },
            },
          ],
          responses: {
            "200": {
              description: "30 s at the edge",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Ticker" } } },
            },
            "400": {
              description: "Not a ticker",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "404": {
              description: "The desk does not read that ticker",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/api/tape": {
        get: {
          summary: "Chain id and the latest block as the desk read them",
          responses: {
            "200": {
              description: "30 s at the edge",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Tape" } } },
            },
          },
        },
      },
      "/api/calendar": {
        get: {
          summary: "The pending tape as an ICS feed; one ticker with ?ticker=",
          parameters: [
            { name: "ticker", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "text/calendar, never cached" },
            "400": { description: "Not a ticker" },
          },
        },
      },
      "/api/wire/post": {
        get: {
          summary:
            "The Wire poster job; authorised by the house's pinger or Vercel Cron, not a public read",
          responses: {
            "401": {
              description: "Unauthorised",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        Tape: {
          type: "object",
          properties: {
            chainId: { type: ["integer", "null"] },
            block: { type: ["integer", "null"] },
            absent: { type: "boolean" },
            reason: { type: ["string", "null"] },
          },
          required: ["chainId", "block", "absent", "reason"],
        },
        Health: {
          type: "object",
          properties: {
            ok: { type: "boolean", const: true },
            build: {
              type: "object",
              properties: { commit: { type: "string" }, at: { type: "string" } },
              required: ["commit", "at"],
            },
            chain: {
              type: "object",
              properties: {
                id: { type: "integer" },
                block: { type: ["integer", "null"] },
                readAt: { type: "string", format: "date-time" },
              },
              required: ["id", "block", "readAt"],
            },
            source: { type: "string", enum: ["live", "snapshot"] },
            feedStale: { type: "boolean" },
            tickers: { type: "integer" },
            pending: { type: "integer" },
            due: { type: "integer" },
            wire: {
              type: ["object", "null"],
              description:
                "The Wire contract, the house's poster, and its post count; null when the Wire is not live.",
              properties: {
                address: { type: "string" },
                poster: { type: "string" },
                count: { type: ["integer", "null"] },
              },
              required: ["address", "poster", "count"],
            },
            pass: {
              oneOf: [{ $ref: "#/components/schemas/Pass" }, { type: "null" }],
              description:
                "VeilPass's price, burn share, period and house wallet; null when the Pass is not pasted or a read failed.",
            },
          },
          required: [
            "ok",
            "build",
            "chain",
            "source",
            "feedStale",
            "tickers",
            "pending",
            "due",
            "wire",
            "pass",
          ],
        },
        Pass: {
          type: "object",
          description: "VeilPass, as read from the chain: every figure is the contract's own.",
          properties: {
            address: { type: "string" },
            price: { type: "string", description: "$VEIL wei, decimal string" },
            burnBps: { type: "integer" },
            periodSec: { type: "integer" },
            house: { type: "string" },
          },
          required: ["address", "price", "burnBps", "periodSec", "house"],
        },
        Row: {
          type: "object",
          description:
            "Multipliers are strings as each source gives them: the contract's 18-decimal integer (1000000000000000000 = 1×) in live, liveOnchain, staged, stagedOnchain and lastMove; the issuer's decimal (1.000000000000000000) in liveApi and stagedApi. Times are ISO 8601, UTC.",
          properties: {
            ticker: { type: "string" },
            state: { type: "string", enum: ["open", "veiled", "due", "paused", "absent"] },
            live: { type: ["string", "null"] },
            liveApi: { type: ["string", "null"] },
            liveOnchain: { type: ["string", "null"] },
            staged: { type: ["string", "null"] },
            stagedApi: { type: ["string", "null"] },
            stagedOnchain: { type: ["string", "null"] },
            disagree: { type: "boolean" },
            stagedDisagree: { type: "boolean" },
            terminusIso: { type: ["string", "null"], format: "date-time" },
            terminusSource: {
              type: ["string", "null"],
              enum: ["issuer", "chain", "assumed", null],
            },
            oracle: { type: "string", enum: ["live", "paused", "absent", "unread"] },
            transferPaused: { type: ["boolean", "null"] },
            lastMove: {
              type: ["object", "null"],
              properties: {
                old: { type: "string" },
                new: { type: "string" },
                effectiveAtIso: { type: ["string", "null"] },
                atIso: { type: ["string", "null"] },
                block: { type: "integer" },
              },
            },
            address: { type: ["string", "null"] },
            wire: {
              type: ["object", "null"],
              description:
                "The house poster's latest Wire post for this ticker: staged as the contract's 18-decimal integer, terminus and postedAt as Unix seconds. Null when the Wire is not live, the read did not run or failed (see wireRead), or nothing was posted.",
              properties: {
                staged: { type: "string" },
                terminus: { type: "integer" },
                postedAt: { type: "integer" },
              },
              required: ["staged", "terminus", "postedAt"],
            },
            wireRead: {
              type: "boolean",
              description:
                "True only when the Wire read ran for this row and the chain answered for this ticker. False with a null wire means the read did not run or failed, not that nothing was posted.",
            },
            windows: {
              oneOf: [{ $ref: "#/components/schemas/Windows" }, { type: "null" }],
            },
          },
          required: [
            "ticker",
            "state",
            "live",
            "staged",
            "disagree",
            "stagedDisagree",
            "terminusIso",
            "terminusSource",
            "oracle",
            "transferPaused",
            "lastMove",
            "address",
            "wire",
            "wireRead",
            "windows",
          ],
        },
        Windows: {
          type: "object",
          description:
            "The pools that hold this ticker, from a committed index (readAt, toBlock) plus a bounded live delta. v4 counts Uniswap v4 pools by hook: pons's, none, other. capped is true when a crawl chunk hit the provider's cap.",
          properties: {
            pons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  symbol: { type: ["string", "null"] },
                  phase: { type: ["integer", "null"], enum: [0, 1, 2, 3, null] },
                  block: { type: "integer" },
                },
                required: ["token", "symbol", "phase", "block"],
              },
            },
            ponsTotal: { type: "integer" },
            v4: {
              type: "object",
              properties: {
                pons: { type: "integer" },
                plain: { type: "integer" },
                other: { type: "integer" },
              },
              required: ["pons", "plain", "other"],
            },
            capped: { type: "boolean" },
            toBlock: { type: "integer" },
            readAt: { type: "string" },
            source: { type: "string", enum: ["index", "index+delta"] },
          },
          required: ["pons", "ponsTotal", "v4", "capped", "toBlock", "readAt", "source"],
        },
        Pending: {
          type: "object",
          properties: {
            readAt: { type: "string", format: "date-time" },
            block: { type: ["integer", "null"] },
            source: { type: "string", enum: ["live", "snapshot"] },
            count: { type: "integer" },
            rows: { type: "array", items: { $ref: "#/components/schemas/Row" } },
          },
          required: ["readAt", "block", "source", "count", "rows"],
        },
        Ticker: {
          allOf: [
            { $ref: "#/components/schemas/Row" },
            {
              type: "object",
              properties: {
                explorer: {
                  type: ["string", "null"],
                  description: "The token contract on Blockscout",
                },
                readAt: { type: "string", format: "date-time" },
                block: { type: ["integer", "null"] },
                source: { type: "string", enum: ["live", "snapshot"] },
              },
              required: ["explorer", "readAt", "block", "source"],
            },
          ],
        },
      },
    },
  } as const;
}
