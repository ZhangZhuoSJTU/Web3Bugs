import { BigNumber } from "ethers";
import { deployments, ethers } from "hardhat";
import * as utils from "../utils/TestUtils";
import * as requests from "../utils/requestHelper";
import { IERC20, IPriceFeed, IVaultsCore, IVaultsDataProvider, IWETH, SuperVault } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

type externalContracts = {
  superVaultInstance: SuperVault;
  wmatic: IWETH;
  priceFeed: IPriceFeed;
  mimo: IERC20;
  vaultsDataProvider: IVaultsDataProvider;
  par: IERC20;
  vaultsCore: IVaultsCore;
};

type testSignersObj = {
  user: SignerWithAddress;
  multisigSigner: SignerWithAddress;
};

type setupData = {
  testSigners: testSignersObj;
  testContracts: externalContracts;
};

const depositAmount = utils.ONE;

// The maximum leverage depends on the Minimum Collateral Ratio of the collateral
// 130% = 1/(1-100/130) = 4.33333333x
// 150% = 1/(1-100/150) = 3x
// 250% = 1/(1-100/250) = 1.66666667x
const leverageTimes = 150; // 1.5x leverage
// const leverageTimes = 200; // 2x leverage
// const leverageTimes = 300; // 3x leverage

const borrowAmount = depositAmount.mul(leverageTimes - 100).div(100); // How much of the leveraged asset to borrow in AAVE
const aaveRepaymentAmount = borrowAmount.mul(10005).div(10000); // Add 0.09% Aave cost

let startingwMatic: BigNumber;
let parToSell: BigNumber; // How much par to sell to pay back the AAVE loan ; this is dependent on the leveraged asset's price
let testSigners: testSignersObj;
let testContracts: externalContracts;

const setupIntegration = deployments.createFixture(async (): Promise<setupData> => {
  await deployments.fixture(["SuperVault", "SuperVaultFactory"]);

  const multisigSigner: SignerWithAddress = await ethers.getSigner(utils.MULTISIG);
  const [user]: SignerWithAddress[] = await ethers.getSigners(); // Default signer

  const testSigners: testSignersObj = { multisigSigner, user };
  const testContracts = await utils.setupContracts(user);

  // Exchange 1 MATIC for WMATIC
  await utils.depositWMatic(depositAmount, testContracts.wmatic);
  const approveTx = await testContracts.wmatic.approve(testContracts.superVaultInstance.address, utils.ONE);
  await approveTx.wait(1);

  // We need to pay back the leverage amount to let the flashloan succeed
  // We add a 1% margin to the PAR amount here because the pool might be slightly off
  // For bigger amounts you definitely need a higher margin
  parToSell = await testContracts.priceFeed.convertFrom(utils.WMATIC, borrowAmount.mul(101).div(100));
  startingwMatic = await testContracts.wmatic.balanceOf(user.address);

  return { testSigners, testContracts };
});

