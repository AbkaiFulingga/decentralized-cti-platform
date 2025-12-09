"use client";

import { useState, useEffect } from 'react';
import NavBar from '@/components/NavBar';

export default function SecurityDemoPage() {
  const [attackResults, setAttackResults] = useState(null);
  const [runningAttack, setRunningAttack] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExistingResults();
  }, []);

  async function loadExistingResults() {
    try {
      const response = await fetch('/api/attack-results');
      if (response.ok) {
        const data = await response.json();
        setAttackResults(data);
      }
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  }

  async function runAttack(attackType) {
    setRunningAttack(attackType);
    
    try {
      const response = await fetch('/api/run-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attack: attackType })
      });
      
      const result = await response.json();
      
      setAttackResults(prev => ({
        ...prev,
        [attackType]: result
      }));
      
    } catch (error) {
      console.error('Error running attack:', error);
    } finally {
      setRunningAttack(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <NavBar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🛡️ Live Security Attack Simulation
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Watch real-time attacks against the platform and see how our cryptographic
            defenses prevent privacy breaches, spam, and protocol exploits.
          </p>
        </div>

        {/* Attack Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          
          {/* Linkability Attack */}
          <AttackCard
            title="🔗 Linkability Attack"
            description="Attempts to correlate multiple anonymous submissions from the same contributor using timing, gas prices, and commitment analysis."
            defense="Cryptographic commitments with random nonces ensure each submission is statistically independent."
            running={runningAttack === 'linkability'}
            result={attackResults?.linkability}
            onRun={() => runAttack('linkability')}
          />

          {/* Sybil Attack */}
          <AttackCard
            title="👥 Sybil Attack"
            description="Attempts to create multiple fake identities to spam the system without paying the required stake."
            defense="Economic barriers (0.01-0.1 ETH stake) make creating thousands of fake identities prohibitively expensive."
            running={runningAttack === 'sybil'}
            result={attackResults?.sybil}
            onRun={() => runAttack('sybil')}
          />

          {/* Replay Attack */}
          <AttackCard
            title="🔄 Replay Attack"
            description="Captures a valid ZKP proof and attempts to reuse it for multiple submissions (double-spend attack)."
            defense="Nullifier tracking ensures each commitment can only be used once, preventing proof reuse."
            running={runningAttack === 'replay'}
            result={attackResults?.replay}
            onRun={() => runAttack('replay')}
          />

          {/* Deanonymization Attack */}
          <AttackCard
            title="🕵️ Deanonymization Attack"
            description="Attempts to extract real identity from anonymous submissions through brute force, proof analysis, and behavioral patterns."
            defense="256-bit cryptographic security makes brute force computationally infeasible (2^256 operations)."
            running={runningAttack === 'deanonymization'}
            result={attackResults?.deanonymization}
            onRun={() => runAttack('deanonymization')}
          />
        </div>

        {/* Overall Security Dashboard */}
        {attackResults && <SecurityDashboard results={attackResults} />}

        {/* Mathematical Proof Section */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8 border border-blue-500">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            📐 Mathematical Security Proof
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-4xl font-bold text-blue-400 mb-2">2^256</div>
              <div className="text-sm text-gray-400">Commitment Key Space</div>
              <div className="text-xs text-gray-500 mt-2">
                = 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,936 possible secrets
              </div>
            </div>
            
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-4xl font-bold text-green-400 mb-2">2^165</div>
              <div className="text-sm text-gray-400">Years to Brute Force</div>
              <div className="text-xs text-gray-500 mt-2">
                Heat death of universe: ~10^100 years. System will outlive the universe.
              </div>
            </div>
            
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-4xl font-bold text-purple-400 mb-2">0 bits</div>
              <div className="text-sm text-gray-400">Information Leaked</div>
              <div className="text-xs text-gray-500 mt-2">
                Zero-knowledge property: Proof reveals existence, not identity
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 bg-gray-900 rounded-lg font-mono text-sm">
            <div className="text-blue-400 mb-2">// Commitment Structure</div>
            <div className="text-white">
              commitment = keccak256(contributorLeaf || secret || timestamp)
            </div>
            <div className="text-gray-400 mt-4">
              Where:
              <ul className="ml-6 mt-2 space-y-1">
                <li>• contributorLeaf = keccak256(address) [32 bytes]</li>
                <li>• secret = random 256-bit nonce [32 bytes]</li>
                <li>• timestamp = block timestamp [variable]</li>
              </ul>
            </div>
            <div className="text-green-400 mt-4">
              Security: Preimage resistance of keccak256 + 256-bit secret space
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            📊 Security Comparison
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-white">
              <thead className="bg-gray-900">
                <tr>
                  <th className="p-4 text-left">Feature</th>
                  <th className="p-4 text-center">Traditional CTI</th>
                  <th className="p-4 text-center">Our Platform</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-700">
                  <td className="p-4">Linkability Resistance</td>
                  <td className="p-4 text-center text-red-400">❌ Linkable by IP/Account</td>
                  <td className="p-4 text-center text-green-400">✅ Cryptographically Unlinkable</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="p-4">Anonymity Protection</td>
                  <td className="p-4 text-center text-red-400">❌ Identity Always Visible</td>
                  <td className="p-4 text-center text-green-400">✅ Zero-Knowledge Proofs</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="p-4">Sybil Attack Cost</td>
                  <td className="p-4 text-center text-red-400">$0 (Free Accounts)</td>
                  <td className="p-4 text-center text-green-400">$35,000 for 1000 identities</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="p-4">Replay Protection</td>
                  <td className="p-4 text-center text-yellow-400">⚠️ Session-based</td>
                  <td className="p-4 text-center text-green-400">✅ Cryptographic Nullifiers</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="p-4">Censorship Resistance</td>
                  <td className="p-4 text-center text-red-400">❌ Central Authority</td>
                  <td className="p-4 text-center text-green-400">✅ Decentralized (Multi-chain)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            ⚙️ Defense Mechanisms Explained
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DefenseMechanism
              icon="🔐"
              title="Cryptographic Commitments"
              description="Each submission uses a fresh 256-bit random secret combined with the contributor's address and timestamp. The keccak256 hash ensures that even knowing the address doesn't reveal which submission is theirs."
            />
            
            <DefenseMechanism
              icon="🌳"
              title="Merkle Tree Proofs"
              description="Contributors prove they're in the registered set without revealing which specific address they are. Proof size is O(log n), revealing no identity information."
            />
            
            <DefenseMechanism
              icon="💰"
              title="Economic Staking"
              description="Minimum 0.01 ETH stake per contributor creates economic barrier against Sybil attacks. Attackers must pay thousands of dollars to spam the system."
            />
            
            <DefenseMechanism
              icon="🚫"
              title="Nullifier Tracking"
              description="Each commitment is marked as 'used' after first submission. Smart contract prevents reuse, making replay attacks impossible at the protocol level."
            />
          </div>
        </div>

      </main>
    </div>
  );
}

function AttackCard({ title, description, defense, running, result, onRun }) {
  const attackFailed = result && (
    result.successful_attacks === 0 ||
    result.successful_replays === 0 ||
    result.successful_links === 0 ||
    result.successful_deanonymizations === 0
  );

  return (
    <div className={`bg-gray-800 rounded-lg p-6 border-2 transition-all ${
      running ? 'border-yellow-500 animate-pulse' : 
      attackFailed ? 'border-green-500' :
      result ? 'border-red-500' : 'border-gray-700'
    }`}>
      <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
      
      <div className="text-gray-300 mb-4">
        <p className="mb-3">{description}</p>
        <div className="text-sm text-blue-300 bg-blue-900/30 p-3 rounded">
          <strong>Defense:</strong> {defense}
        </div>
      </div>

      {result && (
        <div className={`mb-4 p-4 rounded ${attackFailed ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
          <div className={`text-lg font-bold ${attackFailed ? 'text-green-400' : 'text-red-400'}`}>
            {attackFailed ? '✅ ATTACK FAILED' : '⚠️ ATTACK SUCCEEDED'}
          </div>
          <div className="text-sm text-gray-300 mt-2">
            {result.conclusion}
          </div>
        </div>
      )}

      <button
        onClick={onRun}
        disabled={running}
        className={`w-full py-3 rounded-lg font-bold transition-all ${
          running 
            ? 'bg-yellow-600 cursor-wait' 
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
      >
        {running ? '🔄 Running Attack...' : '▶️ Run Attack Simulation'}
      </button>
    </div>
  );
}

function SecurityDashboard({ results }) {
  const attacks = Object.values(results || {});
  const totalAttacks = attacks.length;
  const failedAttacks = attacks.filter(r => 
    r.successful_attacks === 0 ||
    r.successful_replays === 0 ||
    r.successful_links === 0 ||
    r.successful_deanonymizations === 0
  ).length;
  
  const securityScore = totalAttacks > 0 ? (failedAttacks / totalAttacks) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-8 mb-8 border-2 border-blue-500">
      <h2 className="text-4xl font-bold text-white mb-6 text-center">
        🏆 Overall Security Score
      </h2>
      
      <div className="text-center mb-8">
        <div className="text-8xl font-bold text-white mb-4">
          {securityScore.toFixed(0)}%
        </div>
        <div className="text-2xl text-gray-300">
          {securityScore === 100 ? '🎉 Perfect Security!' :
           securityScore >= 75 ? '✅ Strong Security' :
           '⚠️ Vulnerabilities Detected'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white text-center">
        <div className="bg-gray-900/50 p-4 rounded-lg">
          <div className="text-3xl font-bold text-blue-400">{totalAttacks}</div>
          <div className="text-sm text-gray-400">Total Attacks</div>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg">
          <div className="text-3xl font-bold text-green-400">{failedAttacks}</div>
          <div className="text-sm text-gray-400">Attacks Blocked</div>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg">
          <div className="text-3xl font-bold text-red-400">{totalAttacks - failedAttacks}</div>
          <div className="text-sm text-gray-400">Attacks Succeeded</div>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg">
          <div className="text-3xl font-bold text-purple-400">{securityScore.toFixed(0)}%</div>
          <div className="text-sm text-gray-400">Security Score</div>
        </div>
      </div>
    </div>
  );
}

function DefenseMechanism({ icon, title, description }) {
  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-300 text-sm">{description}</p>
    </div>
  );
}
