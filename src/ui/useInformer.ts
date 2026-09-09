// All Midnight wiring lives behind this hook, so components stay presentational.
// The provider stack, Lace adapter and contribute flow are unchanged from the
// version that produced the contributions already on Preprod.
import { useCallback, useEffect, useRef, useState } from 'react';

import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { PREPROD, INFORMER_PARAMS, CONTRACT_ADDRESS } from '../config.js';
import { connectLace } from '../lib/lace.js';
import { browserPasswordProvider } from '../lib/privateStorage.js';
import { traceObject, installGlobalErrorLogging, installFetchLogging, describeError } from '../lib/instrument.js';
import { contribute, readPublicState, PRIVATE_STATE_ID } from '../lib/contribute.js';
import { checkProofServer, PROOF_SERVER_COMMAND } from '../lib/proofServer.js';

setNetworkId(PREPROD.networkId);

export type LogKind = 'info' | 'ok' | 'err';
export type LogLine = { id: number; kind: LogKind; text: string; at: number };

export type Bucket = { index: bigint; count: bigint };
export type PublicState = {
  contributionCount: bigint;
  bucketWidth: bigint;
  kAnonymityFloor: bigint;
  nullifierCount: bigint;
  buckets: Bucket[];
};

export type Receipt = {
  raw: bigint;
  bucket: bigint;
  low: bigint;
  high: bigint;
  tx?: string;
};

export type Phase = 'idle' | 'working' | 'accepted' | 'rejected';

let logId = 0;

export function useInformer() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [dust, setDust] = useState<{ balance: bigint; cap: bigint } | null>(null);
  const [proofServerOk, setProofServerOk] = useState<boolean | null>(null);
  const [state, setState] = useState<PublicState | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const session = useRef<any>(null);
  const providers = useRef<any>(null);

  const log = useCallback((text: string, kind: LogKind = 'info') => {
    setLogs((prev) => [{ id: logId++, kind, text, at: Date.now() }, ...prev].slice(0, 200));
  }, []);

  useEffect(() => {
    installGlobalErrorLogging(log);
    installFetchLogging(log);
  }, [log]);

  const publicOnly = useCallback(
    () => ({
      publicDataProvider: indexerPublicDataProvider(PREPROD.indexer, PREPROD.indexerWs),
    }),
    [],
  );

  const refreshState = useCallback(async () => {
    const p = providers.current ?? publicOnly();
    const next = await readPublicState(p);
    if (next) setState(next);
    return next;
  }, [publicOnly]);

  const refreshProofServer = useCallback(async () => {
    const result = await checkProofServer();
    setProofServerOk(result.ok);
    return result.ok;
  }, []);

  useEffect(() => {
    refreshState().catch((err) => log(`Could not read public state: ${err.message}`, 'err'));
    refreshProofServer().catch(() => setProofServerOk(false));
  }, [refreshState, refreshProofServer, log]);

  const connect = useCallback(async () => {
    try {
      log('Requesting connection. Approve it in the wallet extension.');
      const s = await connectLace();
      session.current = s;

      const zkConfigProvider = traceObject(
        'zkConfigProvider',
        new FetchZkConfigProvider(`${window.location.origin}/zk/informer`, fetch.bind(window)),
        ['getProverKey', 'getVerifierKey', 'getZKIR', 'get'],
        log,
      );

      providers.current = {
        ...publicOnly(),
        privateStateProvider: levelPrivateStateProvider({
          privateStateStoreName: 'informer-private-state',
          privateStoragePasswordProvider: browserPasswordProvider(),
          accountId: s.addresses.shielded,
        }),
        zkConfigProvider,
        proofProvider: traceObject(
          'proofProvider',
          httpClientProofProvider(PREPROD.proofServer, zkConfigProvider),
          ['proveTx'],
          log,
        ),
        walletProvider: traceObject('walletProvider', s.walletProvider, ['balanceTx', 'getCoinPublicKey', 'getEncryptionPublicKey'], log),
        midnightProvider: traceObject('midnightProvider', s.midnightProvider, ['submitTx'], log),
      };

      setAddress(s.addresses.shielded);
      setConnected(true);
      const d = await s.api.getDustBalance();
      setDust({ balance: d.balance, cap: d.cap });
      log(`Connected via ${s.connectorName}.`, 'ok');
      await refreshProofServer();
    } catch (err: any) {
      log(describeError(err), 'err');
      throw err;
    }
  }, [log, publicOnly, refreshProofServer]);

  const disconnect = useCallback(() => {
    // The connector exposes no revoke call, so disconnecting means dropping
    // every wallet-derived capability the app holds.
    session.current = null;
    providers.current = null;
    setConnected(false);
    setAddress(null);
    setDust(null);
    setReceipt(null);
    setRejection(null);
    setPhase('idle');
    log('Disconnected. Wallet handles and providers dropped.', 'ok');
  }, [log]);

  const submit = useCallback(
    async (raw: bigint) => {
      setPhase('working');
      setRejection(null);
      try {
        if (!(await refreshProofServer())) {
          throw new Error('The local proof server is not reachable.');
        }
        const result = await contribute({ providers: providers.current, raw, log });
        const low = result.bucket * INFORMER_PARAMS.bucketWidth;
        setReceipt({
          raw,
          bucket: result.bucket,
          low,
          high: low + INFORMER_PARAMS.bucketWidth,
          tx: result.txHash ?? result.txId,
        });
        setPhase('accepted');
        log('Contribution accepted.', 'ok');
        await refreshState();
      } catch (err: any) {
        const message = describeError(err);
        log(message, 'err');
        if (/already contributed/i.test(message)) {
          setRejection(
            'Rejected. This participant already contributed in this period, and the contract enforced that without learning who they are.',
          );
          setPhase('rejected');
        } else {
          setRejection(message);
          setPhase('idle');
        }
      }
    },
    [log, refreshProofServer, refreshState],
  );

  const forgetSecret = useCallback(async () => {
    if (!providers.current) return;
    providers.current.privateStateProvider.setContractAddress(CONTRACT_ADDRESS);
    await providers.current.privateStateProvider.remove(PRIVATE_STATE_ID);
    setReceipt(null);
    setRejection(null);
    setPhase('idle');
    log('Local contributor secret deleted. The next contribution generates a new one.', 'ok');
    log('Nothing on chain changed. The ledger is append only.');
  }, [log]);

  return {
    logs, connected, address, dust, proofServerOk, state, phase, receipt, rejection,
    connect, disconnect, submit, forgetSecret, refreshState, refreshProofServer,
    proofServerCommand: PROOF_SERVER_COMMAND as string,
  };
}
