import type { DownloadLimitState } from "../types";

export async function reconcileDownloadState(
  readState: () => Promise<DownloadLimitState>,
  accept: (state: DownloadLimitState | null) => void,
) {
  try {
    accept(await readState());
  } catch {
    accept(null);
  }
}