const afterLeverageTests = async (
  testContracts: externalContracts,
  testSigners: testSignersObj,
  dexTxData: any,
  aggregator: number,
) => {
  const leverageTx = await testContracts.superVaultInstance.leverage(
    utils.WMATIC,
    depositAmount,
    borrowAmount,
    parToSell,
    dexTxData,
    aggregator,
  );

  await leverageTx.wait(1);

  const lastVaultID = await testContracts.vaultsDataProvider.vaultCount();
  const vaultCollateralBalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(lastVaultID);
  //  We add padding to amounts in the api calls, so we should at least have the borrow amount
  expect(vaultCollateralBalance).to.be.at.least(
    borrowAmount.add(startingwMatic),
    `Not enough Vault collateral after leveraging, only ${vaultCollateralBalance}`,
  );

  const vaultDebt = await testContracts.vaultsDataProvider.vaultDebt(lastVaultID);
  expect(vaultDebt).to.be.at.least(
    parToSell,
    `Vault debt should be at least equal to sold par, but is instead ${vaultDebt}`,
  );

  const beforeMaticbalance = await testContracts.wmatic.balanceOf(testSigners.user.address);
  expect(beforeMaticbalance).to.equal(
    ethers.utils.parseEther("0"),
    `there shouldn't be wmatic balance in the vault before withdrawing, instead there is ${beforeMaticbalance}`,
  );

  // Withdraw 10% from the vault
  await testContracts.superVaultInstance.withdrawFromVault(lastVaultID, vaultCollateralBalance.div(10));
  const afterVaultWithdrawbalance = await testContracts.wmatic.balanceOf(testSigners.user.address);
  expect(afterVaultWithdrawbalance).to.equal(
    vaultCollateralBalance.div(10),
    `User should have more wmatic after withdrawing from vault, only has ${afterVaultWithdrawbalance}`,
  );

  expect(await testContracts.vaultsDataProvider.vaultCollateralBalance(lastVaultID)).to.be.closeTo(
    vaultCollateralBalance.mul(90).div(100),
    10,
    `Not the right collateral balance left in vault after withdrawing from vault, is ${vaultCollateralBalance}`,
  );

  await testContracts.mimo.connect(testSigners.multisigSigner).transfer(utils.WMATIC_MINER, utils.ONE); // Send one MIMO reward to the miner

  const parBeforeBorrow = await testContracts.par.balanceOf(testSigners.user.address);
  expect(parBeforeBorrow).to.equal(
    "0",
    `Par balance should be 0 before borrowing par but is instead ${parBeforeBorrow}`,
  );

  const mimoBeforeBorrow = await testContracts.mimo.balanceOf(testSigners.user.address);
  expect(mimoBeforeBorrow).to.equal(
    "0",
    `MIMO balance should be 0 before borrowing par, but is instead ${mimoBeforeBorrow}`,
  );

  const parBorrowAmount = ethers.utils.parseEther(".0001");
  await testContracts.superVaultInstance.borrowFromVault(lastVaultID, parBorrowAmount);
  const parAfterBorrow = await testContracts.par.balanceOf(testSigners.user.address);
  expect(parAfterBorrow).to.equal(
    parBorrowAmount,
    `par borrow amount should equal .0001 but is instead ${parBorrowAmount}`,
  );

  const mimoAfterBorrow = await testContracts.mimo.balanceOf(testSigners.user.address);
  expect(mimoAfterBorrow).to.be.at.least("10000", "Mimo after borrowing PAR should be nonZero"); // Should be nontrivial amount of mimo

  await testContracts.mimo.connect(testSigners.multisigSigner).transfer(utils.WMATIC_MINER, utils.ONE); // Send one MIMO reward to the miner
  await testContracts.superVaultInstance.releaseMIMO("0x8b264d48c0887bc2946ea8995c3afcdbb576f799"); // WMATIC miner on Polygon
  const mimioAfterRelease = await testContracts.mimo.balanceOf(testSigners.user.address);
  expect(mimioAfterRelease).to.be.at.least(mimoAfterBorrow, "MIMO in user's wallet should increase after releasing");

  await testContracts.mimo.connect(testSigners.multisigSigner).transfer(utils.WMATIC_MINER, utils.ONE); // Send one MIMO reward to the miner
  await testContracts.wmatic.deposit({
    value: depositAmount,
  });
  await testContracts.wmatic.approve(testContracts.superVaultInstance.address, utils.ONE);
  await testContracts.superVaultInstance.leverage(
    utils.WMATIC,
    depositAmount,
    borrowAmount,
    parToSell,
    dexTxData,
    aggregator,
  );

  const secondLeverageVaultCollateralBalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(
    lastVaultID,
  );
  expect(secondLeverageVaultCollateralBalance).to.be.at.least(
    vaultCollateralBalance,
    `On second leverage, vault collateral balance should more than that in the first leverage`,
  );

  const secondVaultDebt = await testContracts.vaultsDataProvider.vaultDebt(lastVaultID);
  expect(secondVaultDebt).to.be.at.least(
    vaultDebt,
    "On second leverage, vault debt should be greater than that after the first leverage",
  );

  const secondLeverageMimobalance = await testContracts.mimo.balanceOf(testSigners.user.address);
  expect(secondLeverageMimobalance).to.be.at.least(
    mimioAfterRelease,
    "MIMO in user's wallet should increase after second leverage",
  );
};

