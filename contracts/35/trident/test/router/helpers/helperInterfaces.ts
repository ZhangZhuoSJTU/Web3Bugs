import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { RPool, RToken } from "@sushiswap/tines";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { RouteType } from "./constants";
 
export interface Topology {
  tokens: RToken[];
  prices: number[];
  pools: RPool[];
}
  
export interface Variants {
  [key: string]: number
}

export interface PoolDeploymentContracts {
  hybridPoolFactory: ContractFactory,
  hybridPoolContract: Contract,
  constPoolFactory: ContractFactory, 
  constantPoolContract: Contract, 
  masterDeployerContract: Contract,
  bentoContract: Contract,
  account: SignerWithAddress
}
export interface InitialPath {
  tokenIn: string;
  pool: string;
  native: boolean;
  amount: BigNumber;
  data: string;
}

export interface PercentagePath {
  tokenIn: string;
  pool: string;
  balancePercentage: BigNumber;
  data: string;
}

export interface Path {
  pool: string;
  data: string;
}

export interface Output {
  token: string;
  to: string;
  unwrapBento: boolean;
  minAmount: BigNumber;
}

export interface ComplexPathParams extends TridentRoute {
  initialPath: InitialPath[];
  percentagePath: PercentagePath[];
  output: Output[];
}

export interface ExactInputSingleParams extends TridentRoute {
  amountIn: BigNumber
  amountOutMinimum: BigNumber;
  tokenIn: string;
  pool: string;
  data: string;
}

export interface ExactInputParams extends TridentRoute {
  tokenIn: string;
  amountIn: BigNumber
  amountOutMinimum: BigNumber;
  path: Path[];
}

export interface TridentRoute {
  routeType: RouteType
}
