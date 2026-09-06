export type MetaTag = {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
};

type EnvLike = { VITE_SITE_URL?: string } | undefined;

export const SITE_NAME = "Terminus Veil";
export const X_HANDLE = "@terminus_veil";
export const SITE_TITLE = "Terminus Veil · corporate-action desk for Robinhood Chain stock tokens";
export const SITE_DESCRIPTION =
  "Which stock tokens have a split or dividend pending, the multiplier now, the one staged, and the exact moment it switches. Free. Verify on explorer.";

function viteEnv(): EnvLike {
  // Static property access so Vite can inline it at build time. Vite 8's SSR
  // module runner throws on dynamic `import.meta.env` reads; under node:test
  // `import.meta.env` is undefined, which the optional chain absorbs.
  return { VITE_SITE_URL: import.meta.env?.VITE_SITE_URL };
}

/**
 * Public origin of the deployed site, from VITE_SITE_URL. Null when unset so
 * absolute tags are omitted rather than pointed at the wrong host.
 */
export function siteUrl(env: EnvLike = viteEnv()): string | null {
  const raw = env?.VITE_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/** Default share image and its `og:image:alt`, for every page but /token. */
export const OG_IMAGE = "/og.jpg";
export const OG_IMAGE_ALT =
  "Terminus Veil, a corporate-action desk for Robinhood Chain stock tokens";

export function ogMeta({
  title,
  description,
  path,
  origin = siteUrl(),
  image = OG_IMAGE,
  imageAlt = OG_IMAGE_ALT,
}: {
  title: string;
  description: string;
  path: string;
  origin?: string | null;
  /** Site-relative path of the share image; defaults to the desk card. */
  image?: string;
  imageAlt?: string;
}): MetaTag[] {
  const tags: MetaTag[] = [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: X_HANDLE },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (origin) {
    tags.push(
      { property: "og:url", content: `${origin}${path}` },
      { property: "og:image", content: `${origin}${image}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:image", content: `${origin}${image}` },
      { name: "twitter:image:alt", content: imageAlt },
    );
  }
  return tags;
}

type PageInput = {
  title: string;
  description: string;
  path: string;
  origin?: string | null;
  image?: string;
  imageAlt?: string;
};

/** Title + description + share tags, for a route's `head`. */
export function pageMeta(input: PageInput): MetaTag[] {
  return [
    { title: input.title },
    { name: "description", content: input.description },
    ...ogMeta(input),
  ];
}

export type LinkTag = { rel: string; href: string };

/**
 * `<link rel="canonical">` for a route, absolute on the public origin. Empty
 * when the origin is unknown, matching how `ogMeta` omits absolute tags.
 * Only leaf routes call this: `HeadContent` does not dedupe links, so a
 * canonical on the root would print twice on every page.
 */
export function canonicalLink(path: string, origin: string | null = siteUrl()): LinkTag[] {
  return origin ? [{ rel: "canonical", href: `${origin}${path}` }] : [];
}

/** Everything a route's `head` returns: `pageMeta` plus the canonical link. */
export function pageHead(input: PageInput): { meta: MetaTag[]; links: LinkTag[] } {
  const origin = input.origin === undefined ? siteUrl() : input.origin;
  return { meta: pageMeta(input), links: canonicalLink(input.path, origin) };
}
