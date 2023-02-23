import { getOnboardConfig } from './onboard-config'
import { StoreConfig } from './stores.types'

export const normalizeStoreConfig = <SupportedContracts>(
  storeConfig: StoreConfig<SupportedContracts>
): Required<StoreConfig<SupportedContracts>> => {
  const normalizedValue = storeConfig

  if (storeConfig?.onboardConfig === undefined) {
    normalizedValue.onboardConfig = getOnboardConfig(
      storeConfig.supportedNetworks,
      storeConfig.appName
    )
  }

  return normalizedValue as Required<StoreConfig<SupportedContracts>>
}
