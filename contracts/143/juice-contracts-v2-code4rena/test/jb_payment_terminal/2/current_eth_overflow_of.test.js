import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbOperatoreStore from '../../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbPrices from '../../../artifacts/contracts/interfaces/IJBPrices.sol/IJBPrices.json';
import jbProjects from '../../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbToken from '../../../artifacts/contracts/JBToken.sol/JBToken.json';

describe('JBPayoutRedemptionPaymentTerminal::currentEthOverflowOf(...)', function () {
  const PROJECT_ID = 2;
  const AMOUNT = ethers.utils.parseEther('10');
  const PRICE = ethers.BigNumber.from('100');
  let CURRENCY_ETH;
  let CURRENCY_USD;

  before(async function () {
    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    CURRENCY_ETH = await jbCurrencies.ETH();
    CURRENCY_USD = await jbCurrencies.USD();
  });

  async function setup() {
    let [deployer, terminalOwner, caller] = await ethers.getSigners();

    const SPLITS_GROUP = 1;

    let [
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
      mockJbToken,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPrices.abi),
      deployMockContract(deployer, jbToken.abi),
    ]);

    let jbTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );
    let jbErc20TerminalFactory = await ethers.getContractFactory(
      'contracts/JBERC20PaymentTerminal.sol:JBERC20PaymentTerminal',
      deployer,
    );

    // ETH terminal
    let jbEthPaymentTerminal = await jbTerminalFactory
      .connect(deployer)
      .deploy(
        /*base weight currency*/ CURRENCY_ETH,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    // Non-eth 16 decimals terminal
    const NON_ETH_TOKEN = mockJbToken.address;
    const DECIMALS = 16;
    await mockJbToken.mock.decimals.returns(DECIMALS);

    let JBERC20PaymentTerminal = await jbErc20TerminalFactory
      .connect(deployer)
      .deploy(
        NON_ETH_TOKEN,
        CURRENCY_USD,
        CURRENCY_USD,
        SPLITS_GROUP,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    await mockJBPaymentTerminalStore.mock.currentOverflowOf
      .withArgs(jbEthPaymentTerminal.address, PROJECT_ID)
      .returns(AMOUNT);
    await mockJBPaymentTerminalStore.mock.currentOverflowOf
      .withArgs(JBERC20PaymentTerminal.address, PROJECT_ID)
      .returns(AMOUNT);

    await mockJBPaymentTerminalStore.mock.prices.returns(mockJbPrices.address);

    return {
      caller,
      jbEthPaymentTerminal,
      JBERC20PaymentTerminal,
      mockJbDirectory,
      mockJbPrices,
      mockJBPaymentTerminalStore,
    };
  }

  it('Should return the current terminal overflow in eth if the terminal uses eth as currency', async function () {
    const { jbEthPaymentTerminal } = await setup();
    expect(await jbEthPaymentTerminal.currentEthOverflowOf(PROJECT_ID)).to.equal(AMOUNT);
  });

  it('Should return the current terminal overflow quoted in eth if the terminal uses another currency than eth', async function () {
    const { mockJbPrices, JBERC20PaymentTerminal } = await setup();

    await mockJbPrices.mock.priceFor
      .withArgs(CURRENCY_USD, CURRENCY_ETH, 16) // 16-decimal
      .returns(100);

    expect(await JBERC20PaymentTerminal.currentEthOverflowOf(PROJECT_ID)).to.equal(
      AMOUNT.mul(ethers.utils.parseEther('1')).div(PRICE),
    );
  });
});
