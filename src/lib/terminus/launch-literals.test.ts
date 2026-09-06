import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Readiness item 29. On launch day only `house.ts` changes, so every string
 * that is true only before launch must already sit in a `houseLaunched()`
 * branch. This walks `src/**\/*.tsx` (no glob library), finds the literals,
 * and fails when one is rendered unconditionally.
 *
 * The check is pragmatic, not a parser: comments are blanked first; a literal
 * held in a `const NAME = "..."` is judged at each place NAME is used; and a
 * use (or a bare literal) passes when its *enclosing* function or component —
 * found by walking backward from it to the nearest unindented line that
 * starts one — contains, between that boundary and the literal, either
 * `houseLaunched(` or a boolean derived from it in a conditional (`launched
 * ?`, `launched &&`, `!launched`, or the same for any `const x =
 * houseLaunched()` in that file). Scoping to the enclosing definition (rather
 * than a flat line-count lookback) matters: a flat window can see a
 * `houseLaunched()` guard that belongs to a sibling component and wrongly
 * call the literal covered.
 */
const LITERALS = [
  "not launched",
  "Not launched",
  "at launch",
  "after launch",
  "Launches on",
  "lands here first",
  "Follow the launch",
  "Until then",
  "set at creation",
  // `with the Key` is not here: it lives in launch-steps.ts, a .ts this walk
  // never reads, and `launch-steps.test.ts` pins that it stops printing the
  // moment `pass.address` is pasted.
] as const;

/** Allowlist: file → literals it may carry outside a launched branch, and why. */
const ALLOWLIST: Record<string, { literals: readonly (typeof LITERALS)[number][]; why: string }> = {
  "components/launch-strip.tsx": {
    literals: ["at launch", "after launch"],
    why: "STEP_CLASS keys every StepWord for type exhaustiveness; the chip only ever prints this word when launchSteps() returns it, which houseLaunched() gates inside launch-steps.ts, never once launched.",
  },
};

/** Files the guard expects to carry a pre-launch literal; keeps the walk from passing vacuously. */
const KNOWN_CARRIERS = [
  "components/desk-map.tsx",
  "components/house-ca.tsx",
  "components/house-spec.tsx",
  "components/house-section.tsx",
  "components/landing-hero.tsx",
  "components/site-footer.tsx",
  "routes/status.tsx",
  "routes/token.tsx",
];

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Blank comments in place so line numbers survive. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));
}

function importsHouseLaunched(src: string): boolean {
  const re = /import\s*\{([^}]*)\}\s*from\s*["'][^"']*\/house(?:\.ts)?["']/g;
  for (const m of src.matchAll(re)) if (/\bhouseLaunched\b/.test(m[1] ?? "")) return true;
  return false;
}

/** `launched`, plus every `const x = houseLaunched()` in the file. */
function derivedNames(src: string): string[] {
  const names = new Set(["launched"]);
  for (const m of src.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*houseLaunched\(\)/g)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

function conditionalRe(names: string[]): RegExp {
  const alt = names.map((n) => `!${n}\\b|\\b${n}\\s*(?:\\?|&&)`).join("|");
  return new RegExp(`houseLaunched\\(|${alt}`);
}

/** The start of a top-level (unindented) function or component definition. */
const SCOPE_BOUNDARY_RES = [
  /^(export )?(default )?(async )?function \w+/,
  /^(export )?const \w+ = (\([^)]*\)|\w+) =>/,
  /^const \w+ = \(/,
];

function isScopeBoundary(line: string): boolean {
  return SCOPE_BOUNDARY_RES.some((re) => re.test(line));
}

/** Nearest enclosing function/component start at or above line `i`; the top of the file if none. */
function enclosingScopeStart(lines: string[], i: number): number {
  for (let k = i; k >= 0; k--) if (isScopeBoundary(lines[k] ?? "")) return k;
  return 0;
}

function nearConditional(lines: string[], i: number, re: RegExp): boolean {
  const start = enclosingScopeStart(lines, i);
  for (let k = start; k <= i; k++) if (re.test(lines[k] ?? "")) return true;
  return false;
}

/** `const NAME =` on this line or the one above: the literal is a named constant. */
function constName(lines: string[], i: number): { name: string; declLines: number[] } | null {
  for (const k of [i, i - 1]) {
    if (k < 0) continue;
    const m = /^\s*(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=/.exec(lines[k] ?? "");
    if (m?.[1]) return { name: m[1], declLines: k === i ? [i] : [k, i] };
  }
  return null;
}

type Scan = { hits: string[]; problems: string[]; carriers: Set<string> };

function scan(): Scan {
  const out: Scan = { hits: [], problems: [], carriers: new Set() };
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).split(sep).join("/");
    const src = stripComments(readFileSync(file, "utf8"));
    const lines = src.split("\n");
    const imports = importsHouseLaunched(src);
    const re = conditionalRe(derivedNames(src));
    lines.forEach((line, i) => {
      for (const lit of LITERALS) {
        if (!line.includes(lit)) continue;
        const where = `${rel}:${i + 1}`;
        const allow = ALLOWLIST[rel];
        if (allow && allow.literals.includes(lit)) {
          out.hits.push(`${where} "${lit}" (allowlisted: ${allow.why})`);
          continue;
        }
        out.hits.push(`${where} "${lit}"`);
        out.carriers.add(rel);
        if (!imports) {
          out.problems.push(`${where} "${lit}": file does not import houseLaunched`);
          continue;
        }
        const c = constName(lines, i);
        if (c) {
          const useRe = new RegExp(`\\b${c.name}\\b`);
          const uses = lines
            .map((l, k) => ({ l, k }))
            .filter(({ l, k }) => !c.declLines.includes(k) && useRe.test(l));
          if (uses.length === 0) out.problems.push(`${where} "${lit}": ${c.name} is never used`);
          for (const { k } of uses) {
            if (!nearConditional(lines, k, re)) {
              out.problems.push(
                `${rel}:${k + 1} ${c.name} ("${lit}") is used outside a houseLaunched() branch`,
              );
            }
          }
        } else if (!nearConditional(lines, i, re)) {
          out.problems.push(`${where} "${lit}": rendered outside a houseLaunched() branch`);
        }
      }
    });
  }
  return out;
}

describe("pre-launch literals", () => {
  const result = scan();

  it("each sits in a file that imports houseLaunched, inside a launched branch", () => {
    assert.deepEqual(result.problems, [], result.problems.join("\n"));
  });

  it("the walk finds the known carriers, so the guard is not vacuous", () => {
    for (const f of KNOWN_CARRIERS) {
      assert.ok(
        result.carriers.has(f),
        `${f} no longer carries a pre-launch literal; update KNOWN_CARRIERS`,
      );
    }
    assert.ok(result.hits.length >= KNOWN_CARRIERS.length, result.hits.join("\n"));
  });

  it("the allowlist names only literals that exist", () => {
    for (const [rel, { literals }] of Object.entries(ALLOWLIST)) {
      const src = stripComments(readFileSync(join(SRC, ...rel.split("/")), "utf8"));
      for (const literal of literals) {
        assert.ok(
          src.includes(literal),
          `${rel} no longer contains "${literal}"; drop it from the allowlist`,
        );
      }
    }
  });
});
