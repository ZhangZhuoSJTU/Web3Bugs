import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { makeSplits, packFundingCycleMetadata, setBalance } from '../../helpers/utils.js';

import errors from '../../helpers/errors.json';

import jbDirectory from '../../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import JBEthPaymentTerminal from '../../../artifacts/contracts/JBETHPaymentTerminal.sol/JBETHPaymentTerminal.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbOperatoreStore from '../../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbToken from '../../../artifacts/contracts/JBToken.sol/JBToken.json';
import jbPrices from '../../../artifacts/contracts/JBPrices.sol/JBPrices.json';

describe('JBPayoutRedemptionPaymentTerminal::getters', function () {
  const ETH_ADDRESS = '0x000000000000000000000000000000000000EEEe';
  let CURRENCY_ETH;

  before(async function () {
    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    CURRENCY_ETH = await jbCurrencies.ETH();
  });

  async function setup() {
    let [deployer, terminalOwner] = await ethers.getSigners();

    const SPLITS_GROUP = 1;

    let [
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
      mockJbToken,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, JBEthPaymentTerminal.abi),
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
    const NON_ETH_TOKEN = mockJbToken.address;

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

    const DECIMALS = 1;

    await mockJbToken.mock.decimals.returns(DECIMALS);

    let JBERC20PaymentTerminal = await jbErc20TerminalFactory
      .connect(deployer)
      .deploy(
        NON_ETH_TOKEN,
        CURRENCY_ETH,
        CURRENCY_ETH,
        SPLITS_GROUP,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    return {
      jbEthPaymentTerminal,
      JBERC20PaymentTerminal,
      NON_ETH_TOKEN,
      DECIMALS,
    };
  }

  it('Should return true if the terminal accepts a token', async function () {
    const { JBERC20PaymentTerminal, jbEthPaymentTerminal, NON_ETH_TOKEN } = await setup();
    expect(await JBERC20PaymentTerminal.acceptsToken(NON_ETH_TOKEN, /*projectId*/ 0)).to.be.true;

    expect(await JBERC20PaymentTerminal.acceptsToken(ETH_ADDRESS, /*projectId*/ 0)).to.be.false;

    expect(await jbEthPaymentTerminal.acceptsToken(ETH_ADDRESS, /*projectId*/ 0)).to.be.true;

    expect(await jbEthPaymentTerminal.acceptsToken(NON_ETH_TOKEN, /*projectId*/ 0)).to.be.false;
  });

  it('Should return the decimals for the token', async function () {
    const { JBERC20PaymentTerminal, jbEthPaymentTerminal, NON_ETH_TOKEN, DECIMALS } = await setup();
    expect(await JBERC20PaymentTerminal.decimalsForToken(NON_ETH_TOKEN)).to.equal(DECIMALS);

    expect(await jbEthPaymentTerminal.decimalsForToken(ETH_ADDRESS)).to.equal(18);
  });

  it('Should return the currency for the token', async function () {
    const { JBERC20PaymentTerminal, jbEthPaymentTerminal, NON_ETH_TOKEN } = await setup();
    expect(await JBERC20PaymentTerminal.currencyForToken(NON_ETH_TOKEN)).to.equal(CURRENCY_ETH);

    expect(await jbEthPaymentTerminal.currencyForToken(ETH_ADDRESS)).to.equal(CURRENCY_ETH);
  });
});
