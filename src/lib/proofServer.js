// Proof server detection.
//
// Proving happens on a proof server the visitor runs locally. A hosted copy of
// this page can reach it, because browsers treat localhost as a trustworthy
// origin and do not block HTTPS to it as mixed content, but it only exists if
// the visitor started it.
//
// Rather than let a contribution fail somewhere deep in the provider stack, the
// page checks up front and says exactly what is missing.
import { PREPROD } from '../config.js';

export const PROOF_SERVER_COMMAND =
  'docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v';

/**
 * @returns {Promise<{ok: boolean, url: string, detail: string}>}
 */
export async function checkProofServer(url = PREPROD.proofServer, timeoutMs = 4000) {
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, url, detail: `responded ${res.status}` };
    }
    return { ok: true, url, detail: 'reachable' };
  } catch (err) {
    const reason =
      err.name === 'TimeoutError' ? 'timed out' : 'no response';
    return { ok: false, url, detail: reason };
  }
}
