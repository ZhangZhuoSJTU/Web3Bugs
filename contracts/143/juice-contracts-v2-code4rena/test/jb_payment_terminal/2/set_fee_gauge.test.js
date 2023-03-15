import { expect } from 'chai';
import { ethers } from 'hardhat';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../../artifacts/contracts/interfaces/IJBDirectory.sol/IJBDirectory.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbFeeGauge from '../../../artifacts/contracts/interfaces/IJBFeeGauge.sol/IJBFeeGauge.json';
import jbOperatoreStore from '../../../artifacts/contracts/interfaces/IJBOperatorStore.sol/IJBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/interfaces/IJBProjects.sol/IJBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/interfaces/IJBSplitsStore.sol/IJBSplitsStore.json';
import jbPrices from '../../../artifacts/contracts/interfaces/IJBPrices.sol/IJBPrices.json';

describe('JBPayoutRedemptionPaymentTerminal::setFeeGauge(...)', function () {
  async function setup() {
    let [deployer, terminalOwner, caller] = await ethers.getSigners();

    let [
      mockJbDirectory,
      mockJBPaymentTerminalStore,
      mockJbFeeGauge,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbFeeGauge.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPrices.abi),
    ]);

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    const CURRENCY_ETH = await jbCurrencies.ETH();

    let jbTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );

    let jbEthPaymentTerminal = await jbTerminalFactory
      .connect(deployer)
      .deploy(
        CURRENCY_ETH,
        mockJbOperatorStore.address,
        mockJbProjects.address,
        mockJbDirectory.address,
        mockJbSplitsStore.address,
        mockJbPrices.address,
        mockJBPaymentTerminalStore.address,
        terminalOwner.address,
      );

    return {
      terminalOwner,
      caller,
      jbEthPaymentTerminal,
      mockJbFeeGauge,
    };
  }

  it('Should set the fee gauge and emit event if caller is terminal owner', async function () {
    const { terminalOwner, jbEthPaymentTerminal, mockJbFeeGauge } = await setup();

    expect(await jbEthPaymentTerminal.connect(terminalOwner).setFeeGauge(mockJbFeeGauge.address))
      .to.emit(jbEthPaymentTerminal, 'SetFeeGauge')
      .withArgs(mockJbFeeGauge.address, terminalOwner.address);
  });
  it("Can't set the fee gauge if caller is not the terminal owner", async function () {
    const { caller, jbEthPaymentTerminal, mockJbFeeGauge } = await setup();

    await expect(
      jbEthPaymentTerminal.connect(caller).setFeeGauge(mockJbFeeGauge.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
