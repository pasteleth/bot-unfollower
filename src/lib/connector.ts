import { SwitchChainError, fromHex, getAddress, numberToHex } from 'viem';
import { ChainNotConfiguredError, createConnector } from 'wagmi';

// Create a mock provider for type safety, actual implementation will come from SDK
type EthProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

// Define the SDK type structure to help TypeScript
interface FrameSDK {
  wallet: {
    ethProvider: EthProvider;
  };
  actions: {
    ready: () => Promise<void>;
    openUrl?: (url: string) => void;
    close?: () => void;
  };
  context: Promise<any>;
}

// Declare the SDK on the window object for TypeScript
declare global {
  interface Window {
    sdk?: unknown;
  }
}

// Using a different approach that doesn't rely on augmenting the SDK type
const getFrameSDK = () => {
  // Only import SDK on client side
  if (typeof window === 'undefined') {
    // Return a mock for SSR
    return {
      wallet: { 
        ethProvider: {
          request: async () => { throw new Error('Not available in SSR'); }
        } 
      },
      actions: { ready: async () => {} },
      context: Promise.resolve({})
    } as unknown as FrameSDK;
  }
  
  // Use dynamic import in browser
  // We know the SDK exists at runtime, TypeScript can't verify this
  return window.sdk as unknown as FrameSDK;
};

// Helper to safely get the provider
const getSafeProvider = async (): Promise<EthProvider> => {
  // Wait for SDK to be available
  const checkSDK = () => {
    return new Promise<EthProvider>((resolve, reject) => {
      // First check if we're in a browser
      if (typeof window === 'undefined') {
        reject(new Error('Cannot access provider in SSR context'));
        return;
      }
      
      // Check if SDK is loaded already
      if (window && window.sdk) {
        const sdk = window.sdk as unknown as FrameSDK;
        if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
          resolve(sdk.wallet.ethProvider);
          return;
        }
      }
      
      // If not available yet, retry after a short delay
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        if (window && window.sdk) {
          const sdk = window.sdk as unknown as FrameSDK;
          if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
            clearInterval(checkInterval);
            resolve(sdk.wallet.ethProvider);
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('Farcaster Wallet provider not available after multiple attempts'));
        }
      }, 500);
    });
  };
  
  return checkSDK();
};

frameConnector.type = 'frameConnector' as const;

export function frameConnector() {
  let connected = true;

  return createConnector<EthProvider>((config: any) => ({
    id: 'farcaster',
    name: 'Farcaster Wallet',
    type: frameConnector.type,

    async setup() {
      try {
        await this.connect({ chainId: config.chains[0].id });
      } catch (error) {
        console.error('Farcaster wallet setup error:', error);
      }
    },
    
    async connect({ chainId } = {}) {
      try {
        const provider = await this.getProvider();
        
        // Check if provider is available
        if (!provider || typeof provider.request !== 'function') {
          throw new Error('Farcaster wallet provider not available');
        }
        
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        });

        let currentChainId = await this.getChainId();
        if (chainId && currentChainId !== chainId) {
          const chain = await this.switchChain!({ chainId });
          currentChainId = chain.id;
        }

        connected = true;

        return {
          accounts: accounts.map((x: string) => getAddress(x)),
          chainId: currentChainId,
        };
      } catch (error) {
        console.error('Farcaster connect error:', error);
        throw error;
      }
    },
    
    async disconnect() {
      connected = false;
    },
    
    async getAccounts() {
      if (!connected) throw new Error('Not connected');
      
      try {
        const provider = await this.getProvider();
        
        // Check if provider is available
        if (!provider || typeof provider.request !== 'function') {
          throw new Error('Farcaster wallet provider not available');
        }
        
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        });
        return accounts.map((x: string) => getAddress(x));
      } catch (error) {
        console.error('Farcaster getAccounts error:', error);
        throw error;
      }
    },
    
    async getChainId() {
      try {
        const provider = await this.getProvider();
        
        // Check if provider is available
        if (!provider || typeof provider.request !== 'function') {
          throw new Error('Farcaster wallet provider not available');
        }
        
        const hexChainId = await provider.request({ method: 'eth_chainId' });
        return fromHex(hexChainId, 'number');
      } catch (error) {
        console.error('Farcaster getChainId error:', error);
        throw error;
      }
    },
    
    async isAuthorized() {
      if (!connected) {
        return false;
      }

      try {
        const accounts = await this.getAccounts();
        return !!accounts.length;
      } catch (error) {
        console.error('Farcaster isAuthorized error:', error);
        return false;
      }
    },
    
    async switchChain({ chainId }: { chainId: number }) {
      try {
        const provider = await this.getProvider();
        
        // Check if provider is available
        if (!provider || typeof provider.request !== 'function') {
          throw new Error('Farcaster wallet provider not available');
        }
        
        const chain = config.chains.find((x: any) => x.id === chainId);
        if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(chainId) }],
        });
        return chain;
      } catch (error) {
        console.error('Farcaster switchChain error:', error);
        throw error;
      }
    },
    
    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) this.onDisconnect();
      else
        config.emitter.emit('change', {
          accounts: accounts.map((x: string) => getAddress(x)),
        });
    },
    
    onChainChanged(chain: string) {
      const chainId = Number(chain);
      config.emitter.emit('change', { chainId });
    },
    
    async onDisconnect() {
      config.emitter.emit('disconnect');
      connected = false;
    },
    
    async getProvider() {
      try {
        // Use our helper function to safely access the SDK
        return await getSafeProvider();
      } catch (error) {
        console.error('Farcaster getProvider error:', error);
        throw new Error('Farcaster wallet provider not available');
      }
    },
  }));
}