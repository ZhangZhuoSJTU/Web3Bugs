import { getAddress } from 'ethers/lib/utils'
import { SupportedNetworks } from './networks'

export type ImportantAddress = {
  [key in SupportedNetworks]?: string
}

export type ImportantKeywords = 'GOVERNANCE' | 'USDC'

export type ImportantAddresses = {
  [key in ImportantKeywords]?: ImportantAddress
}

export const PREPO_ADDRESSES: ImportantAddresses = {
  GOVERNANCE: {
    arbitrumTestnet: '0x054CcD68A2aC152fCFB93a15b6F75Eea53DCD9E0',
    arbitrumOne: '0xe5011a7cc5CDA29F02CE341B2847B58abEFA7c26',
  },
  USDC: {
    // This is not an actual USDC contract, but an instance of MockBaseToken
    arbitrumTestnet: '0xD0778E8A78E95f612A95A3636141435253131103',
    arbitrumOne: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
}

export function getPrePOAddressForNetwork(
  keyword: keyof ImportantAddresses,
  network: SupportedNetworks,
  localAddress?: string
): string {
  // Handle local network
  if (network === 'hardhat' || network === 'ganache') {
    if (!localAddress)
      throw new Error(`Local network detected, but no local ${keyword} address was provided`)
    return getAddress(localAddress)
  }
  /**
   * Handle remote network
   *
   * Store each entry because TS compiler does not recognize check for
   * PREPO_ADDRESSES[keyword] or PREPO_ADDRESSES[keyword][network] being
   * undefined unless explicitly stored before the conditional statement.
   * While technically TS should, if using &&, should evaluate if
   * PREPO_ADDRESSES[keyword] is undefined before accessing [network] it
   * doesn't seem to work unless we use `.` notation.
   */
  const entryForKeyword = PREPO_ADDRESSES[keyword]
  if (entryForKeyword && entryForKeyword[network]) {
    const entryForKeywordAndNetwork = entryForKeyword[network]
    if (entryForKeywordAndNetwork) {
      return getAddress(entryForKeywordAndNetwork)
    }
  }
  throw new Error(`${keyword} not defined for the ${network} network`)
}
