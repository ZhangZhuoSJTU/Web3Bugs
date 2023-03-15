// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './helpers/TestBaseWorkflow.sol';

contract TestERC20Terminal is TestBaseWorkflow {
  JBController controller;
  JBProjectMetadata _projectMetadata;
  JBFundingCycleData _data;
  JBFundingCycleMetadata _metadata;
  JBGroupedSplits[] _groupedSplits;
  JBFundAccessConstraints[] _fundAccessConstraints;
  IJBPaymentTerminal[] _terminals;
  JBTokenStore _tokenStore;
  address _projectOwner;

  uint256 WEIGHT = 1000 * 10**18;

  function setUp() public override {
    super.setUp();

    _projectOwner = multisig();

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

    _terminals.push(jbERC20PaymentTerminal());
  }

  function testAllowanceERC20() public {
    JBERC20PaymentTerminal terminal = jbERC20PaymentTerminal();

    _fundAccessConstraints.push(
      JBFundAccessConstraints({
        terminal: terminal,
        token: address(jbToken()),
        distributionLimit: 10 * 10**18,
        overflowAllowance: 5 * 10**18,
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

    address caller = msg.sender;
    evm.label(caller, 'caller');
    evm.prank(_projectOwner);
    jbToken().transfer(caller, 20 * 10**18);

    evm.prank(caller); // back to regular msg.sender (bug?)
    jbToken().approve(address(terminal), 20 * 10**18);
    evm.prank(caller); // back to regular msg.sender (bug?)
    terminal.pay(
      projectId,
      20 * 10**18,
      address(0),
      msg.sender,
      0,
      false,
      'Forge test',
      new bytes(0)
    ); // funding target met and 10 token are now in the overflow

    // verify: beneficiary should have a balance of JBTokens (divided by 2 -> reserved rate = 50%)
    uint256 _userTokenBalance = PRBMath.mulDiv(20, WEIGHT, 2); // 18dec is in WEIGHT
    assertEq(_tokenStore.balanceOf(msg.sender, projectId), _userTokenBalance);

    // verify: balance in terminal should be up to date
    assertEq(jbPaymentTerminalStore().balanceOf(terminal, projectId), 20 * 10**18);

    // Discretionary use of overflow allowance by project owner (allowance = 5ETH)
    evm.prank(_projectOwner); // Prank only next call
    terminal.useAllowanceOf(
      projectId,
      5 * 10**18,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      payable(msg.sender), // Beneficiary
      'MEMO'
    );
    assertEq(
      jbToken().balanceOf(msg.sender),
      PRBMath.mulDiv(5 * 10**18, jbLibraries().MAX_FEE(), jbLibraries().MAX_FEE() + terminal.fee())
    );

    // Distribute the funding target ETH -> splits[] is empty -> everything in left-over, to project owner
    uint256 initBalance = jbToken().balanceOf(_projectOwner);
    evm.prank(_projectOwner);
    terminal.distributePayoutsOf(
      projectId,
      10 * 10**18,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      'Foundry payment' // Memo
    );
    // Funds leaving the ecosystem -> fee taken
    assertEq(
      jbToken().balanceOf(_projectOwner),
      initBalance +
        (10 * 10**18 * jbLibraries().MAX_FEE()) /
        (terminal.fee() + jbLibraries().MAX_FEE())
    );

    // redeem eth from the overflow by the token holder:
    uint256 senderBalance = _tokenStore.balanceOf(msg.sender, projectId);
    evm.prank(msg.sender);
    terminal.redeemTokensOf(
      msg.sender,
      projectId,
      senderBalance,
      address(0), //token (unused)
      0,
      payable(msg.sender),
      'gimme my money back',
      new bytes(0)
    );

    // verify: beneficiary should have a balance of 0 JBTokens
    assertEq(_tokenStore.balanceOf(msg.sender, projectId), 0);
  }

  function testFuzzedAllowanceERC20(
    uint232 ALLOWANCE,
    uint232 TARGET,
    uint96 BALANCE
  ) public {
    evm.assume(jbToken().totalSupply() >= BALANCE);

    JBERC20PaymentTerminal terminal = jbERC20PaymentTerminal();

    _fundAccessConstraints.push(
      JBFundAccessConstraints({
        terminal: terminal,
        token: address(jbToken()),
        distributionLimit: TARGET,
        overflowAllowance: ALLOWANCE,
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

    address caller = msg.sender;
    evm.label(caller, 'caller');
    evm.prank(_projectOwner);
    jbToken().transfer(caller, BALANCE);

    evm.prank(caller); // back to regular msg.sender (bug?)
    jbToken().approve(address(terminal), BALANCE);
    evm.prank(caller); // back to regular msg.sender (bug?)
    terminal.pay(projectId, BALANCE, address(0), msg.sender, 0, false, 'Forge test', new bytes(0)); // funding target met and 10 ETH are now in the overflow

    // verify: beneficiary should have a balance of JBTokens (divided by 2 -> reserved rate = 50%)
    uint256 _userTokenBalance = PRBMath.mulDiv(BALANCE, (WEIGHT / 10**18), 2);
    if (BALANCE != 0) assertEq(_tokenStore.balanceOf(msg.sender, projectId), _userTokenBalance);

    // verify: ETH balance in terminal should be up to date
    assertEq(jbPaymentTerminalStore().balanceOf(terminal, projectId), BALANCE);

    bool willRevert;

    // Discretionary use of overflow allowance by project owner (allowance = 5ETH)
    if (ALLOWANCE == 0) {
      evm.expectRevert(abi.encodeWithSignature('INADEQUATE_CONTROLLER_ALLOWANCE()'));
      willRevert = true;
    } else if (TARGET >= BALANCE || ALLOWANCE > (BALANCE - TARGET)) {
      // Too much to withdraw or no overflow ?
      evm.expectRevert(abi.encodeWithSignature('INADEQUATE_PAYMENT_TERMINAL_STORE_BALANCE()'));
      willRevert = true;
    }

    evm.prank(_projectOwner); // Prank only next call
    terminal.useAllowanceOf(
      projectId,
      ALLOWANCE,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      payable(msg.sender), // Beneficiary
      'MEMO'
    );

    if (BALANCE != 0 && !willRevert)
      assertEq(
        jbToken().balanceOf(msg.sender),
        PRBMath.mulDiv(ALLOWANCE, jbLibraries().MAX_FEE(), jbLibraries().MAX_FEE() + terminal.fee())
      );

    // Distribute the funding target ETH -> no split then beneficiary is the project owner
    uint256 initBalance = jbToken().balanceOf(_projectOwner);

    if (TARGET > BALANCE)
      evm.expectRevert(abi.encodeWithSignature('INADEQUATE_PAYMENT_TERMINAL_STORE_BALANCE()'));

    if (TARGET == 0)
      evm.expectRevert(abi.encodeWithSignature('DISTRIBUTION_AMOUNT_LIMIT_REACHED()'));

    evm.prank(_projectOwner);
    terminal.distributePayoutsOf(
      projectId,
      TARGET,
      1, // Currency
      address(0), //token (unused)
      0, // Min wei out
      'Foundry payment' // Memo
    );
    // Funds leaving the ecosystem -> fee taken
    if (TARGET <= BALANCE && TARGET != 0)
      assertEq(
        jbToken().balanceOf(_projectOwner),
        initBalance +
          PRBMath.mulDiv(TARGET, jbLibraries().MAX_FEE(), terminal.fee() + jbLibraries().MAX_FEE())
      );

    // redeem eth from the overflow by the token holder:
    uint256 senderBalance = _tokenStore.balanceOf(msg.sender, projectId);

    evm.prank(msg.sender);
    terminal.redeemTokensOf(
      msg.sender,
      projectId,
      senderBalance,
      address(0), //token (unused)
      0,
      payable(msg.sender),
      'gimme my token back',
      new bytes(0)
    );

    // verify: beneficiary should have a balance of 0 JBTokens
    assertEq(_tokenStore.balanceOf(msg.sender, projectId), 0);
  }
}
