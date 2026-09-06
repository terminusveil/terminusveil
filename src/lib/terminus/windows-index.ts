import indexJson from "../../../data/windows/index.json" with { type: "json" };
import type { WindowsEntry, WindowsIndex } from "./windows.ts";

/** The committed windows reading, captured by `npm run windows`. Empty (toBlock 0) until the owner runs it. */
export const WINDOWS_INDEX: WindowsIndex = {
  readAt: String(indexJson.readAt ?? ""),
  toBlock: Number(indexJson.toBlock ?? 0),
  byAddress: (indexJson.byAddress ?? {}) as unknown as Record<string, WindowsEntry>,
};