// Deposit and borrow matic from a vault so that it can be rebalanced or emptied
const setupVault = async (testContracts: externalContracts, depositAmount: BigNumber, borrowAmount: BigNumber) => {
  await testContracts.wmatic.approve(testContracts.superVaultInstance.address, depositAmount);
  await testContracts.superVaultInstance.depositAndBorrowFromVault(utils.WMATIC, depositAmount, borrowAmount);
};

const afterRebalanceTests = async (
  testContracts: externalContracts,
  dexTxData: any,
  aggregator: number,
  deleverageAmount: BigNumber,
  usdcAmount: BigNumber,
) => {
  const wmaticPrice = await testContracts.priceFeed.convertFrom(utils.WMATIC, utils.ONE);
  // ParAmount that will be taken out of the USDC vault; must be less than (deleveraged amount)/(mcr)
  const parAmount = wmaticPrice.mul(70).div(110);
  const lastVaultID = await testContracts.vaultsDataProvider.vaultCount();

  await testContracts.superVaultInstance.rebalance(
    lastVaultID,
    utils.USDC,
    utils.WMATIC,
    deleverageAmount,
    parAmount,
    dexTxData,
    aggregator,
  );

  const vaultCollateralBalanceAfterRebalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(
    lastVaultID,
  );

  // Remaining vault balance should be less than (starting bal) - (deleveraged amount) due to loan fees
  expect(vaultCollateralBalanceAfterRebalance).to.be.at.most(utils.ONE.sub(deleverageAmount));

  const vaultDebtAfterRebalance = await testContracts.vaultsDataProvider.vaultDebt(lastVaultID);
  expect(vaultDebtAfterRebalance).to.equal(0);

  const usdcVaultID = await testContracts.vaultsDataProvider.vaultCount();

  const usdcVaultCollateralBalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(usdcVaultID);

  // USDC in vault should be close to the aggregator value
  expect(usdcVaultCollateralBalance).to.be.closeTo(usdcAmount, 10000);

  const usdcVaultDebt = await testContracts.vaultsDataProvider.vaultDebt(usdcVaultID);
  expect(usdcVaultDebt).to.be.at.least(parAmount); // Debt should be at least instead of equal because of fees
};

const emptyVaultTest = async (
  testContracts: externalContracts,
  loanAmount: BigNumber,
  dexTxData: any,
  aggregator: number,
  startingCollateral: BigNumber,
  startingVaultDebt: BigNumber,
) => {
  const startingwMaticbalance = await testContracts.wmatic.balanceOf(testSigners.user.address);
  const startingParbalance = await testContracts.par.balanceOf(testSigners.user.address);
  const lastVaultId = await testContracts.vaultsDataProvider.vaultCount();
  const currentDebt = await testContracts.vaultsDataProvider.vaultDebt(lastVaultId);
  const currentVaultCollateralbalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(lastVaultId);
  expect(currentVaultCollateralbalance).to.be.equal(startingCollateral, "EmptyVault Test Setup Not Done correctly");
  expect(currentDebt).to.be.at.least(startingVaultDebt, "EmptyVault Test Setup Not Done correctly");

  await testContracts.superVaultInstance.emptyVault(lastVaultId, utils.WMATIC, loanAmount, dexTxData, aggregator);

  const afterVaultCollateralbalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(lastVaultId);
  const afterVaultDebt = await testContracts.vaultsDataProvider.vaultDebt(lastVaultId);
  const afterwMaticbalance = await testContracts.wmatic.balanceOf(testSigners.user.address);
  const afterParbalance = await testContracts.par.balanceOf(testSigners.user.address);
  expect(afterVaultCollateralbalance).to.equal(0, "Collateral balance must be zero after emptyVault operation");
  expect(afterVaultDebt).to.equal(0, "Debt balance must be zero after emptyVault operation");
  const repayAmount = loanAmount.mul(10005).div(10000);
  const expectedwMaticWithdraw = startingCollateral.sub(repayAmount);
  expect(afterwMaticbalance.sub(startingwMaticbalance)).to.equal(expectedwMaticWithdraw); // Should retreive all collateral from vault
  expect(afterParbalance).to.be.at.above(startingParbalance); // Should give some leftover par from the swap back to the owner
};

