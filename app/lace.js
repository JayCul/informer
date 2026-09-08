// Adapts the Lace DApp connector to the midnight-js WalletProvider and
// MidnightProvider interfaces.
//
// The seed never leaves the extension. This page can ask Lace to balance and
// submit a transaction; it cannot read a key, and there is no seed anywhere in
// this repo or its environment.

const NETWORK_ID = 'preprod';

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
