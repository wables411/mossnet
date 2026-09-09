// The wallet connector.
//
// This is the one part of moss quest that is bundled rather than hand-written:
// AppKit ships as npm packages with no CDN build, so `npm run build:wallet`
// compiles it into assets/appkit.bundle.js, which is committed. The deployed
// site still serves nothing but its own files, so script-src stays 'self'.
//
// The site reads chains over its own RPC proxies and only needs an EIP-1193
// provider to sign with, so this exposes the smallest surface that does that.

import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, defineChain } from '@reown/appkit/networks';

// Public by design: the project id ships in every client bundle. It is scoped
// by the allowed domains set in the Reown dashboard, not by being secret.
const PROJECT_ID = '35f0de0a32ef99621185726b637995cf';

// Robinhood Chain is not one of AppKit's built-ins, so describe it. The RPC is
// the chain's public one because a wallet has to reach it directly; the site's
// own reads still go through /rpc/robinhood.
const robinhood = defineChain({
  id: 4663,
  caipNetworkId: 'eip155:4663',
  chainNamespace: 'eip155',
  name: 'Robinhood Chain',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } }
});

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [mainnet, robinhood],
  defaultNetwork: mainnet,
  projectId: PROJECT_ID,
  metadata: {
    name: 'moss quest',
    description: 'the quest to find all the moss',
    url: location.origin,
    icons: [`${location.origin}/assets/icons/icon-192.png`]
  },
  features: { analytics: false, email: false, socials: false },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#6c8a38',
    '--w3m-font-family': '"Jersey 10", ui-monospace, monospace',
    '--w3m-border-radius-master': '0px'
  }
});

const listeners = new Set();
let address = null;
let provider = null;

appKit.subscribeAccount(state => {
  const next = state?.address || state?.accountState?.address || null;
  if (next === address) return;
  address = next;
  listeners.forEach(fn => fn(address));
});
appKit.subscribeProviders(state => {
  provider = state?.eip155 || null;
});

window.mossWallet = {
  open: () => appKit.open(),
  close: () => appKit.close(),
  disconnect: () => appKit.disconnect(),
  address: () => address || appKit.getAddress?.() || null,
  provider: () => provider || appKit.getWalletProvider?.() || null,
  isConnected: () => Boolean(address || appKit.getIsConnected?.()),
  switchNetwork: (chainId) => appKit.switchNetwork(chainId === 4663 ? robinhood : mainnet),
  onAccount: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  ready: true
};
window.dispatchEvent(new CustomEvent('mosswallet:ready'));