describe("Test SuperVault Contract Integrations", async () => {
  before(async () => {
    await utils.resetNetworkFork();
  });
  beforeEach(async () => {
    ({ testSigners, testContracts } = await setupIntegration());
  });

  after(async () => {
    utils.disableFork(); // Switch back to unforked network after integration tests
  });

  // Only test integration for  depositToVault since depositAndBorrowFromVault is tested in rebalance integration tests
  it("Should integrate with deposit for VaultsCore", async () => {
    const WMaticToDeposit = utils.ONE.mul(50).div(100);
    await testContracts.wmatic.approve(testContracts.superVaultInstance.address, WMaticToDeposit);
    await testContracts.superVaultInstance.depositToVault(utils.WMATIC, WMaticToDeposit);
    const WMaticVaultID = await testContracts.vaultsDataProvider.vaultCount();
    const vaultBalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(WMaticVaultID);
    expect(vaultBalance).to.equal(WMaticToDeposit);
  });

  it("Should integrate with depositETH for VaultsCore", async () => {
    const maticToDeposit = utils.ONE.mul(50).div(100);
    await testContracts.superVaultInstance.depositETHToVault({ value: maticToDeposit });
    const wMaticVaultID = await testContracts.vaultsDataProvider.vaultCount();
    const vaultbalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(wMaticVaultID);
    expect(vaultbalance).to.equal(maticToDeposit);
  });

  it("Should integrate with depositETHAndBorrowFromVault for VaultsCore", async () => {
    const WMaticToDeposit = utils.ONE.div(2);
    const borrowWMaticAmount = WMaticToDeposit.div(3); // MCR for matic is 2.5
    await testContracts.superVaultInstance.depositETHAndBorrowFromVault(borrowWMaticAmount, { value: WMaticToDeposit });
    const WMaticVaultID = await testContracts.vaultsDataProvider.vaultCount();
    const vaultbalance = await testContracts.vaultsDataProvider.vaultCollateralBalance(WMaticVaultID);
    expect(vaultbalance).to.equal(WMaticToDeposit);
    const vaultDebtbalance = await testContracts.vaultsDataProvider.vaultBaseDebt(WMaticVaultID);
    expect(vaultDebtbalance).to.be.closeTo(borrowWMaticAmount, utils.ONE.div(20));
  });

  it("Integrate with paraswap leverage", async () => {
    const pricesParams = {
      srcToken: utils.PAR,
      destToken: utils.WMATIC,
      side: "SELL",
      network: 137,
      srcDecimals: 18,
      destDecimals: 18,
      amount: parToSell.toString(),
    };

    // Call Paraswap
    const routeData = await requests.getParaswapPriceRoute(pricesParams);

    const bodyParams = {
      srcToken: utils.PAR,
      destToken: utils.WMATIC,
      priceRoute: routeData.data.priceRoute,
      srcAmount: parToSell.toString(),
      slippage: 100, // 1% slippage
      userAddress: testContracts.superVaultInstance.address,
    };

    // We now use the paraswap API to get the best route to sell the PAR we just loaned
    const { data } = await requests.getParaswapTxData(bodyParams);

    if (aaveRepaymentAmount.gt(routeData.data.priceRoute.destAmount)) {
      throw new Error("this won't work, we will not get enough WMATIC to repay the flashloan, try to borrow more PAR");
    }

    await afterLeverageTests(testContracts, testSigners, data.data, utils.aggregators.PARASWAP);
  });

  it("Integrate with OneInch leverage", async () => {
    const OneInchSwapParams = {
      fromTokenAddress: utils.PAR,
      toTokenAddress: utils.WMATIC,
      amount: parToSell.toString(),
      fromAddress: testContracts.superVaultInstance.address,
      slippage: 1,
      disableEstimate: true,
    };

    const { data } = await requests.getOneInchTxData(OneInchSwapParams);

    if (aaveRepaymentAmount.gt(data.toTokenAmount)) {
      throw new Error("this won't work, we will not get enough WMATIC to repay the flashloan, try to borrow more PAR");
    }

    await afterLeverageTests(testContracts, testSigners, data.tx.data, utils.aggregators.ONEINCH);
  });

  it("Should error for invalid values of Aggregators", async () => {
    // Use Paraswap for this test, but can be done with OneInch as well
    const pricesParams = {
      srcToken: utils.PAR,
      destToken: utils.WMATIC,
      side: "SELL",
      network: 137,
      srcDecimals: 18,
      destDecimals: 18,
      amount: parToSell.toString(),
    };

    // Call Paraswap
    const routeData = await requests.getParaswapPriceRoute(pricesParams);

    const bodyParams = {
      srcToken: utils.PAR,
      destToken: utils.WMATIC,
      priceRoute: routeData.data.priceRoute,
      srcAmount: parToSell.toString(),
      slippage: 100, // 1% slippage
      userAddress: testContracts.superVaultInstance.address,
    };

    // We now use the paraswap API to get the best route to sell the PAR we just loaned
    const { data } = await requests.getParaswapTxData(bodyParams);

    if (aaveRepaymentAmount.gt(routeData.data.priceRoute.destAmount)) {
      throw new Error("this won't work, we will not get enough WMATIC to repay the flashloan, try to borrow more PAR");
    }

    await expect(
      testContracts.superVaultInstance.leverage(
        utils.WMATIC,
        depositAmount,
        borrowAmount,
        parToSell,
        data.data,
        utils.aggregators.INVALID1,
      ),
    ).to.be.reverted;

    await expect(
      testContracts.superVaultInstance.leverage(
        utils.WMATIC,
        depositAmount,
        borrowAmount,
        parToSell,
        data.data,
        utils.aggregators.INVALID2,
      ),
    ).to.be.reverted;
  });

  it("Should give specific error message for when there isn't enough balance to pay back loan", async () => {
    // Use Paraswap for this test, but can be done with OneInch as well
    const pricesParams = {
      srcToken: utils.PAR,
      destToken: utils.WMATIC,
      side: "SELL",
      network: 137,
      srcDecimals: 18,
      destDecimals: 18,
      amount: parToSell.toString(),
    };

    // Call Paraswap
    const routeData = await requests.getParaswapPriceRoute(pricesParams);

    const bodyParams = {
      srcToken: utils.PAR,
      destToken: utils.WMATIC,
      priceRoute: routeData.data.priceRoute,
      srcAmount: parToSell.toString(),
      slippage: 100, // 1% slippage
      userAddress: testContracts.superVaultInstance.address,
    };

    // We now use the paraswap API to get the best route to sell the PAR we just loaned
    const { data } = await requests.getParaswapTxData(bodyParams);

    if (aaveRepaymentAmount.gt(routeData.data.priceRoute.destAmount)) {
      throw new Error("this won't work, we will not get enough WMATIC to repay the flashloan, try to borrow more PAR");
    }

    const insufficientBorrowAmount = borrowAmount.div(2);

    await expect(
      testContracts.superVaultInstance.leverage(
        utils.WMATIC,
        depositAmount,
        borrowAmount,
        insufficientBorrowAmount,
        data.data,
        utils.aggregators.PARASWAP,
      ),
    ).to.be.revertedWith("SV101");
  });

  it("Should integrate rebalancer with OneInch", async () => {
    // Total deleverage amount needs to be less than total amount in vault to account for flashloan fees
    const deleverageAmount = utils.ONE.mul(75).div(100);
    const startingVaultAmount = utils.ONE; // Total starting collateral in the vault
    const borrowedAmount = startingVaultAmount.mul(30).div(130); // Starting borrowed amount of volatile asset
    // (borrowedAmount) + (deleveraged amount) must be less than total vault balance

    // Setup a new vault and borrow
    await setupVault(testContracts, startingVaultAmount, borrowedAmount);

    const OneInchSwapParams = {
      fromTokenAddress: utils.WMATIC,
      toTokenAddress: utils.USDC,
      amount: deleverageAmount.toString(),
      fromAddress: testContracts.superVaultInstance.address,
      slippage: 1,
      disableEstimate: true,
    };

    const { data } = await requests.getOneInchTxData(OneInchSwapParams);

    await afterRebalanceTests(
      testContracts,
      data.tx.data,
      utils.aggregators.ONEINCH,
      deleverageAmount,
      data.toTokenAmount,
    );
  });

  it("Should integrate balancer with Paraswap", async () => {
    // Total deleverage amount needs to be less than total amount in vault to account for flashloan fees
    const deleverageAmount = utils.ONE.mul(75).div(100); // Amount to convert in a less volitile asset
    const startingVaultAmount = utils.ONE; // Total starting collateral in the vault
    const borrowedAmount = startingVaultAmount.mul(30).div(130); // Borrowed amount + deleveraged amount must be less than total vault balance

    // Setup a new vault and borrow
    await setupVault(testContracts, startingVaultAmount, borrowedAmount);

    const pricesParams = {
      srcToken: utils.WMATIC,
      destToken: utils.USDC,
      side: "SELL",
      network: 137,
      srcDecimals: 18,
      destDecimals: 18,
      amount: deleverageAmount.toString(),
    };

    // Call Paraswap
    const routeData = await requests.getParaswapPriceRoute(pricesParams);

    const bodyParams = {
      srcToken: utils.WMATIC,
      destToken: utils.USDC,
      priceRoute: routeData.data.priceRoute,
      srcAmount: deleverageAmount.toString(),
      slippage: 100, // 1% slippage
      userAddress: testContracts.superVaultInstance.address,
    };

    // We now use the paraswap API to get the best route to sell the PAR we just loaned
    const { data } = await requests.getParaswapTxData(bodyParams);

    await afterRebalanceTests(
      testContracts,
      data.data,
      utils.aggregators.PARASWAP,
      deleverageAmount,
      routeData.data.priceRoute.destAmount,
    );
  });

  it("Should integrate emptyVault with VaultsCore and OneInch", async () => {
    const startingDepositAmount = utils.ONE;
    const startingBorrowAmount = startingDepositAmount.div(4);
    const loanAmount = startingBorrowAmount.mul(101).div(100); // Value, in wmatic, of the amount of value of wmatic needed to pay off the debt
    // Pad debtRepayAmount by 1% to account for swap slippage and any additional debt accumulated over the test

    await setupVault(testContracts, startingDepositAmount, startingBorrowAmount);

    const OneInchSwapParams = {
      fromTokenAddress: utils.WMATIC,
      toTokenAddress: utils.PAR,
      amount: loanAmount.toString(),
      fromAddress: testContracts.superVaultInstance.address,
      slippage: 1,
      disableEstimate: true,
    };
    const { data } = await requests.getOneInchTxData(OneInchSwapParams);

    await emptyVaultTest(
      testContracts,
      loanAmount,
      data.tx.data,
      utils.aggregators.ONEINCH,
      startingDepositAmount,
      startingBorrowAmount,
    );
  });

  it("Should integrate emptyVault with VaultsCore and Paraswap", async () => {
    const startingDepositAmount = utils.ONE;
    const startingBorrowAmount = startingDepositAmount.div(4);
    const loanAmount = startingBorrowAmount.mul(101).div(100); // Value, in wmatic, of the amount of value of wmatic needed to pay off the debt

    await setupVault(testContracts, startingDepositAmount, startingBorrowAmount);

    const pricesParams = {
      srcToken: utils.WMATIC,
      destToken: utils.PAR,
      side: "SELL",
      network: 137,
      srcDecimals: 18,
      destDecimals: 18,
      amount: loanAmount.toString(),
    };

    // Call Paraswap
    const routeData = await requests.getParaswapPriceRoute(pricesParams);

    const bodyParams = {
      srcToken: utils.WMATIC,
      destToken: utils.PAR,
      priceRoute: routeData.data.priceRoute,
      srcAmount: loanAmount.toString(),
      slippage: 100, // 1% slippage
      userAddress: testContracts.superVaultInstance.address,
    };

    // We now use the paraswap API to get the best route to sell the PAR we just loaned
    const { data } = await requests.getParaswapTxData(bodyParams);

    await emptyVaultTest(
      testContracts,
      loanAmount,
      data.data,
      utils.aggregators.PARASWAP,
      startingDepositAmount,
      startingBorrowAmount,
    );
  });
});
