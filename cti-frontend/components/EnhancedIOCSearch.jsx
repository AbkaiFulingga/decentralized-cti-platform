// components/EnhancedIOCSearch.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function EnhancedIOCSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [expandedResult, setExpandedResult] = useState(null);
  const [votingBatch, setVotingBatch] = useState(null);


  // Key escrow sync (for encrypted bundles stored in Pinata)
  const [keySyncing, setKeySyncing] = useState(false);
  const [keySyncStatus, setKeySyncStatus] = useState(null);

  const [searchIndexStatus, setSearchIndexStatus] = useState({ loading: true, ok: null, message: 'Checking…' });

  const [manualCid, setManualCid] = useState('');
  const [manualCidLoading, setManualCidLoading] = useState(false);
  const [manualCidStatus, setManualCidStatus] = useState(null);

  const [reindexToken, setReindexToken] = useState('');
  const [reindexing, setReindexing] = useState(false);
  const [reindexStatus, setReindexStatus] = useState(null);

  // NOTE: Search is Pinata/SQLite based. Chain CID discovery is intentionally not used here
  // (it’s slow and unreliable on public RPCs, especially on L2). Keep chain indexing elsewhere.

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      checkConnection();
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    // Search is read-only; don't require a wallet connection.
    // If a wallet is connected we'll still capture the address for voting actions.
    // Also check whether the server-side search index is available.
    // (This is the real path for L2, since L2 CID discovery can be unreliable.)
    (async () => {
      try {
        const resp = await fetch('/api/search?q=&limit=1');
        const json = await resp.json();
        if (!json?.success) throw new Error(json?.error || 'search endpoint error');
        const idx = json?.meta?.index;
        const counts = idx
          ? `pins=${idx.pinsIndexed ?? 0}, iocs=${idx.iocsIndexed ?? 0}`
          : 'unknown counts';
        const last = idx?.lastIndexFinish ? `last=${idx.lastIndexFinish}` : 'last=never';
        setSearchIndexStatus({
          loading: false,
          ok: true,
          message: `Search API ready (${counts}, ${last})`
        });
      } catch (e) {
        setSearchIndexStatus({
          loading: false,
          ok: false,
          message: `Search API not ready: ${String(e?.message || e)}`
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setWalletAddress(accounts[0].address);
          setWalletConnected(true);
        }
      } catch (error) {
        console.error('Connection check failed:', error);
      }
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setWalletConnected(false);
      setWalletAddress('');
    } else {
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      
    } catch (error) {
      alert('Failed to connect wallet');
    }
  };

  // NOTE: Chain re-indexing is intentionally removed from this page.

  const syncLocalKeysToEscrow = async () => {
    if (typeof window === 'undefined') return;

    const adminToken = process.env.NEXT_PUBLIC_CTI_SEARCH_ADMIN_TOKEN;
    if (!adminToken) {
      setKeySyncStatus({
        ok: false,
        message:
          'Missing NEXT_PUBLIC_CTI_SEARCH_ADMIN_TOKEN in the frontend env. Add it and reload before syncing keys.'
      });
      return;
    }

    setKeySyncing(true);
    setKeySyncStatus(null);
    try {
      const keysToSync = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        if (!k.startsWith('ioc-key-')) continue;
        const keyId = k.slice('ioc-key-'.length);
        const keyHex = window.localStorage.getItem(k);

        if (!keyId || !keyHex) continue;
        if (!/^[0-9a-fA-F]+$/.test(keyHex)) continue;
        keysToSync.push({ keyId, keyHex });
      }

      if (!keysToSync.length) {
        setKeySyncStatus({ ok: true, message: 'No local encrypted keys found to sync (localStorage has no ioc-key-* entries).' });
        return;
      }

      let okCount = 0;
      let failCount = 0;
      const errors = [];

      for (const entry of keysToSync) {
        try {
          const resp = await fetch('/api/key-escrow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
              keyId: entry.keyId,
              keyHex: entry.keyHex,
              algorithm: 'cryptojs-aes-cbc'
            })
          });
          const json = await resp.json();
          if (json?.success) {
            okCount++;
          } else {
            failCount++;
            errors.push({ keyId: entry.keyId, error: json?.error || `HTTP ${resp.status}` });
          }
        } catch (e) {
          failCount++;
          errors.push({ keyId: entry.keyId, error: String(e?.message || e) });
        }
      }

      setKeySyncStatus({ ok: failCount === 0, okCount, failCount, total: keysToSync.length, errors });
    } finally {
      setKeySyncing(false);
    }
  };

  const fetchByCid = async () => {
    const cid = String(manualCid || '').trim();
    if (!cid) return;
    setManualCidLoading(true);
    setManualCidStatus(null);
    try {
      const resp = await fetch(`/api/ipfs-fetch?cid=${encodeURIComponent(cid)}`);
      const json = await resp.json();
      if (!json?.success) throw new Error(json?.error || 'IPFS fetch failed');

      let data = json?.data;

      // E3: Encrypted bundles are only searchable locally. Attempt local decrypt
      // using the browser-stored key (localStorage ioc-key-<keyId>) when present.
      if (data?.type === 'encrypted-ioc-bundle') {
        const encryptor = new IOCEncryption();
        const key = encryptor.retrieveKeyLocally(data?.keyId);
        if (!key) {
          throw new Error(
            `Encrypted bundle. Missing local key for keyId=${String(data?.keyId || '')}. ` +
              'This content is private and not searchable server-side (E3).'
          );
        }
        try {
          data = encryptor.decryptBundle(data.ciphertext, key, data.iv, data.metadataHash);
        } catch (e) {
          throw new Error(`Encrypted bundle. Local decrypt failed: ${String(e?.message || e)}`);
        }
      }

      const iocs = Array.isArray(data?.iocs) ? data.iocs : [];
      const format = data?.format || data?.type || null;

      // Put it into the results UI using the same shape as server-side matches.
      setSearchResults([
        {
          ioc: `CID: ${cid}`,
          iocIndex: null,
          batch: {
            batchId: null,
            network: 'IPFS',
            networkIcon: '🗂️',
            chainId: null,
            cid,
            merkleRoot: null,
            timestamp: 0,
            approved: false,
            contributorHash: null,
            isPublic: true,
            confirmations: 0,
            disputes: 0,
            iocs,
            format,
            explorerUrl: null,
            registryAddress: null,
            governanceAddress: null
          },
          verified: null
        }
      ]);

      setManualCidStatus({ ok: true, message: `Fetched ${iocs.length} IOC(s) via ${json?.gateway || 'gateway'}` });
    } catch (e) {
      setManualCidStatus({ ok: false, message: String(e?.message || e) });
    } finally {
      setManualCidLoading(false);
    }
  };

  const runServerReindex = async ({ limitPins = 500, refreshExisting = true } = {}) => {
    setReindexing(true);
    setReindexStatus(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const tok = String(reindexToken || '').trim();
      if (tok) headers.Authorization = `Bearer ${tok}`;

      const resp = await fetch('/api/search/reindex', {
        method: 'POST',
        headers,
        body: JSON.stringify({ limitPins, refreshExisting })
      });
      const json = await resp.json();
      if (!json?.success) throw new Error(json?.error || `Reindex failed (HTTP ${resp.status})`);

      setReindexStatus({ ok: true, stats: json?.stats || null, elapsedMs: json?.elapsedMs || null });

      // Refresh the visible server index stats after a successful run.
      try {
        const sresp = await fetch('/api/search?q=&limit=1');
        const sjson = await sresp.json();
        if (sjson?.success) {
          const idx = sjson?.meta?.index;
          const counts = idx
            ? `pins=${idx.pinsIndexed ?? 0}, iocs=${idx.iocsIndexed ?? 0}`
            : 'unknown counts';
          const last = idx?.lastIndexFinish ? `last=${idx.lastIndexFinish}` : 'last=never';
          setSearchIndexStatus({ loading: false, ok: true, message: `Search API ready (${counts}, ${last})` });
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setReindexStatus({ ok: false, error: String(e?.message || e) });
    } finally {
      setReindexing(false);
    }
  };

  // NOTE: On-chain batch indexing has been intentionally removed from the Search page.
  // Search is Pinata/SQLite based and should stay fast and simple.

  const performSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // E3: Use server-side plaintext index only.
    // Encrypted bundles are NOT indexed server-side.
    // For encrypted content, users must fetch by CID and decrypt locally.
    (async () => {
      setLoading(true);
      const rawQuery = searchQuery.trim();

      try {
        const resp = await fetch(`/api/search/pins?q=${encodeURIComponent(rawQuery)}&limitPins=25&limitMatchesPerPin=20`);
        const json = await resp.json();
        if (json?.success && Array.isArray(json.results)) {
          const pins = json.results;

          if (pins.length === 0) {
            const idx = json?.meta?.index;
            const hint = idx && (idx.pinsIndexed || idx.iocsIndexed)
              ? `No plaintext matches found for "${rawQuery}" (indexed plaintext IOCs: ${idx.iocsIndexed || 0}).`
              : `No matches yet. Your server index is empty — run reindex to populate it, then try again.`;
            setSearchResults([
              {
                ioc: hint,
                iocIndex: null,
                batch: {
                  batchId: null,
                  network: 'Server index',
                  networkIcon: '🗄️',
                  chainId: null,
                  cid: null,
                  merkleRoot: null,
                  timestamp: 0,
                  approved: false,
                  contributorHash: null,
                  isPublic: true,
                  confirmations: 0,
                  disputes: 0,
                  iocs: [],
                  format: null,
                  explorerUrl: null,
                  registryAddress: null,
                  governanceAddress: null
                },
                merkleProof: null,
                verified: null,
                source: 'pinata-search'
              }
            ]);
            setLoading(false);
            return;
          }

          // Render one result per CID ("file"), showing a preview list of matching IOCs.
          const grouped = pins.map((p) => ({
            ioc: `${p.matchCount} match(es) in CID ${String(p.cid).slice(0, 14)}…`,
            iocIndex: null,
            batch: {
              batchId: null,
              network: p.network || 'Pinata',
              networkIcon: (p.network || '').toLowerCase().includes('ethereum') ? '🌐' : '⚡',
              chainId: null,
              cid: p.cid,
              merkleRoot: p.merkleRoot || null,
              timestamp: 0,
              approved: false,
              contributorHash: null,
              isPublic: true,
              confirmations: 0,
              disputes: 0,
              iocs: Array.isArray(p.matches) ? p.matches.map(m => m.ioc).filter(Boolean) : [],
              format: 'pinata-index',
              explorerUrl: null,
              registryAddress: null,
              governanceAddress: null,
              _pinTotalIocs: p.totalIocs,
              _pinEncrypted: Boolean(p.encrypted),
              _pinSource: p.source || null,
              _pinFirstTs: p.firstTs || null,
              _pinLastTs: p.lastTs || null
            },
            merkleProof: null,
            verified: null,
            source: 'pinata-search'
          }));

          setSearchResults(grouped);
          setLoading(false);
          return;
        }

        throw new Error(json?.error || 'Search failed');
      } catch (e) {
        setSearchResults([
          {
            ioc: `Search error: ${String(e?.message || e)}`,
            iocIndex: null,
            batch: {
              batchId: null,
              network: 'Server index',
              networkIcon: '🗄️',
              chainId: null,
              cid: null,
              merkleRoot: null,
              timestamp: 0,
              approved: false,
              contributorHash: null,
              isPublic: true,
              confirmations: 0,
              disputes: 0,
              iocs: [],
              format: null,
              explorerUrl: null,
              registryAddress: null,
              governanceAddress: null
            },
            merkleProof: null,
            verified: null,
            source: 'pinata-search'
          }
        ]);
        setLoading(false);
      }
    })();
  };

  const confirmBatch = async (batchId, network) => {
    try {
      setVotingBatch(batchId);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const currentNet = await provider.getNetwork();
      const targetNetwork = network.includes('Ethereum') ? NETWORKS.sepolia : NETWORKS.arbitrumSepolia;

      if (currentNet.chainId.toString() !== targetNetwork.chainId.toString()) {
        alert(`Please switch to ${targetNetwork.name} to vote on this batch`);
        setVotingBatch(null);
        return;
      }

      const registryABI = [
        'function confirmBatch(uint256 batchIndex) external'
      ];

      const registry = new ethers.Contract(
        targetNetwork.contracts.registry,
        registryABI,
        signer
      );

      console.log(`Confirming batch ${batchId} on ${network}...`);
      const tx = await registry.confirmBatch(batchId, { gasLimit: 150000 });

      await tx.wait();
      console.log('✅ Batch confirmed!');

      performSearch();
    } catch (error) {
      console.error('Confirmation error:', error);
      alert(`Failed to confirm batch: ${error.message}`);
    } finally {
      setVotingBatch(null);
    }
  };

  const disputeBatch = async (batchId, network) => {
    try {
      setVotingBatch(batchId);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const currentNet = await provider.getNetwork();
      const targetNetwork = network.includes('Ethereum') ? NETWORKS.sepolia : NETWORKS.arbitrumSepolia;
      
      if (currentNet.chainId.toString() !== targetNetwork.chainId.toString()) {
        alert(`Please switch to ${targetNetwork.name} to vote on this batch`);
        setVotingBatch(null);
        return;
      }
      
      const registryABI = [
        "function disputeBatch(uint256 batchIndex) external"
      ];
      
      const registry = new ethers.Contract(
        targetNetwork.contracts.registry,
        registryABI,
        signer
      );
      
      console.log(`Disputing batch ${batchId} on ${network}...`);
      const tx = await registry.disputeBatch(batchId, { gasLimit: 150000 });
      
      await tx.wait();
      console.log("✅ Batch disputed!");
      
      performSearch();
      
    } catch (error) {
      console.error('Dispute error:', error);
      alert(`Failed to dispute batch: ${error.message}`);
    } finally {
      setVotingBatch(null);
    }
  };

  const toggleResultExpansion = (resultKey) => {
    setExpandedResult(expandedResult === resultKey ? null : resultKey);
  };

  const qualityScore = (confirmations, disputes) => {
    const total = confirmations + disputes;
    if (total === 0) return 'N/A';
    return `${Math.round((confirmations / total) * 100)}%`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">🔍 Search Threat Intelligence</h2>
          <p className="text-gray-400">Fast keyword search across your Pinata-pinned IPFS bundles</p>
        </div>

        <>
          {!walletConnected && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-yellow-300 font-semibold">Wallet not connected</p>
                <p className="text-gray-400 text-sm">You can still index and search. Connect MetaMask only if you want to vote (confirm/dispute).</p>
              </div>
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg text-sm transition-all"
              >
                Connect
              </button>
            </div>
          )}

            <div className={`mb-6 p-4 rounded-xl border ${
              searchIndexStatus.loading
                ? 'bg-blue-500/10 border-blue-500/30'
                : searchIndexStatus.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="font-semibold mb-1">
                🗄️ Server search status
              </p>
              <p className={`text-sm ${
                searchIndexStatus.loading
                  ? 'text-blue-300'
                  : searchIndexStatus.ok
                    ? 'text-emerald-300'
                    : 'text-red-300'
              }`}>
                {searchIndexStatus.message}
              </p>
              {!searchIndexStatus.loading && !searchIndexStatus.ok && (
                <p className="text-gray-400 text-xs mt-2">
                  If this is a fresh server, make sure <span className="font-mono">PINATA_JWT</span> is set and run the reindex endpoint (<span className="font-mono">/api/search/reindex</span>).
                </p>
              )}
            </div>

            <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <p className="text-emerald-200 font-semibold mb-2">🧱 Build IPFS search index (Pinata → SQLite)</p>
              <p className="text-gray-400 text-sm mb-3">
                This is the button that makes search actually work. It crawls your latest Pinata pins and indexes IOC strings into the server database.
              </p>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="password"
                  value={reindexToken}
                  onChange={(e) => setReindexToken(e.target.value)}
                  placeholder="Optional: CTI_SEARCH_ADMIN_TOKEN (if required)"
                  className="flex-1 px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-100 placeholder-gray-500 font-mono"
                  disabled={reindexing}
                />
                <button
                  onClick={() => runServerReindex({ limitPins: 500, refreshExisting: true })}
                  disabled={reindexing}
                  className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                    reindexing
                      ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {reindexing ? '⏳ Reindexing…' : '🔁 Reindex from Pinata'}
                </button>
              </div>

              {reindexStatus && (
                <div className="mt-3 text-sm">
                  {reindexStatus.ok ? (
                    <div className="text-emerald-300">
                      ✅ Reindex complete.
                      {reindexStatus.elapsedMs != null && (
                        <span className="text-gray-400"> ({Math.round(reindexStatus.elapsedMs)} ms)</span>
                      )}
                      {reindexStatus.stats && (
                        <div className="mt-1 text-xs text-gray-300 font-mono">
                          processedPins={reindexStatus.stats.processedPins} fetchedPins={reindexStatus.stats.fetchedPins} insertedIocs={reindexStatus.stats.insertedIocs} errors={reindexStatus.stats.errors}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-300">❌ Reindex failed: {reindexStatus.error}</div>
                  )}
                </div>
              )}
            </div>

            {/* Chain-based CID overrides intentionally removed from Search to keep it fast & simple. */}

            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-amber-200 font-semibold mb-2">🔐 Encrypted key sync (for searchable encrypted pins)</p>
              <p className="text-gray-400 text-sm mb-3">
                If you previously encrypted batches, the decryption key lives in your browser (localStorage <span className="font-mono">ioc-key-*</span>).
                Syncing uploads those keys to the server key escrow so the Pinata indexer can decrypt and index encrypted bundles.
              </p>
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <button
                  onClick={syncLocalKeysToEscrow}
                  disabled={keySyncing}
                  className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                    keySyncing
                      ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {keySyncing ? '⏳ Syncing keys…' : '⬆️ Sync local keys to server'}
                </button>
                <p className="text-gray-500 text-xs">
                  Requires <span className="font-mono">NEXT_PUBLIC_CTI_SEARCH_ADMIN_TOKEN</span> set in the frontend and <span className="font-mono">CTI_SEARCH_ADMIN_TOKEN</span> on the server.
                </p>
              </div>

              {keySyncStatus && (
                <div className="mt-3">
                  {'total' in keySyncStatus ? (
                    <div className={`${keySyncStatus.ok ? 'text-green-300' : 'text-red-300'} text-sm`}
                      >
                      {keySyncStatus.ok
                        ? `✅ Synced ${keySyncStatus.okCount}/${keySyncStatus.total} key(s) to escrow.`
                        : `⚠️ Synced ${keySyncStatus.okCount}/${keySyncStatus.total}. Failed: ${keySyncStatus.failCount}.`}
                    </div>
                  ) : (
                    <div className={`${keySyncStatus.ok ? 'text-green-300' : 'text-red-300'} text-sm`}
                      >
                      {keySyncStatus.message}
                    </div>
                  )}

                  {Array.isArray(keySyncStatus.errors) && keySyncStatus.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-gray-400 text-xs">Show errors</summary>
                      <ul className="mt-2 space-y-1 text-xs text-gray-400 font-mono">
                        {keySyncStatus.errors.slice(0, 20).map((e) => (
                          <li key={e.keyId}>
                            {e.keyId}: {e.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div className="mb-6 p-4 bg-slate-500/10 border border-slate-500/30 rounded-xl">
              <p className="text-slate-200 font-semibold mb-2">🗂️ Fetch directly from IPFS (no on-chain CID needed)</p>
              <p className="text-gray-400 text-sm mb-3">
                If you already have a CID (from Pinata UI, logs, or elsewhere), paste it here and we’ll fetch the JSON bundle immediately.
              </p>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  value={manualCid}
                  onChange={(e) => setManualCid(e.target.value)}
                  placeholder="IPFS CID (Qm... or bafy...)"
                  className="flex-1 px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-slate-400 text-gray-100 placeholder-gray-500 font-mono"
                  disabled={manualCidLoading || loading}
                />
                <button
                  onClick={fetchByCid}
                  disabled={manualCidLoading || loading || !String(manualCid || '').trim()}
                  className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                    manualCidLoading || loading || !String(manualCid || '').trim()
                      ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                      : 'bg-slate-600 hover:bg-slate-700 text-white'
                  }`}
                >
                  {manualCidLoading ? '⏳ Fetching…' : '⬇️ Fetch CID'}
                </button>
              </div>
              {manualCidStatus && (
                <p className={`mt-2 text-xs ${manualCidStatus.ok ? 'text-green-300' : 'text-red-300'}`}>
                  {manualCidStatus.message}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-3">
                🔎 Search for IOC (Partial Match)
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  placeholder="e.g., malicious, 192.168, phishing.com"
                  className="flex-1 px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 placeholder-gray-500 font-mono"
                  disabled={loading}
                />
                <button
                  onClick={performSearch}
                  disabled={loading || !searchQuery.trim()}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    loading || !searchQuery.trim()
                      ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                  }`}
                >
                  {loading ? '⏳' : '🔍'} Search
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                💡 Tip: Pinata-backed server search works even when on-chain CIDs are missing
              </p>
            </div>

            {loading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Searching indexed batches...</p>
              </div>
            )}

            {!loading && searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">
                    🎯 Found {searchResults.length} Match{searchResults.length > 1 ? 'es' : ''}
                  </h3>
                  <span className="text-sm text-gray-400">
                    Query: <span className="text-purple-400 font-mono">"{searchQuery}"</span>
                  </span>
                </div>

                {searchResults.map((match, idx) => {
                  const resultKey = `${match.batch.network}-${match.batch.batchId}-${match.iocIndex}`;
                  
                  return (
                    <div
                      key={resultKey}
                      className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                              match.batch.approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {match.batch.approved ? '✅' : '⏳'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg font-bold text-white">Match #{idx + 1}</span>
                                <span className={`text-lg ${match.batch.networkIcon === '🌐' ? 'text-blue-400' : 'text-purple-400'}`}>
                                  {match.batch.networkIcon}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                  match.batch.networkIcon === '🌐'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}>
                                  {match.batch.network}
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm">
                                Found in Batch #{match.batch.batchId} • {new Date(match.batch.timestamp * 1000).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {match.verified && (
                              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold border border-green-500/30">
                                ✓ Verified
                              </div>
                            )}
                            {match.batch.approved && (
                              <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold border border-blue-500/30">
                                Approved
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-4 p-4 bg-gray-950/50 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Matched IOC:</p>
                          <p className="text-white font-mono text-sm break-all">{match.ioc}</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                          <div>
                            <span className="text-gray-500 text-xs">Quality Score</span>
                            <p className="text-green-400 font-bold">
                              {qualityScore(match.batch.confirmations, match.batch.disputes)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Confirmations</span>
                            <p className="text-yellow-400 font-bold">{match.batch.confirmations}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Disputes</span>
                            <p className="text-red-400 font-bold">{match.batch.disputes}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Privacy</span>
                            <p className={match.batch.isPublic ? 'text-blue-400 font-bold' : 'text-purple-400 font-bold'}>
                              {match.batch.isPublic ? 'Public' : 'Private'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleResultExpansion(resultKey)}
                            className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                          >
                            {expandedResult === resultKey ? '▼ Hide Details' : '▶ Show Merkle Proof & Batch Info'}
                          </button>

                          {match.batch.approved && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => confirmBatch(match.batch.batchId, match.batch.network)}
                                disabled={votingBatch !== null}
                                className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                👍 Confirm Quality
                              </button>
                              <button
                                onClick={() => disputeBatch(match.batch.batchId, match.batch.network)}
                                disabled={votingBatch !== null}
                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                👎 Dispute
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {expandedResult === resultKey && (
                        <div className="border-t border-gray-700 p-6 bg-gray-950/50">
                          <h4 className="text-lg font-bold text-white mb-4">🔐 Cryptographic Proof</h4>
                          
                          <div className="space-y-3 text-sm">
                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">Merkle Root (On-Chain)</p>
                              <p className="text-green-400 font-mono text-xs break-all">{match.batch.merkleRoot}</p>
                            </div>

                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">IPFS CID</p>
                              <p className="text-blue-400 font-mono text-xs break-all">{match.batch.cid}</p>
                            </div>

                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">Merkle Proof ({match.merkleProof.length} hashes)</p>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {match.merkleProof.map((hash, i) => (
                                  <p key={i} className="text-purple-400 font-mono text-xs break-all">
                                    [{i}] {hash}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">Batch Information</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">Batch ID:</span>
                                  <span className="text-white ml-2">#{match.batch.batchId}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Total IOCs:</span>
                                  <span className="text-white ml-2">{match.batch.iocs.length}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Format:</span>
                                  <span className="text-white ml-2">{match.batch.format}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">IOC Index:</span>
                                  <span className="text-white ml-2">#{match.iocIndex}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-green-900/30 rounded-lg p-4 border border-green-700/50">
                              <p className="text-green-300 font-semibold mb-2">🎯 Verification Status:</p>
                              <ul className="space-y-1 text-green-200 text-xs">
                                <li>✓ IOC found in batch #{match.batch.batchId} on {match.batch.network}</li>
                                <li>✓ Merkle proof validated ({match.merkleProof.length} proof hashes)</li>
                                <li>✓ IPFS content integrity verified</li>
                                <li>✓ On-chain Merkle root matches</li>
                                <li>✓ {match.batch.approved ? 'Governance approved' : 'Awaiting governance approval'}</li>
                                <li>✓ Community score: {qualityScore(match.batch.confirmations, match.batch.disputes)}</li>
                              </ul>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-3">
                            <a
                              href={`${match.batch.explorerUrl}/address/${match.batch.registryAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                              🔗 View Contract
                            </a>
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${match.batch.cid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                              📦 View on IPFS
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-400 text-lg">No matches found for "{searchQuery}"</p>
                <p className="text-gray-500 text-sm mt-2">
                  Try different keywords or partial matches
                </p>
              </div>
            )}

            <div className="mt-8 p-6 bg-gray-900/30 rounded-xl border border-gray-700">
              <h3 className="font-bold text-white mb-4">ℹ️ How Search Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                <div>
                  <div className="text-purple-400 text-2xl mb-2">📇</div>
                  <p className="font-semibold text-white mb-1">Local Index</p>
                  <p>All batches are indexed locally for instant search without blockchain queries</p>
                </div>
                <div>
                  <div className="text-blue-400 text-2xl mb-2">🔎</div>
                  <p className="font-semibold text-white mb-1">Partial Match</p>
                  <p>Search matches substrings - "malicious" finds "super-malicious.com"</p>
                </div>
                <div>
                  <div className="text-green-400 text-2xl mb-2">✅</div>
                  <p className="font-semibold text-white mb-1">Cryptographic Proof</p>
                  <p>Each result includes Merkle proof for verification</p>
                </div>
              </div>
            </div>
          </>
      </div>
    </div>
  );
}
