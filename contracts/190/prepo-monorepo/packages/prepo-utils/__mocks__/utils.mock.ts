import { Network, METAMASK_INFURA_ID } from 'prepo-constants'

const mockData = {
  ethAddress: '0x1234000000000000000000000000000005678910',
  ethAddressShort: '0x1234...5678910',
  appName: 'my-app',
  goerliNetwork: {
    name: 'goerli',
    color: '#0975F6',
    chainId: 5,
    faucet: 'https://goerli-faucet.slock.it',
    blockExplorer: 'https://goerli.etherscan.io',
    rpcUrls: [`https://goerli.infura.io/v3/${METAMASK_INFURA_ID}`],
    gasPrice: { _hex: '0x0df8475800', _isBigNumber: true },
  } as Network,
  onboardObject: {
    networkId: 5,
    walletSelect: {
      wallets: [
        {
          walletName: 'metamask',
          preferred: true,
        },
        {
          walletName: 'ledger',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'trezor',
          appUrl: 'https://prepo.io/',
          email: 'hello@prepo.io',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'walletConnect',
          infuraKey: '460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'coinbase',
          preferred: true,
        },
        {
          walletName: 'trust',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          preferred: true,
        },
        {
          walletName: 'keepkey',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
        {
          walletName: 'gnosis',
        },
        {
          walletName: 'liquality',
        },
        {
          walletName: 'authereum',
        },
        {
          walletName: 'lattice',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          appName: 'my-app',
        },
        {
          walletName: 'opera',
        },
        {
          walletName: 'operaTouch',
        },
        {
          walletName: 'status',
        },
        {
          walletName: 'walletLink',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
          appName: 'my-app',
        },
        {
          walletName: 'imToken',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
        {
          walletName: 'meetone',
        },
        {
          walletName: 'mykey',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
        {
          walletName: 'huobiwallet',
          rpcUrl: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad',
        },
      ],
    },
    walletCheck: [
      {
        checkName: 'derivationPath',
      },
      {
        checkName: 'accounts',
      },
      {
        checkName: 'connect',
      },
      {
        checkName: 'network',
      },
    ],
  },
  goerliUSDCContractAddress: '0xaFF4481D10270F50f203E0763e2597776068CBc5',
  fallbackProviderObject: {
    _isProvider: true,
    _events: [],
    _emitted: { block: -2 },
    formatter: {
      formats: {
        transaction: {},
        transactionRequest: {},
        receiptLog: {},
        receipt: {},
        block: {},
        blockWithTransactions: {},
        filter: {},
        filterLog: {},
      },
    },
    anyNetwork: false,
    _network: {
      name: 'goerli',
      chainId: 5,
      ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    },
    _maxInternalBlockNumber: -1024,
    _lastBlockNumber: -2,
    _pollingInterval: 4000,
    _fastQueryDate: 0,
    providerConfigs: [
      {
        provider: {
          _isProvider: true,
          _events: [],
          _emitted: { block: -2 },
          formatter: {
            formats: {
              transaction: {},
              transactionRequest: {},
              receiptLog: {},
              receipt: {},
              block: {},
              blockWithTransactions: {},
              filter: {},
              filterLog: {},
            },
          },
          anyNetwork: false,
          _network: {
            name: 'goerli',
            chainId: 5,
            ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
          },
          _maxInternalBlockNumber: -1024,
          _lastBlockNumber: -2,
          _pollingInterval: 4000,
          _fastQueryDate: 0,
          connection: { url: 'https://goerli.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad' },
          _nextId: 42,
        },
        priority: 0,
        stallTimeout: 1000,
        weight: 1,
      },
    ],
    quorum: 1,
    _highestBlockNumber: -1,
  },
}

export default mockData
