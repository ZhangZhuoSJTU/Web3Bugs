// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './helpers/TestBaseWorkflow.sol';

contract TestAllowance is TestBaseWorkflow {
  JBController controller;
  JBProjectMetadata _projectMetadata;
  JBFundingCycleData _data;
  JBFundingCycleMetadata _metadata;
  JBGroupedSplits[] _groupedSplits;
  JBFundAccessConstraints[] _fundAccessConstraints;
  IJBPaymentTerminal[] _terminals;
  JBTokenStore _tokenStore;
  address _projectOwner;
  address _beneficiary;

  uint256 WEIGHT = 1000 * 10**18;

  function setUp() public override {
    super.setUp();

    _projectOwner = multisig();

    _beneficiary = beneficiary();

    _tokenStore = jbTokenStore();

    controller = jbController();

    _projectMetadata = JBProjectMetadata({content: 'myIPFSHash', domain: 1});

    _data = JBFundingCycleData({
      duration: 14,
      weight: WEIGHT,
      discountRate: 450000000,
      ballot: IJBFundingCycleBallot(address(0))
    });

    _metadata = JBFundingCycleMetadata({
      global: JBGlobalFundingCycleMetadata({allowSetTerminals: false, allowSetController: false}),
      reservedRate: 5000, //50%
      redemptionRate: 5000, //50%
      ballotRedemptionRate: 0,
      pausePay: false,
      pauseDistributions: false,
      pauseRedeem: false,
      pauseBurn: false,
      allowMinting: false,
      allowChangeToken: false,
      allowTerminalMigration: false,
      allowControllerMigration: false,
      holdFees: false,
      useTotalOverflowForRedemptions: false,
      useDataSourceForPay: false,
      useDataSourceForRedeem: false,
      dataSource: address(0)
    });

    _terminals.push(jbETHPaymentTerminal());
  }

  function testAllowance() public {
    JBETHPaymentTerminal terminal = jbETHPaymentTerminal();

    _fundAccessConstraints.push(
      JBFundAccessConstraints({
        terminal: terminal,
        token: jbLibraries().ETHToken(),
        distributionLimit: 10 ether,
        overflowAllowance: 5 ether,
        distributionLimitCurrency: jbLibraries().ETH(),
        overflowAllowanceCurrency: jbLibraries().ETH()
      })
    );

    uint256 projectId = controller.launchProjectFor(
      _projectOwner,
      _projectMetadata,
      _data,
      _metadata,
      block.timestamp,
      _groupedSplits,
      _fundAccessConstraints,
      _terminals,
      ''
    );

    terminal.pay{value: 20 ether}(
      projectId,
      20 ether,
      address(0),
      _beneficiary,
      0,
      false,
      'Forge test',
      new bytes(0)
    ); // funding target met and 10 ETH are now in the overflow

    // verify: beneficiary should have a balance of JBTokens (divided by 2 -> reserved rate = 50%)
    uint256 _userTokenBalance = PRBMath.mulDiv(20 ether, (WEIGHT / 10**18), 2);
    assertEq(_tokenStore.balanceOf(_beneficiary, projectId), _userTokenBalance);

    // verify: ETH balance in terminal should be up to date
    assertEq(jbPaymentTerminalStore().balanceOf(terminal, projectId), 20 ether);

    // Discretionary use of overflow allowance by project owner (allowance = 5ETH)
    evm.prank(_projectOwner); // Prank only next call
    terminal.useAllowanceOf(
      projectId,
      5 ether,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      payable(_beneficiary), // Beneficiary
      'MEMO'
    );
    assertEq(
      (_beneficiary).balance,
      PRBMath.mulDiv(5 ether, jbLibraries().MAX_FEE(), jbLibraries().MAX_FEE() + terminal.fee())
    );

    // Distribute the funding target ETH -> splits[] is empty -> everything in left-over, to project owner
    evm.prank(_projectOwner);
    terminal.distributePayoutsOf(
      projectId,
      10 ether,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      'Foundry payment' // Memo
    );
    assertEq(
      _projectOwner.balance,
      (10 ether * jbLibraries().MAX_FEE()) / (terminal.fee() + jbLibraries().MAX_FEE())
    );

    // redeem eth from the overflow by the token holder:
    uint256 senderBalance = _tokenStore.balanceOf(_beneficiary, projectId);
    evm.prank(_beneficiary);
    terminal.redeemTokensOf(
      _beneficiary,
      projectId,
      senderBalance,
      address(0), //token (unused)
      0,
      payable(_beneficiary),
      'gimme my money back',
      new bytes(0)
    );

    // verify: beneficiary should have a balance of 0 JBTokens
    assertEq(_tokenStore.balanceOf(_beneficiary, projectId), 0);
  }

  function testFuzzAllowance(
    uint232 ALLOWANCE,
    uint232 TARGET,
    uint96 BALANCE
  ) public {
    evm.assume(jbToken().totalSupply() >= BALANCE);

    unchecked {
      // Check for overflow
      evm.assume(ALLOWANCE + TARGET >= ALLOWANCE && ALLOWANCE + TARGET >= TARGET);
    }

    uint256 CURRENCY = jbLibraries().ETH(); // Avoid testing revert on this call...

    JBETHPaymentTerminal terminal = jbETHPaymentTerminal();

    _fundAccessConstraints.push(
      JBFundAccessConstraints({
        terminal: terminal,
        token: jbLibraries().ETHToken(),
        distributionLimit: TARGET,
        distributionLimitCurrency: CURRENCY,
        overflowAllowance: ALLOWANCE,
        overflowAllowanceCurrency: CURRENCY
      })
    );

    uint256 projectId = controller.launchProjectFor(
      _projectOwner,
      _projectMetadata,
      _data,
      _metadata,
      block.timestamp,
      _groupedSplits,
      _fundAccessConstraints,
      _terminals,
      ''
    );

    terminal.pay{value: BALANCE}(
      projectId,
      BALANCE,
      address(0),
      _beneficiary,
      0,
      false,
      'Forge test',
      new bytes(0)
    );

    // verify: beneficiary should have a balance of JBTokens (divided by 2 -> reserved rate = 50%)
    uint256 _userTokenBalance = PRBMath.mulDiv(BALANCE, (WEIGHT / 10**18), 2);
    if (BALANCE != 0) assertEq(_tokenStore.balanceOf(_beneficiary, projectId), _userTokenBalance);

    // verify: ETH balance in terminal should be up to date
    assertEq(jbPaymentTerminalStore().balanceOf(terminal, projectId), BALANCE);

    evm.startPrank(_projectOwner);

    bool willRevert;

    if (ALLOWANCE == 0) {
      evm.expectRevert(abi.encodeWithSignature('INADEQUATE_CONTROLLER_ALLOWANCE()'));
      willRevert = true;
    } else if (TARGET >= BALANCE || ALLOWANCE > (BALANCE - TARGET)) {
      // Too much to withdraw or no overflow ?
      evm.expectRevert(abi.encodeWithSignature('INADEQUATE_PAYMENT_TERMINAL_STORE_BALANCE()'));
      willRevert = true;
    }
    terminal.useAllowanceOf(
      projectId,
      ALLOWANCE,
      CURRENCY, // Currency
      address(0), //token (unused)
      0, // Min wei out
      payable(_beneficiary), // Beneficiary
      'MEMO'
    );

    if (
      !willRevert && BALANCE != 0 // if allowance ==0 or not enough overflow (target>=balance, allowance > overflow) // there is something to transfer
    )
      assertEq(
        (_beneficiary).balance,
        PRBMath.mulDiv(ALLOWANCE, jbLibraries().MAX_FEE(), jbLibraries().MAX_FEE() + terminal.fee())
      );

    if (TARGET > BALANCE)
      evm.expectRevert(abi.encodeWithSignature('INADEQUATE_PAYMENT_TERMINAL_STORE_BALANCE()'));

    if (TARGET == 0)
      evm.expectRevert(abi.encodeWithSignature('DISTRIBUTION_AMOUNT_LIMIT_REACHED()'));

    terminal.distributePayoutsOf(
      projectId,
      TARGET,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      'Foundry payment' // Memo
    );
    if (TARGET <= BALANCE && TARGET != 0)
      assertEq(
        _projectOwner.balance,
        (TARGET * jbLibraries().MAX_FEE()) / (terminal.fee() + jbLibraries().MAX_FEE())
      );
  }
}
