import 'hardhat/types/runtime'
import { DeploymentNames } from 'prepo-constants'

declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    DEPLOYMENT_NAMES: DeploymentNames
  }
}
