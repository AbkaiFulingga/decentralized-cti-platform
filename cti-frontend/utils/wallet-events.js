// utils/wallet-events.js

export class WalletEventManager {
  constructor() {
    this.listeners = [];
    this.currentAccount = null;
    this.isSetup = false;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(newAccount) {
    this.currentAccount = newAccount;
    console.log('🔄 WalletEventManager notifying', this.listeners.length, 'listeners');
    this.listeners.forEach(callback => {
      try {
        callback(newAccount);
      } catch (error) {
        console.error('Error in wallet event listener:', error);
      }
    });
  }

  setupAccountListener() {
    if (this.isSetup) {
      console.log('⚠️ WalletEventManager already setup, skipping');
      return;
    }

    if (!window.ethereum) {
      console.warn('MetaMask not detected');
      return;
    }

    console.log('✅ Setting up WalletEventManager');

    window.ethereum.on('accountsChanged', (accounts) => {
      console.log('🔄 MetaMask account changed:', accounts[0]);
      this.notifyListeners(accounts[0] || null);
    });

    window.ethereum.on('chainChanged', (chainId) => {
      console.log('🔄 MetaMask network changed:', chainId);
      // Force page reload on network change for simplicity
      window.location.reload();
    });

    this.isSetup = true;
  }

  async getCurrentAccount() {
    if (!window.ethereum) return null;
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts[0] || null;
    } catch (error) {
      console.error('Failed to get current account:', error);
      return null;
    }
  }
}

// Singleton instance
export const walletEventManager = new WalletEventManager();
