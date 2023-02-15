import { ethers, network } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { INotionalProxy, WrappedfCash, WrappedfCashFactory } from "@utils/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { IERC20 } from "@typechain/IERC20";
import { ICErc20 } from "@typechain/ICErc20";
import { ICEth } from "@typechain/ICEth";
import DeployHelper from "@utils/deploys";
import { NUpgradeableBeacon__factory } from "@typechain/factories/NUpgradeableBeacon__factory";

const ROUTER_ADDRESS = "0x1344A36A1B56144C3Bc62E7757377D288fDE0369";
const NOTIONAL_PROXY_ADDRESS = "0x1344A36A1B56144C3Bc62E7757377D288fDE0369";
const batchActionArtifact = require("../external/abi/notional/BatchAction.json");
const erc1155ActionArtifact = require("../external/abi/notional/ERC1155Action.json");
const routerArtifact = require("../external/abi/notional/Router.json");

const cEthAddress = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";

async function impersonateAccount(address: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return ethers.provider.getSigner(address);
}

export async function upgradeNotionalProxy(signer: Signer) {
  // Create these three contract factories
  const routerFactory = new ethers.ContractFactory(
    routerArtifact["abi"],
    routerArtifact["bytecode"],
    signer,
  );
  const erc1155ActionFactory = new ethers.ContractFactory(
    erc1155ActionArtifact["abi"],
    erc1155ActionArtifact["bytecode"],
    signer,
  );
  const batchActionFactory = new ethers.ContractFactory(
    batchActionArtifact["abi"],
    batchActionArtifact["bytecode"],
    signer,
  );

  // Get the current router to get current contract addresses (same as notional contract, just different abi)
  const router = (await ethers.getContractAt(routerArtifact["abi"], ROUTER_ADDRESS)) as any;

  // This is the notional contract w/ notional abi
  const notional = (await ethers.getContractAt(
    "INotionalProxy",
    NOTIONAL_PROXY_ADDRESS,
  )) as INotionalProxy;

  // Deploy the new upgraded contracts
  const batchAction = await batchActionFactory.deploy();
  const erc1155Action = await erc1155ActionFactory.deploy();

  // Get the current router args and replace upgraded addresses
  const routerArgs = await Promise.all([
    router.GOVERNANCE(),
    router.VIEWS(),
    router.INITIALIZE_MARKET(),
    router.NTOKEN_ACTIONS(),
    batchAction.address, // upgraded
    router.ACCOUNT_ACTION(),
    erc1155Action.address, // upgraded
    router.LIQUIDATE_CURRENCY(),
    router.LIQUIDATE_FCASH(),
    router.cETH(),
    router.TREASURY(),
    router.CALCULATION_VIEWS(),
  ]);

  // Deploy a new router
  const newRouter = await routerFactory.deploy(...routerArgs);
  // Get the owner contract
  const notionalOwner = await impersonateAccount(await notional.owner());
  // Upgrade the system to the new router

  const fundingValue = ethers.utils.parseEther("1");
  await signer.sendTransaction({ to: await notionalOwner.getAddress(), value: fundingValue });

  await notional.connect(notionalOwner).upgradeTo(newRouter.address);
}

export async function getCurrencyIdAndMaturity(underlyingAddress: string, maturityIndex: number) {
  const notionalProxy = (await ethers.getContractAt(
    "INotionalProxy",
    NOTIONAL_PROXY_ADDRESS,
  )) as INotionalProxy;
  const currencyId = await notionalProxy.getCurrencyId(underlyingAddress);
  const activeMarkets = await notionalProxy.getActiveMarkets(currencyId);
  const maturity = activeMarkets[maturityIndex].maturity;
  return { currencyId, maturity };
}

export async function deployWrappedfCashInstance(
  wrappedfCashFactory: WrappedfCashFactory,
  currencyId: number,
  maturity: BigNumber,
) {
  const wrappeFCashAddress = await wrappedfCashFactory.callStatic.deployWrapper(
    currencyId,
    maturity,
  );
  await wrappedfCashFactory.deployWrapper(currencyId, maturity);
  const wrappedFCashInstance = (await ethers.getContractAt(
    "WrappedfCash",
    wrappeFCashAddress,
  )) as WrappedfCash;
  return wrappedFCashInstance;
}

export async function deployWrappedfCashFactory(deployer: DeployHelper, owner: SignerWithAddress, wethAddress: string) {
  const wrappedfCashImplementation = await deployer.external.deployWrappedfCash(
    NOTIONAL_PROXY_ADDRESS,
    wethAddress,
  );

  const wrappedfCashBeacon = await new NUpgradeableBeacon__factory(owner).deploy(
    wrappedfCashImplementation.address,
  );

  const wrappedfCashFactory = await deployer.external.deployWrappedfCashFactory(
    wrappedfCashBeacon.address,
  );
  return wrappedfCashFactory;
}

export async function mintWrappedFCash(
  signer: SignerWithAddress,
  underlyingToken: IERC20,
  underlyingTokenAmount: BigNumber,
  fCashAmount: BigNumber,
  assetToken: ICErc20 | ICEth,
  wrappedFCashInstance: WrappedfCash,
  useUnderlying: boolean = false,
  receiver: string | undefined = undefined,
  minImpliedRate: number | BigNumber = 0,
) {
  let inputToken: IERC20;
  let depositAmountExternal: BigNumber;
  receiver = receiver ?? signer.address;

  if (useUnderlying) {
    inputToken = underlyingToken;
    depositAmountExternal = underlyingTokenAmount;
  } else {
    const assetTokenBalanceBefore = await assetToken.balanceOf(signer.address);
    if (assetToken.address == cEthAddress) {
      assetToken = assetToken as ICEth;
      await assetToken.connect(signer).mint({ value: underlyingTokenAmount });
    } else {
      assetToken = assetToken as ICErc20;
      await underlyingToken.connect(signer).approve(assetToken.address, underlyingTokenAmount);
      await assetToken.connect(signer).mint(underlyingTokenAmount);
    }
    const assetTokenBalanceAfter = await assetToken.balanceOf(signer.address);
    depositAmountExternal = assetTokenBalanceAfter.sub(assetTokenBalanceBefore);
    inputToken = assetToken;
  }

  await inputToken.connect(signer).approve(wrappedFCashInstance.address, depositAmountExternal);
  const inputTokenBalanceBefore = await inputToken.balanceOf(signer.address);
  const wrappedFCashBalanceBefore = await wrappedFCashInstance.balanceOf(signer.address);
  let txReceipt;
  if (useUnderlying) {
    txReceipt = await wrappedFCashInstance
      .connect(signer)
      .mintViaUnderlying(depositAmountExternal, fCashAmount, receiver, minImpliedRate);
  } else {
    txReceipt = await wrappedFCashInstance
      .connect(signer)
      .mintViaAsset(depositAmountExternal, fCashAmount, receiver, minImpliedRate);
  }
  const wrappedFCashBalanceAfter = await wrappedFCashInstance.balanceOf(signer.address);
  const inputTokenBalanceAfter = await inputToken.balanceOf(signer.address);
  const inputTokenSpent = inputTokenBalanceAfter.sub(inputTokenBalanceBefore);
  const wrappedFCashReceived = wrappedFCashBalanceAfter.sub(wrappedFCashBalanceBefore);
  return {
    wrappedFCashReceived,
    depositAmountExternal,
    inputTokenSpent,
    txReceipt,
    inputToken,
  };
}
