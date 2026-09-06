import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OG_IMAGE_ALT, canonicalLink, ogMeta, pageHead, pageMeta, siteUrl } from "./site-meta.ts";

describe("siteUrl", () => {
  it("is null when the env var is missing or blank", () => {
    assert.equal(siteUrl(undefined), null);
    assert.equal(siteUrl({}), null);
    assert.equal(siteUrl({ VITE_SITE_URL: "   " }), null);
  });

  it("strips trailing slashes", () => {
    assert.equal(
      siteUrl({ VITE_SITE_URL: "https://terminusveil.com/" }),
      "https://terminusveil.com",
    );
    assert.equal(
      siteUrl({ VITE_SITE_URL: "https://terminusveil.com" }),
      "https://terminusveil.com",
    );
  });
});

describe("ogMeta", () => {
  const base = { title: "T", description: "D", path: "/token" };

  it("omits every absolute tag when there is no origin", () => {
    const keys = ogMeta({ ...base, origin: null }).map((t) => t.property ?? t.name);
    assert.ok(keys.includes("og:title"));
    assert.ok(keys.includes("twitter:card"));
    assert.ok(!keys.includes("og:image"));
    assert.ok(!keys.includes("og:url"));
    assert.ok(!keys.includes("twitter:image"));
    assert.ok(!keys.includes("og:image:width"));
    assert.ok(!keys.includes("og:image:height"));
    assert.ok(!keys.includes("og:image:alt"));
    assert.ok(!keys.includes("twitter:image:alt"));
  });

  it("points image and url at the origin when set", () => {
    const tags = ogMeta({ ...base, origin: "https://terminusveil.com" });
    const byKey = Object.fromEntries(tags.map((t) => [t.property ?? t.name, t.content]));
    assert.equal(byKey["og:url"], "https://terminusveil.com/token");
    assert.equal(byKey["og:image"], "https://terminusveil.com/og.jpg");
    assert.equal(byKey["og:image:width"], "1200");
    assert.equal(byKey["twitter:image"], "https://terminusveil.com/og.jpg");
    assert.equal(byKey["og:image:alt"], OG_IMAGE_ALT);
    assert.equal(byKey["twitter:image:alt"], OG_IMAGE_ALT);
  });

  it("takes a page-specific image and alt (the /token card)", () => {
    const tags = ogMeta({
      ...base,
      origin: "https://terminusveil.com",
      image: "/og-token.jpg",
      imageAlt: "$VEIL, the house token of Terminus Veil, on pons",
    });
    const byKey = Object.fromEntries(tags.map((t) => [t.property ?? t.name, t.content]));
    assert.equal(byKey["og:image"], "https://terminusveil.com/og-token.jpg");
    assert.equal(byKey["twitter:image"], "https://terminusveil.com/og-token.jpg");
    assert.equal(byKey["og:image:alt"], "$VEIL, the house token of Terminus Veil, on pons");
    assert.equal(byKey["twitter:image:alt"], "$VEIL, the house token of Terminus Veil, on pons");
    assert.equal(byKey["og:image:width"], "1200");
    assert.equal(byKey["og:image:height"], "630");
  });

  it("pageMeta leads with title and description", () => {
    const tags = pageMeta({ ...base, origin: null });
    assert.deepEqual(tags[0], { title: "T" });
    assert.deepEqual(tags[1], { name: "description", content: "D" });
    assert.ok(tags.length > 2);
    assert.deepEqual(tags.slice(2), ogMeta({ ...base, origin: null }));
  });
});

describe("canonicalLink / pageHead", () => {
  it("is absolute on the origin, and absent without one", () => {
    assert.deepEqual(canonicalLink("/token", "https://terminusveil.com"), [
      { rel: "canonical", href: "https://terminusveil.com/token" },
    ]);
    assert.deepEqual(canonicalLink("/token", null), []);
  });

  it("pageHead pairs pageMeta with the canonical for the same path", () => {
    const input = {
      title: "T",
      description: "D",
      path: "/events/NVDA",
      origin: "https://terminusveil.com",
    };
    const head = pageHead(input);
    assert.deepEqual(head.meta, pageMeta(input));
    assert.deepEqual(head.links, [
      { rel: "canonical", href: "https://terminusveil.com/events/NVDA" },
    ]);
    assert.deepEqual(pageHead({ ...input, origin: null }).links, []);
  });
});
