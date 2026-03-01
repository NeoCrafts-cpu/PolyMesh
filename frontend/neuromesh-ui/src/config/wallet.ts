import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { polygon, polygonAmoy, polygonZkEvm, polygonZkEvmCardona, mainnet, sepolia } from 'wagmi/chains';

// Custom PolyMesh chain configuration
const polymesh = {
  id: 10101,
  name: 'PolyMesh',
  iconUrl: '/polymesh-icon.svg',
  nativeCurrency: {
    name: 'MESH',
    symbol: 'MESH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolyMesh Explorer',
      url: 'http://127.0.0.1:4000',
    },
  },
  testnet: true,
} as const;

// Configure chains and transports
export const config = getDefaultConfig({
  appName: 'PolyMesh Dashboard',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [
    polymesh,
    polygon,
    polygonAmoy,
    polygonZkEvm,
    polygonZkEvmCardona,
    mainnet,
    sepolia,
  ],
  transports: {
    [polymesh.id]: http('http://127.0.0.1:8545'),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
    [polygonZkEvm.id]: http(),
    [polygonZkEvmCardona.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

// Export chains for use elsewhere
export const supportedChains = [
  polymesh,
  polygon,
  polygonAmoy,
  polygonZkEvm,
  polygonZkEvmCardona,
];
