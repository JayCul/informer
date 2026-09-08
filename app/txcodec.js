// Transaction encoding between midnight-js and the Lace DApp connector.
//
// midnight-js hands the wallet provider ledger Transaction objects and expects
// one back. The connector speaks serialized strings in both directions. These
// helpers bridge the two, and crucially let submitTx return a real transaction
// identifier instead of the serialized blob.
import { Transaction } from '@midnight-ntwrk/midnight-js-types';

// The markers midnight-js itself uses when deserializing a transaction from
// the indexer, in midnight-js-indexer-public-data-provider.
const MARKERS = ['signature', 'proof', 'binding'];

const HEX = /^[0-9a-fA-F]+$/;

export const bytesToHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex) =>
  new Uint8Array(hex.match(/../g).map((pair) => parseInt(pair, 16)));

const base64ToBytes = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Serializes whatever midnight-js handed us into the string the wallet wants. */
export const encodeForWallet = (tx) => {
  if (typeof tx === 'string') return tx;
  if (tx instanceof Uint8Array) return bytesToHex(tx);
  if (typeof tx?.serialize === 'function') {
    const raw = tx.serialize();
    return raw instanceof Uint8Array ? bytesToHex(raw) : String(raw);
  }
  throw new Error(
    `Cannot serialize transaction for the wallet: unexpected type ${typeof tx}`,
  );
};

/** Parses the wallet's serialized transaction back into a ledger Transaction. */
export const decodeFromWallet = (value) => {
  if (value && typeof value === 'object' && typeof value.identifiers === 'function') {
    return value;
  }
  if (typeof value !== 'string') {
    throw new Error(
      `Wallet returned an unexpected transaction type: ${typeof value}`,
    );
  }
  // Even-length hex is the documented shape; base64 is accepted defensively
  // because the connector's encoding is not specified anywhere.
  const bytes =
    HEX.test(value) && value.length % 2 === 0
      ? hexToBytes(value)
      : base64ToBytes(value);
  return Transaction.deserialize(...MARKERS, bytes);
};

/**
 * The identifier to watch for. The ledger documents transactionHash() as
 * unsuitable for this because transactions can be merged, and identifiers()
 * as the set that may be used to watch for a specific transaction.
 */
export const watchIdentifier = (tx) => {
  if (typeof tx?.identifiers !== 'function') {
    throw new Error(
      'Balanced transaction has no identifiers(); cannot watch for confirmation.',
    );
  }
  const ids = tx.identifiers();
  if (!ids || ids.length === 0) {
    throw new Error('Balanced transaction produced no identifiers.');
  }
  return ids[0];
};
