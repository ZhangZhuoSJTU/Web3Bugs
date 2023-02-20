import axios from "axios";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { BOOST_CONFIG, DEXES, MAINNET_TOKEN_ADDRESSES } from "../../../config/deployment";
import { MAINNET_ENDPOINT } from "../../../hardhat.config";
import {
  AccessController,
  ConfigProvider,
  DexAddressProvider,
  PAR,
  PARMinerV2,
  PriceFeed,
} from "../../../typechain-types";

const account = "0xcc8793d5eB95fAa707ea4155e09b2D3F44F33D1E";

const PAR_ADDRESS = "0x68037790a0229e9ce6eaa8a99ea92964106c4703";
const ADDRESS_PROVIDER = "0x6fAE125De41C03fa7d917CCfa17Ba54eF4FEb014";
const GA_ADDRESS_PROVIDER = "0x718b7584d410f364fc16724027c07c617b87f2fc";
const CONFIG_PROVIDER = "0xaa4cb7dbb37dba644e0c180291574ef4e6abb187";
const PRICE_FEED = "0xa94140087d835526d5eaedaea8573a02315d5380";
const ACCESS_CONTROLLER = "0x7dF19C25971057a54405e041fd479F677038aa75";

const setup = deployments.createFixture(async () => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: MAINNET_ENDPOINT,
        },
      },
    ],
  });

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  });
  const multisig = await ethers.getSigner(account);
  const _weth = MAINNET_TOKEN_ADDRESSES.WETH;

  await deploy("DexAddressProvider", {
    from: deployer,
    args: [ADDRESS_PROVIDER, DEXES],
    log: true,
  });

  const dexAddressProvider: DexAddressProvider = await ethers.getContract("DexAddressProvider");

  await deploy("PARMinerV2", {
    from: deployer,
    args: [GA_ADDRESS_PROVIDER, dexAddressProvider.address, BOOST_CONFIG],
    log: true,
  });

  const parMiner: PARMinerV2 = await ethers.getContract("PARMinerV2");

  const par: PAR = await ethers.getContractAt("PAR", PAR_ADDRESS);
  const configProvider: ConfigProvider = await ethers.getContractAt("ConfigProvider", CONFIG_PROVIDER);
  const priceFeed: PriceFeed = await ethers.getContractAt("PriceFeed", PRICE_FEED);
  const accessController: AccessController = await ethers.getContractAt("AccessController", ACCESS_CONTROLLER);

  const MINTER_ROLE = await accessController.MINTER_ROLE();
  await accessController.connect(multisig).grantRole(MINTER_ROLE, deployer);

  await configProvider.connect(multisig).setCollateralMinCollateralRatio(_weth, "3000000000000000000");
  await configProvider.connect(multisig).setCollateralLiquidationRatio(_weth, "3000000000000000000");

  const parToDeposit = ethers.utils.parseEther("300");

  await par.mint(deployer, parToDeposit);
  await par.approve(parMiner.address, parToDeposit);
  await par.approve(parMiner.address, parToDeposit);
  await parMiner.deposit(parToDeposit);
  await parMiner.connect(multisig).setLiquidateCallerReward(1);

  const collateralAmount = await priceFeed.convertTo(_weth, parToDeposit.mul(105).div(100));

  return {
    parMiner,
    par,
    parToDeposit,
    _weth,
    collateralAmount,
  };
});

describe("--- PARMinerV2 Liquidation ---", () => {
  it("1inch", async () => {
    try {
      const { parMiner, par, parToDeposit, _weth, collateralAmount } = await setup();
      const { data }: any = await axios.get(`https://api.1inch.exchange/v3.0/1/swap`, {
        params: {
          fromTokenAddress: _weth,
          toTokenAddress: par.address,
          amount: collateralAmount.toString(),
          fromAddress: parMiner.address,
          slippage: 1,
          disableEstimate: true,
        },
      });
      const callerParBalanceBefore = await par.balanceOf(account);
      const minerParBalanceBefore = await par.balanceOf(parMiner.address);
      await parMiner.liquidate(169, parToDeposit, 1, data.tx.data);
      const callerParBalanceAfter = await par.balanceOf(account);
      const minerParBalanceAfter = await par.balanceOf(parMiner.address);
      console.log(
        "caller par balancer before and after",
        callerParBalanceBefore.toString(),
        callerParBalanceAfter.toString(),
      );
      console.log(
        "miner par balancer before and after",
        minerParBalanceBefore.toString(),
        minerParBalanceAfter.toString(),
      );
    } catch (error) {
      console.log(error);
    }
  });
  it("paraswap", async () => {
    try {
      const { parMiner, par, parToDeposit, _weth, collateralAmount } = await setup();
      const { data: routeData }: any = await axios.get(`https://apiv5.paraswap.io/prices/`, {
        params: {
          srcToken: _weth,
          destToken: par.address,
          side: "SELL",
          network: 1,
          srcDecimals: 18,
          destDecimals: 18,
          amount: collateralAmount.toString(),
        },
      });

      const { data }: any = await axios.post(
        `https://apiv5.paraswap.io/transactions/1`,
        {
          srcToken: _weth,
          destToken: par.address,
          priceRoute: routeData.priceRoute,
          srcAmount: collateralAmount.toString(),
          slippage: 100, // 1% slippage
          userAddress: parMiner.address,
        },
        {
          params: {
            ignoreChecks: true,
          },
        },
      );

      const callerParBalanceBefore = await par.balanceOf(account);
      const minerParBalanceBefore = await par.balanceOf(parMiner.address);
      await parMiner.liquidate(169, parToDeposit, 0, data.data);
      const callerParBalanceAfter = await par.balanceOf(account);
      const minerParBalanceAfter = await par.balanceOf(parMiner.address);
      console.log(
        "caller par balancer before and after",
        callerParBalanceBefore.toString(),
        callerParBalanceAfter.toString(),
      );
      console.log(
        "miner par balancer before and after",
        minerParBalanceBefore.toString(),
        minerParBalanceAfter.toString(),
      );
    } catch (error) {
      console.log(error);
    }
  });
});
