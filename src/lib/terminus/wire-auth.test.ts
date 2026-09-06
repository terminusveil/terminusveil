import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wireAuthorised } from "./wire-auth.ts";

const env = { WIRE_CRON_KEY: "pinger-secret", CRON_SECRET: "vercel-secret" };

describe("wireAuthorised", () => {
  it("accepts the pinger's header against WIRE_CRON_KEY", () => {
    assert.equal(wireAuthorised(new Headers({ "x-wire-key": "pinger-secret" }), env), true);
    assert.equal(wireAuthorised(new Headers({ "x-wire-key": "pinger-secre" }), env), false);
    assert.equal(wireAuthorised(new Headers({ "x-wire-key": "pinger-secret2" }), env), false);
  });

  it("accepts Vercel Cron's bearer against CRON_SECRET", () => {
    assert.equal(wireAuthorised(new Headers({ authorization: "Bearer vercel-secret" }), env), true);
    assert.equal(wireAuthorised(new Headers({ authorization: "Bearer nope" }), env), false);
    assert.equal(wireAuthorised(new Headers({ authorization: "vercel-secret" }), env), false);
  });

  it("never matches an unset secret, and refuses an empty request", () => {
    assert.equal(wireAuthorised(new Headers({ "x-wire-key": "" }), env), false);
    assert.equal(wireAuthorised(new Headers({ "x-wire-key": "x" }), {}), false);
    assert.equal(
      wireAuthorised(new Headers({ authorization: "Bearer " }), { CRON_SECRET: "" }),
      false,
    );
    assert.equal(wireAuthorised(new Headers(), env), false);
  });
});
