// Headless deploy wallet, built on @midnight-ntwrk/wallet-sdk 1.2.0 (the
// version the compatibility matrix pairs with Compact toolchain 0.31.1).
//
// This is the one piece that cannot be finished without a live run: the facade
// composes separate shielded, unshielded and dust wallets, and requires an
// explicit Terms and Conditions acceptance whose hash is fetched from the
// indexer at runtime. Accepting terms on someone's behalf is not something
// this script does silently, so the acceptance is surfaced as an explicit,
// logged step below.
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

/**
 * @param {{ seed: string, network: { indexer: string, indexerWs: string, node: string, proofServer: string } }} opts
 * @returns {Promise<{ walletProvider: unknown, midnightProvider: unknown, close?: () => Promise<void> }>}
 */
export async function createDeployWallet({ seed, network }) {
  // Surfaced before anything is signed, so the terms being agreed to are
  // visible in the deploy log rather than accepted invisibly.
  const terms = await WalletFacade.fetchTermsAndConditions({
    indexerClientConnection: { indexerHttpUrl: network.indexer },
  });
  console.log('\nNetwork Terms and Conditions');
  console.log('  url :', terms.url);
  console.log('  hash:', terms.hash);

  if (process.env.MIDNIGHT_ACCEPT_TERMS !== terms.hash) {
    throw new Error(
      'Terms and Conditions have not been accepted for this deploy.\n' +
        `Read ${terms.url}. If you agree, set in .env:\n` +
        `  MIDNIGHT_ACCEPT_TERMS=${terms.hash}\n` +
        'then run the deploy again.',
    );
  }

  throw new Error(
    'Wallet construction is not finished yet.\n' +
      'The remaining work is composing the shielded, unshielded and dust\n' +
      'wallets from the seed via WalletFacade and adapting them to the\n' +
      'midnight-js WalletProvider (balanceTx, getCoinPublicKey,\n' +
      'getEncryptionPublicKey) and MidnightProvider (submitTx) interfaces.\n' +
      'This needs a funded seed present to iterate against.',
  );
}
