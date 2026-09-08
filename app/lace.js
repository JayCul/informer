// Adapts the Lace DApp connector to the midnight-js WalletProvider and
// MidnightProvider interfaces.
//
// The seed never leaves the extension. This page can ask Lace to balance and
// submit a transaction; it cannot read a key, and there is no seed anywhere in
// this repo or its environment.

import { PREPROD } from '../src/config.js';

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
    // pays fees, prompting the user.
    balanceTx: async (tx) => {
      const serialized = typeof tx === 'string' ? tx : tx.serialize();
      const { tx: balanced } = await api.balanceUnsealedTransaction(serialized, {
        payFees: true,
      });
      return balanced;
    },
  };

  const midnightProvider = {
    // KNOWN LIMITATION. MidnightProvider.submitTx must return a transaction
    // identifier, but the connector's submitTransaction resolves to void, so
    // there is nothing to return. Handing back the serialized transaction lets
    // submission succeed but breaks the confirmation watch, which then queries
    // the indexer with this value in place of a transaction hash and fails
    // with IndexerQueryError: Failed to fetch.
    //
    // The transaction is submitted and the contract does deploy. Recover the
    // address with scripts/find-contract.mjs until this computes a real hash
    // from the balanced transaction.
    submitTx: async (tx) => {
      const serialized = typeof tx === 'string' ? tx : tx.serialize();
      await api.submitTransaction(serialized);
      return serialized;
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
