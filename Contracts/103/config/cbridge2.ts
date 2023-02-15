interface cBridgeConfig {
  [key: string]: {
    cBridge: string
    chainId: number
  }
}
//0x552008c0f6870c2f77e5cc1d2eb9bdff03e30ea0
const config: cBridgeConfig = {
  // leave cBridgeConfig as '' if you want to deploy a router with deployments
  hardhat: {
    cBridge: '0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820',
    chainId: 1,
  },
  xdai: {
    cBridge: '0x3795C36e7D12A8c252A20C5a7B455f7c57b60283',
    chainId: 100,
  },
  mainnet: {
    cBridge: '0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820',
    chainId: 1,
  },
  optimism: {
    cBridge: '0x9D39Fc627A6d9d9F8C831c16995b209548cc3401',
    chainId: 10,
  },
  bsc: {
    cBridge: '0xdd90E5E87A2081Dcf0391920868eBc2FFB81a1aF',
    chainId: 56,
  },
  polygon: {
    cBridge: '0x88DCDC47D2f83a99CF0000FDF667A468bB958a78',
    chainId: 137,
  },
  fantom: {
    cBridge: '0x374B8a9f3eC5eB2D97ECA84Ea27aCa45aa1C57EF',
    chainId: 250,
  },
  moonbeam: {
    cBridge: '0x841ce48F9446C8E281D3F1444cB859b4A6D0738C',
    chainId: 1284,
  },
  boba: {
    cBridge: '0x841ce48F9446C8E281D3F1444cB859b4A6D0738C',
    chainId: 288,
  },
  arbitrum: {
    cBridge: '0x1619DE6B6B20eD217a58d00f37B9d47C7663feca',
    chainId: 42161,
  },
  avax: {
    cBridge: '0xef3c714c9425a8F3697A9C969Dc1af30ba82e5d4',
    chainId: 43114,
  },
  moon_river: {
    cBridge: '0x841ce48F9446C8E281D3F1444cB859b4A6D0738C',
    chainId: 1285,
  },
}

export default config
