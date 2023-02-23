import { SupportedNetworks } from 'prepo-constants'

export const getContractAddress = <SupportedContracts>(
  contract: keyof SupportedContracts,
  currentNetwork: SupportedNetworks,
  supportedContracts: SupportedContracts
): string | undefined => {
  const externalContract = supportedContracts[contract]
  // Ignoring typescript here since it creates issues with unitests and mobx not sending types when mocking ContractStore
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return externalContract[currentNetwork] as string | undefined
}
