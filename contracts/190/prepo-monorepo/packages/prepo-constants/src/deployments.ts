export const DEPLOYMENT_NAMES = {
  ppo: {
    name: 'PPO',
    restrictedTransferHook: {
      name: 'PPO-RestrictedTransferHook',
      blocklist: {
        name: 'PPO-RestrictedTransferHook-Blocklist',
      },
      sourceAllowlist: {
        name: 'PPO-RestrictedTransferHook-SourceAllowlist',
      },
      destinationAllowlist: {
        name: 'PPO-RestrictedTransferHook-DestinationAllowlist',
      },
    },
  },
  miniSales_permissioned: {
    name: 'MiniSales_Permissioned',
    allowlistPurchaseHook: {
      name: 'MiniSales_Permissioned-AllowlistPurchaseHook',
      allowlist: {
        name: 'MiniSales_Permissioned-AllowlistPurchaseHook-Allowlist',
      },
    },
  },
  miniSales_public: {
    name: 'MiniSales_Public',
  },
  vesting: {
    name: 'Vesting',
  },
  miniSalesFlag: {
    name: 'MiniSalesFlag',
  },
} as const

export type DeploymentNames = typeof DEPLOYMENT_NAMES
