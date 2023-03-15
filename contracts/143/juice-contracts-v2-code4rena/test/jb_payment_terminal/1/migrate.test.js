import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { setBalance } from '../../helpers/utils';
import errors from '../../helpers/errors.json';

import jbDirectory from '../../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';
import JBEthPaymentTerminal from '../../../artifacts/contracts/JBETHPaymentTerminal.sol/JBETHPaymentTerminal.json';
import jbErc20PaymentTerminal from '../../../artifacts/contracts/JBERC20PaymentTerminal.sol/JBERC20PaymentTerminal.json';
import jbPaymentTerminalStore from '../../../artifacts/contracts/JBSingleTokenPaymentTerminalStore.sol/JBSingleTokenPaymentTerminalStore.json';
import jbOperatoreStore from '../../../artifacts/contracts/JBOperatorStore.sol/JBOperatorStore.json';
import jbProjects from '../../../artifacts/contracts/JBProjects.sol/JBProjects.json';
import jbSplitsStore from '../../../artifacts/contracts/JBSplitsStore.sol/JBSplitsStore.json';
import jbPrices from '../../../artifacts/contracts/JBPrices.sol/JBPrices.json';
import jbToken from '../../../artifacts/contracts/JBToken.sol/JBToken.json';

describe('JBPayoutRedemptionPaymentTerminal::migrate(...)', function () {
  const PROJECT_ID = 2;
  const CURRENT_TERMINAL_BALANCE = ethers.utils.parseEther('10');

  let MIGRATE_TERMINAL_PERMISSION_INDEX;

  before(async function () {
    let jbOperationsFactory = await ethers.getContractFactory('JBOperations');
    let jbOperations = await jbOperationsFactory.deploy();

    MIGRATE_TERMINAL_PERMISSION_INDEX = await jbOperations.MIGRATE_TERMINAL();
  });

  async function setup() {
    let [deployer, projectOwner, terminalOwner, caller, ...addrs] = await ethers.getSigners();

    let [
      mockJbDirectory,
      mockJbEthPaymentTerminal,
      mockJBERC20PaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbProjects,
      mockJbSplitsStore,
      mockJbPrices,
      mockJbToken,
    ] = await Promise.all([
      deployMockContract(deployer, jbDirectory.abi),
      deployMockContract(deployer, JBEthPaymentTerminal.abi),
      deployMockContract(deployer, jbErc20PaymentTerminal.abi),
      deployMockContract(deployer, jbPaymentTerminalStore.abi),
      deployMockContract(deployer, jbOperatoreStore.abi),
      deployMockContract(deployer, jbProjects.abi),
      deployMockContract(deployer, jbSplitsStore.abi),
      deployMockContract(deployer, jbPrices.abi),
      deployMockContract(deployer, jbToken.abi),
    ]);

    const jbCurrenciesFactory = await ethers.getContractFactory('JBCurrencies');
    const jbCurrencies = await jbCurrenciesFactory.deploy();
    const CURRENCY_ETH = await jbCurrencies.ETH();

    const jbTokensFactory = await ethers.getContractFactory('JBTokens');
    const jbTokens = await jbTokensFactory.deploy();
    const TOKEN_ETH = await jbTokens.ETH();
    const NON_ETH_TOKEN = mockJbToken.address;

    const SPLITS_GROUP = 1;

    let jbEthTerminalFactory = await ethers.getContractFactory(
      'contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal',
      deployer,
    );
    let jbErc20TerminalFactory = await ethers.getContractFactory(
      'contracts/JBERC20PaymentTerminal.sol:JBERC20PaymentTerminal',
      deployer,
    );

    let jbEthPaymentTerminal = await jbEthTerminalFactory
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

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(
        projectOwner.address,
        projectOwner.address,
        PROJECT_ID,
        MIGRATE_TERMINAL_PERMISSION_INDEX,
      )
      .returns(true);

    await mockJbProjects.mock.ownerOf.withArgs(PROJECT_ID).returns(projectOwner.address);

    await mockJbEthPaymentTerminal.mock.token.returns(TOKEN_ETH);
    await mockJbEthPaymentTerminal.mock.acceptsToken.withArgs(TOKEN_ETH, PROJECT_ID).returns(true);

    await mockJBERC20PaymentTerminal.mock.token.returns(NON_ETH_TOKEN);
    await mockJBERC20PaymentTerminal.mock.acceptsToken
      .withArgs(NON_ETH_TOKEN, PROJECT_ID)
      .returns(true);

    // addToBalanceOf _amount is 0 if ETH terminal
    await mockJbEthPaymentTerminal.mock.addToBalanceOf
      .withArgs(PROJECT_ID, CURRENT_TERMINAL_BALANCE, TOKEN_ETH, '', '0x')
      .returns();
    await mockJBERC20PaymentTerminal.mock.addToBalanceOf
      .withArgs(PROJECT_ID, CURRENT_TERMINAL_BALANCE, NON_ETH_TOKEN, '', '0x')
      .returns();

    await setBalance(jbEthPaymentTerminal.address, CURRENT_TERMINAL_BALANCE);
    await setBalance(JBERC20PaymentTerminal.address, CURRENT_TERMINAL_BALANCE);

    await mockJBPaymentTerminalStore.mock.recordMigration
      .withArgs(PROJECT_ID)
      .returns(CURRENT_TERMINAL_BALANCE);

    return {
      deployer,
      projectOwner,
      terminalOwner,
      caller,
      addrs,
      jbEthPaymentTerminal,
      JBERC20PaymentTerminal,
      mockJbEthPaymentTerminal,
      mockJBERC20PaymentTerminal,
      mockJBPaymentTerminalStore,
      mockJbOperatorStore,
      mockJbToken,
      TOKEN_ETH,
    };
  }

  it('Should migrate terminal and emit event if caller is project owner', async function () {
    const { projectOwner, jbEthPaymentTerminal, mockJbEthPaymentTerminal } = await setup();

    expect(
      await jbEthPaymentTerminal
        .connect(projectOwner)
        .migrate(PROJECT_ID, mockJbEthPaymentTerminal.address),
    )
      .to.emit(jbEthPaymentTerminal, 'Migrate')
      .withArgs(
        PROJECT_ID,
        mockJbEthPaymentTerminal.address,
        CURRENT_TERMINAL_BALANCE,
        projectOwner.address,
      );
  });

  it('Should migrate terminal and emit event if caller is authorized', async function () {
    const {
      projectOwner,
      caller,
      jbEthPaymentTerminal,
      mockJbEthPaymentTerminal,
      mockJbOperatorStore,
    } = await setup();

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, MIGRATE_TERMINAL_PERMISSION_INDEX)
      .returns(true);

    expect(
      await jbEthPaymentTerminal
        .connect(caller)
        .migrate(PROJECT_ID, mockJbEthPaymentTerminal.address),
    )
      .to.emit(jbEthPaymentTerminal, 'Migrate')
      .withArgs(
        PROJECT_ID,
        mockJbEthPaymentTerminal.address,
        CURRENT_TERMINAL_BALANCE,
        caller.address,
      );
  });

  it('Cannot migrate terminal if caller is not authorized', async function () {
    const {
      projectOwner,
      caller,
      jbEthPaymentTerminal,
      mockJbEthPaymentTerminal,
      mockJbOperatorStore,
    } = await setup();

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, PROJECT_ID, MIGRATE_TERMINAL_PERMISSION_INDEX)
      .returns(false);

    await mockJbOperatorStore.mock.hasPermission
      .withArgs(caller.address, projectOwner.address, 0, MIGRATE_TERMINAL_PERMISSION_INDEX)
      .returns(false);

    await expect(
      jbEthPaymentTerminal.connect(caller).migrate(PROJECT_ID, mockJbEthPaymentTerminal.address),
    ).to.be.revertedWith(errors.UNAUTHORIZED);
  });

  it('Should migrate non-eth terminal', async function () {
    const { projectOwner, JBERC20PaymentTerminal, mockJBERC20PaymentTerminal, mockJbToken } =
      await setup();

    await mockJbToken.mock['approve(address,uint256)']
      .withArgs(mockJBERC20PaymentTerminal.address, CURRENT_TERMINAL_BALANCE)
      .returns(0);
    await JBERC20PaymentTerminal.connect(projectOwner).migrate(
      PROJECT_ID,
      mockJBERC20PaymentTerminal.address,
    );
  });

  it('Should migrate terminal with empty balance and emit event if caller is project owner', async function () {
    const {
      projectOwner,
      jbEthPaymentTerminal,
      mockJbEthPaymentTerminal,
      mockJBPaymentTerminalStore,
    } = await setup();

    await mockJBPaymentTerminalStore.mock.recordMigration.withArgs(PROJECT_ID).returns(0);

    expect(
      await jbEthPaymentTerminal
        .connect(projectOwner)
        .migrate(PROJECT_ID, mockJbEthPaymentTerminal.address),
    )
      .to.emit(jbEthPaymentTerminal, 'Migrate')
      .withArgs(PROJECT_ID, mockJbEthPaymentTerminal.address, 0, projectOwner.address);
  });

  it("Can't migrate to a terminal which doesn't accept token", async function () {
    const { TOKEN_ETH, projectOwner, jbEthPaymentTerminal, mockJbEthPaymentTerminal } =
      await setup();

    await mockJbEthPaymentTerminal.mock.acceptsToken.withArgs(TOKEN_ETH, PROJECT_ID).returns(false);

    await expect(
      jbEthPaymentTerminal
        .connect(projectOwner)
        .migrate(PROJECT_ID, mockJbEthPaymentTerminal.address),
    ).to.be.revertedWith(errors.TERMINAL_TOKENS_INCOMPATIBLE);
  });
});
