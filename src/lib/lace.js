// Adapts the Lace DApp connector to the midnight-js WalletProvider and
// MidnightProvider interfaces.
//
// The seed never leaves the extension. This page can ask Lace to balance and
// submit a transaction; it cannot read a key, and there is no seed anywhere in
// this repo or its environment.

import { PREPROD } from '../config.js';
import {
  encodeForWallet,
  decodeFromWallet,
  watchIdentifier,
} from './txcodec.js';
import { describeError } from './instrument.js';

const NETWORK_ID = PREPROD.networkId;

/** Reads the network segment out of a bech32m address's human-readable part. */
export function networkOfAddress(address) {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  const parts = hrp.split('_');
  // mn_shield-addr_preprod -> preprod;  mn_shield-addr -> mainnet
  return parts.length >= 3 ? parts[parts.length - 1] : 'mainnet';
}

// The connector API this app is written against (@midnight-ntwrk/dapp-connector-api 4.x).
const WANTED_API_MAJOR = 4;

/**
 * Every Midnight wallet injected into this page. Wallets inject at
 * window.midnight.{walletId}, several can coexist, and the connector spec
 * expects dApps to choose by apiVersion rather than take the first entry.
 */
export function listMidnightWallets() {
  const wallets = (typeof window !== 'undefined' && window.midnight) || {};
  return Object.entries(wallets)
    .filter(([, w]) => w && typeof w.connect === 'function')
    .map(([key, w]) => ({
      key,
      name: String(w.name ?? key),
      rdns: w.rdns ? String(w.rdns) : '',
      apiVersion: w.apiVersion ? String(w.apiVersion) : 'unknown',
      connector: w,
    }));
}

const majorOf = (v) => {
  const m = /^(\d+)/.exec(v);
  return m ? Number(m[1]) : NaN;
};
const looksLikeLace = (c) => /lace/i.test(`${c.key} ${c.name} ${c.rdns}`);

// Lower sorts first: matching API version, then Lace, then everything else.
const rank = (c) =>
  (majorOf(c.apiVersion) === WANTED_API_MAJOR ? 0 : 2) + (looksLikeLace(c) ? 0 : 1);

/** Waits briefly for extensions to inject, then returns candidates, best first. */
export async function findWalletCandidates({ timeoutMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = listMidnightWallets();
    if (found.length) return found.sort((a, b) => rank(a) - rank(b));
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    'No Midnight wallet found. Install the Lace extension, unlock it, and set it to Preprod.',
  );
}

/** Kept for callers that want a single connector. */
export async function findLace(opts) {
  return (await findWalletCandidates(opts))[0].connector;
}

export async function connectLace() {
  const candidates = await findWalletCandidates();

  // Try each injected wallet, best first. A stale or legacy entry can fail
  // either in connect() or on the first calls after it, so both are inside
  // the attempt and a failure falls through to the next candidate.
  const failures = [];
  let chosen = null;
  let api = null;
  let shielded;
  let unshielded;
  let dust;
  for (const c of candidates) {
    try {
      const a = await c.connector.connect(NETWORK_ID);
      [shielded, unshielded, dust] = await Promise.all([
        a.getShieldedAddresses(),
        a.getUnshieldedAddress(),
        a.getDustAddress(),
      ]);
      api = a;
      chosen = c;
      break;
    } catch (err) {
      failures.push(`window.midnight.${c.key} (${c.name}, api ${c.apiVersion}): ${describeError(err)}`);
    }
  }
  if (!api) {
    throw new Error(
      `No injected wallet would connect. Tried ${candidates.length}: ${failures.join(' | ')}`,
    );
  }

  // Catch the common case of Lace being pointed at another network before any
  // transaction is built, rather than failing deep inside key parsing.
  const walletNetwork = networkOfAddress(shielded.shieldedAddress);
  if (walletNetwork !== NETWORK_ID) {
    throw new Error(
      `Wallet is on ${walletNetwork}, but this app targets ${NETWORK_ID}. ` +
        `Switch the Lace network to ${NETWORK_ID} and reconnect.`,
    );
  }

  const walletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
    // midnight-js hands over an unbalanced transaction; Lace balances it and
    // pays fees, prompting the user. midnight-js expects a transaction object
    // back, not a string, so the wallet's response is parsed before returning.
    balanceTx: async (tx) => {
      const { tx: balanced } = await api.balanceUnsealedTransaction(
        encodeForWallet(tx),
        { payFees: true },
      );
      return decodeFromWallet(balanced);
    },
  };

  const midnightProvider = {
    // The connector's submitTransaction resolves to void, so the identifier to
    // watch for is taken from the transaction itself. identifiers() is the set
    // the ledger documents as usable for watching; transactionHash() is
    // explicitly not, because transactions can be merged.
    submitTx: async (tx) => {
      const identifier = watchIdentifier(tx);
      try {
        await api.submitTransaction(encodeForWallet(tx));
      } catch (err) {
        // The connector rejects with plain objects. Preserve the detail and
        // the original, rather than letting it collapse to [object Object].
        const detail = describeError(err);
        throw new Error(`Wallet rejected the submission: ${detail}`, { cause: err });
      }
      return identifier;
    },
  };

  return {
    api,
    connectorName: `${chosen.name} (api ${chosen.apiVersion})`,
    addresses: {
      shielded: shielded.shieldedAddress,
      unshielded: unshielded.unshieldedAddress,
      dust: dust.dustAddress,
    },
    walletProvider,
    midnightProvider,
  };
}
