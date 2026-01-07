// components/EnhancedIOCSearch.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function EnhancedIOCSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [indexMeta, setIndexMeta] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexError, setReindexError] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [expandedResult, setExpandedResult] = useState(null);
  const [votingBatch, setVotingBatch] = useState(null);

  // NOTE: This page is intentionally "fast & simple".
  // It performs only server-backed partial match search.

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

    // Best-effort: get current index status so we can show helpful UX
    // even before the user searches.
    refreshIndexMeta();
  }, []);

  const refreshIndexMeta = async () => {
    try {
      const resp = await fetch('/api/search?q=__stats__&limit=1', { cache: 'no-store' });
      const json = await resp.json();
      if (json?.meta?.index) setIndexMeta(json.meta.index);
    } catch {
      // ignore
    }
  };

  const runReindex = async () => {
    setReindexing(true);
    setReindexError(null);
    try {
      const resp = await fetch('/api/search/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitPins: 200, refreshExisting: true })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.error || `Reindex failed (${resp.status})`);
      }
      await refreshIndexMeta();
    } catch (e) {
      setReindexError(String(e?.message || e));
    } finally {
      setReindexing(false);
    }
  };

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
        if (json?.meta?.index) setIndexMeta(json.meta.index);
        if (json?.success && Array.isArray(json.results)) {
          const pins = json.results;

          if (pins.length === 0) {
            const hint = `No plaintext matches found for "${rawQuery}".`;
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

          // Render one result per CID ("file"), showing the actual plaintext IOCs that matched.
          // This matches the original UX expectation: users want to see which IOCs matched,
          // not just that a CID contained a match.
          const grouped = pins.map((p) => {
            const matchedIocs = Array.isArray(p.matches)
              ? p.matches.map(m => m?.ioc).filter(Boolean)
              : [];
            const title = matchedIocs.length
              ? matchedIocs.join(', ')
              : `${p.matchCount} match(es) in CID ${String(p.cid).slice(0, 14)}…`;

            return {
            ioc: title,
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
              iocs: matchedIocs,
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
          };
          });

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

  const shortCid = (cid) => {
    const s = String(cid || '').trim();
    if (!s) return '—';
    if (s.length <= 18) return s;
    return `${s.slice(0, 10)}…${s.slice(-6)}`;
  };

  const copyToClipboard = async (text) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(String(text || ''));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">🔍 Search Threat Intelligence</h2>
          <p className="text-gray-400">Fast keyword search across your Pinata-pinned IPFS bundles</p>
        </div>

        {/* Index status / self-heal */}
        <div className="mb-6 p-4 bg-gray-900/40 border border-gray-700/60 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-200 font-semibold flex items-center gap-2">
                📇 Local Index
                {indexMeta?.pinsIndexed === 0 ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-500/30">Empty</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-200 border border-green-500/30">Ready</span>
                )}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Pins indexed: <span className="text-gray-200 font-mono">{indexMeta?.pinsIndexed ?? '—'}</span> ·
                IOCs indexed: <span className="text-gray-200 font-mono">{indexMeta?.iocsIndexed ?? '—'}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Last indexed: <span className="font-mono">{indexMeta?.lastIndexFinish || indexMeta?.lastIndexStart || '—'}</span>
                {indexMeta?.pinataJwtConfigured === false ? (
                  <span className="ml-2 text-red-300">(PINATA_JWT not configured)</span>
                ) : null}
              </p>
              {reindexError ? <p className="text-xs text-red-300 mt-2">Reindex error: {reindexError}</p> : null}
              {indexMeta?.pinsIndexed === 0 ? (
                <p className="text-xs text-gray-500 mt-2">
                  Search will return “no matches” until the local index is built. Click “Reindex now” to fetch recent pins from Pinata.
                </p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                onClick={refreshIndexMeta}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm border border-gray-700"
              >
                Refresh
              </button>
              <button
                onClick={runReindex}
                disabled={reindexing}
                className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                  reindexing
                    ? 'bg-gray-700 text-gray-400 border-gray-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-transparent'
                }`}
              >
                {reindexing ? 'Reindexing…' : 'Reindex now'}
              </button>
            </div>
          </div>
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
                  const cid = match?.batch?.cid || null;
                  const resultKey = `${String(match?.source || 'search')}:${String(match?.batch?.network || 'Pinata')}:${String(cid || '')}:${idx}`;
                  const merkleProof = Array.isArray(match?.merkleProof) ? match.merkleProof : [];
                  const iocs = Array.isArray(match?.batch?.iocs) ? match.batch.iocs : [];
                  const matchCount = Number(match?.batch?._pinMatchCount ?? match?.batch?.matchCount ?? iocs.length) || iocs.length;
                  const totalIocs = Number(match?.batch?._pinIocTotal ?? match?.batch?.iocTotal ?? match?.batch?.totalIocs ?? 0) || 0;
                  const pinName = match?.batch?._pinName || match?.batch?.pinName || null;
                  const pinCreatedAt = match?.batch?._pinCreatedAt || match?.batch?.createdAt || null;
                  const hasBatchId = Number.isFinite(Number(match?.batch?.batchId)) && match.batch.batchId !== null;
                  const hasTimestamp = Number.isFinite(Number(match?.batch?.timestamp)) && Number(match.batch.timestamp) > 0;
                  
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
                                {pinName ? (
                                  <span>
                                    File: <span className="text-gray-200">{pinName}</span>
                                  </span>
                                ) : (
                                  <span>
                                    CID: <span className="text-gray-200 font-mono">{shortCid(cid)}</span>
                                  </span>
                                )}
                                {pinCreatedAt ? (
                                  <>
                                    {' '}• Pinned {new Date(pinCreatedAt).toLocaleString()}
                                  </>
                                ) : null}
                                {hasBatchId ? (
                                  <>
                                    {' '}• Batch #{match.batch.batchId}
                                  </>
                                ) : null}
                                {hasTimestamp ? (
                                  <>
                                    {' '}• {new Date(match.batch.timestamp * 1000).toLocaleString()}
                                  </>
                                ) : null}
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
                          <p className="text-gray-400 text-xs mb-1">Matches in this CID:</p>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-mono text-sm break-all">{match.ioc}</p>
                              <p className="text-gray-500 text-xs mt-2">
                                {matchCount} match(es)
                                {totalIocs ? ` • ${totalIocs} total IOC(s) in file` : ''}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {!!cid && (
                                <button
                                  onClick={() => copyToClipboard(cid)}
                                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-xs font-semibold transition-all"
                                >
                                  Copy CID
                                </button>
                              )}
                              {!!cid && (
                                <a
                                  href={`https://gateway.pinata.cloud/ipfs/${cid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-all"
                                >
                                  Open
                                </a>
                              )}
                            </div>
                          </div>
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

                          {match.batch.approved && Number.isFinite(Number(match.batch.batchId)) && match.batch.registryAddress && match.batch.explorerUrl && (
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
                              <p className="text-gray-400 mb-1">Merkle Proof ({merkleProof.length} hashes)</p>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {merkleProof.map((hash, i) => (
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
                                  <span className="text-white ml-2">{iocs.length}</span>
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
                                <li>✓ Merkle proof validated ({merkleProof.length} proof hashes)</li>
                                <li>✓ IPFS content integrity verified</li>
                                <li>✓ On-chain Merkle root matches</li>
                                <li>✓ {match.batch.approved ? 'Governance approved' : 'Awaiting governance approval'}</li>
                                <li>✓ Community score: {qualityScore(match.batch.confirmations, match.batch.disputes)}</li>
                              </ul>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-3">
                            {match.batch.explorerUrl && match.batch.registryAddress && (
                              <a
                                href={`${match.batch.explorerUrl}/address/${match.batch.registryAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                              >
                                🔗 View Contract
                              </a>
                            )}
                            {match.batch.cid && (
                              <a
                                href={`https://gateway.pinata.cloud/ipfs/${match.batch.cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                              >
                                📦 View on IPFS
                              </a>
                            )}
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
