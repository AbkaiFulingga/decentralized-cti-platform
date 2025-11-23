// cti-frontend/utils/contract-helpers.js
import { ethers } from 'ethers';
import { NETWORKS, DEFAULT_NETWORK, CONTRACT_ABIS } from './constants';

export async function getProvider() {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask');
  }
  return new ethers.BrowserProvider(window.ethereum, "any");
}

export async function getSigner() {
  const provider = await getProvider();
  return await provider.getSigner();
}

export async function getCurrentNetwork() {
  const provider = await getProvider();
  const network = await provider.getNetwork();
  const chainId = network.chainId.toString();
  
  // Find matching network config
  for (const [key, config] of Object.entries(NETWORKS)) {
    if (config.chainId.toString() === chainId) {
      return { key, config };
    }
  }
  
  throw new Error(`Unsupported network. Chain ID: ${chainId}`);
}

export async function switchNetwork(networkKey) {
  const network = NETWORKS[networkKey];
  
  if (!network) {
    throw new Error(`Unknown network: ${networkKey}`);
  }
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${network.chainId.toString(16)}` }],
    });
  } catch (switchError) {
    // Network not added to MetaMask, add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${network.chainId.toString(16)}`,
          chainName: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.explorerUrl]
        }]
      });
    } else {
      throw switchError;
    }
  }
}

export async function getRegistryContract(signerOrProvider = null) {
  const { config } = await getCurrentNetwork();
  const provider = signerOrProvider || await getProvider();
  
  return new ethers.Contract(
    config.contracts.registry,
    CONTRACT_ABIS.registry,
    provider
  );
}

export async function getGovernanceContract(signerOrProvider = null) {
  const { config } = await getCurrentNetwork();
  const provider = signerOrProvider || await getProvider();
  
  return new ethers.Contract(
    config.contracts.governance,
    CONTRACT_ABIS.governance,
    provider
  );
}

export function getExplorerUrl(address, type = 'address') {
  const networkKey = DEFAULT_NETWORK; // Can be made dynamic later
  const network = NETWORKS[networkKey];
  return `${network.explorerUrl}/${type}/${address}`;
}

export function getIPFSUrl(cid, gateway = 'pinata') {
  const gateways = {
    pinata: 'https://gateway.pinata.cloud/ipfs',
    ipfsIo: 'https://ipfs.io/ipfs',
    cloudflare: 'https://cloudflare-ipfs.com/ipfs',
    local: 'http://192.168.1.3:8080/ipfs'
  };
  
  return `${gateways[gateway] || gateways.pinata}/${cid}`;
}
