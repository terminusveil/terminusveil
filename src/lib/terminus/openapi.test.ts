import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openapiDocument } from "./openapi.ts";

describe("openapiDocument", () => {
  const doc = openapiDocument("https://terminusveil.app");

  it("describes the five public reads and the owner-only poster job on the given origin", () => {
    assert.equal(doc.openapi, "3.1.0");
    assert.deepEqual(doc.servers, [{ url: "https://terminusveil.app" }]);
    assert.deepEqual(Object.keys(doc.paths), [
      "/api/health",
      "/api/pending",
      "/api/ticker/{ticker}",
      "/api/tape",
      "/api/calendar",
      "/api/wire/post",
    ]);
  });

  it("only ever describes GET, and every JSON response points at a schema that exists", () => {
    const schemas = Object.keys(doc.components.schemas);
    for (const [path, ops] of Object.entries(doc.paths)) {
      assert.deepEqual(Object.keys(ops), ["get"], path);
      for (const res of Object.values(ops.get.responses)) {
        const ref = (res as { content?: { "application/json"?: { schema?: { $ref?: string } } } })
          .content?.["application/json"]?.schema?.$ref;
        if (ref)
          assert.ok(schemas.includes(ref.replace("#/components/schemas/", "")), `${path}: ${ref}`);
      }
    }
  });

  it("names the contact and carries no key, secret or write", () => {
    assert.equal(doc.info.contact.url, "https://x.com/terminus_veil");
    // apiKey/secret stay bare-word so a future secretToken/clientSecret/apiKeyId
    // field still trips this; only the write-verb clause needs the quote+colon
    // structural fix, so it matches an operation key (`"post":`) and not prose
    // like "postedAt" or "Wire post" — the Wire's read-only fields use both.
    assert.doesNotMatch(JSON.stringify(doc), /apiKey|secret|"(post|put|delete|patch)":/i);
  });

  it("describes transferPaused as a required boolean-or-null on Row", () => {
    const row = doc.components.schemas.Row as unknown as {
      properties: Record<string, { type?: unknown }>;
      required: readonly string[];
    };
    assert.deepEqual(row.properties.transferPaused, { type: ["boolean", "null"] });
    assert.ok(row.required.includes("transferPaused"));
  });

  it("describes wire as a required object-or-null on Row and Health", () => {
    const row = doc.components.schemas.Row as unknown as {
      properties: Record<string, { type?: unknown; description?: string }>;
      required: readonly string[];
    };
    assert.ok(row.properties.wire);
    assert.ok(row.required.includes("wire"));
    // A null wire has three causes; the description sends the reader to wireRead.
    assert.match(row.properties.wire?.description ?? "", /wireRead/);

    const health = doc.components.schemas.Health as unknown as {
      properties: Record<string, { type?: unknown }>;
      required: readonly string[];
    };
    assert.ok(health.properties.wire);
    assert.ok(health.required.includes("wire"));
  });

  it("describes wireRead as a required boolean on Row", () => {
    const row = doc.components.schemas.Row as unknown as {
      properties: Record<string, { type?: unknown }>;
      required: readonly string[];
    };
    assert.equal(row.properties.wireRead?.type, "boolean");
    assert.ok(row.required.includes("wireRead"));
  });

  it("describes a Pass schema and refs it (or null) as a required field on Health", () => {
    assert.ok(doc.components.schemas.Pass);
    const health = doc.components.schemas.Health as unknown as {
      properties: Record<string, { oneOf?: readonly { $ref?: string; type?: string }[] }>;
      required: readonly string[];
    };
    assert.deepEqual(health.properties.pass?.oneOf, [
      { $ref: "#/components/schemas/Pass" },
      { type: "null" },
    ]);
    assert.ok(health.required.includes("pass"));
  });

  it("describes a Windows schema and refs it (or null) as a required field on Row", () => {
    assert.ok(doc.components.schemas.Windows);
    const row = doc.components.schemas.Row as unknown as {
      properties: Record<string, { oneOf?: readonly { $ref?: string; type?: string }[] }>;
      required: readonly string[];
    };
    assert.deepEqual(row.properties.windows?.oneOf, [
      { $ref: "#/components/schemas/Windows" },
      { type: "null" },
    ]);
    assert.ok(row.required.includes("windows"));
  });
});
