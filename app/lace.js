// Adapts the Lace DApp connector to the midnight-js WalletProvider and
// MidnightProvider interfaces.
//
// The seed never leaves the extension. This page can ask Lace to balance and
// submit a transaction; it cannot read a key, and there is no seed anywhere in
// this repo or its environment.

import { PREPROD } from '../src/config.js';
import {
  encodeForWallet,
  decodeFromWallet,
  watchIdentifier,
} from './txcodec.js';

const NETWORK_ID = PREPROD.networkId;

/** Reads the network segment out of a bech32m address's human-readable part. */
export function networkOfAddress(address) {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  const parts = hrp.split('_');
  // mn_shield-addr_preprod -> preprod;  mn_shield-addr -> mainnet
  return parts.length >= 3 ? parts[parts.length - 1] : 'mainnet';
}

/** Discover the injected Lace connector, waiting briefly for extension inject. */
export async function findLace({ timeoutMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const wallets = window.midnight ?? {};
    const entry = Object.values(wallets).find(
      (w) => w && typeof w.connect === 'function',
    );
    if (entry) return entry;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    'No Midnight wallet found. Install the Lace extension, unlock it, and set it to Preprod.',
  );
}

/**
 * Connect and return providers plus a little wallet info for the UI.
 * Connecting prompts the user in the extension; nothing happens silently.
 */
export async function connectLace() {
  const connector = await findLace();
  const api = await connector.connect(NETWORK_ID);

  const [shielded, unshielded, dust] = await Promise.all([
    api.getShieldedAddresses(),
    api.getUnshieldedAddress(),
    api.getDustAddress(),
  ]);

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
      await api.submitTransaction(encodeForWallet(tx));
      return identifier;
    },
  };

  return {
    api,
    connectorName: connector.name ?? 'wallet',
    addresses: {
      shielded: shielded.shieldedAddress,
      unshielded: unshielded.unshieldedAddress,
      dust: dust.dustAddress,
    },
    walletProvider,
    midnightProvider,
  };
}
