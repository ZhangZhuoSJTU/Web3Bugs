// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@paulrberg/contracts/math/PRBMath.sol';
import '@paulrberg/contracts/math/PRBMathUD60x18.sol';

import './helpers/TestBaseWorkflow.sol';

/**
 * This system test file verifies the following flow:
 * launch project → issue token → pay project (claimed tokens) →  burn some of the claimed tokens → redeem rest of tokens
 */
contract TestPayBurnRedeemFlow is TestBaseWorkflow {
  JBController private _controller;
  JBETHPaymentTerminal private _terminal;
  JBTokenStore private _tokenStore;

  JBProjectMetadata private _projectMetadata;
  JBFundingCycleData private _data;
  JBFundingCycleMetadata private _metadata;
  JBGroupedSplits[] private _groupedSplits; // Default empty
  JBFundAccessConstraints[] private _fundAccessConstraints; // Default empty
  IJBPaymentTerminal[] private _terminals; // Default empty

  uint256 private _projectId;
  address private _projectOwner;
  uint256 private _weight = 1000 * 10**18;
  uint256 private _targetInWei = 10 * 10**18;

  function setUp() public override {
    super.setUp();

    _controller = jbController();
    _terminal = jbETHPaymentTerminal();
    _tokenStore = jbTokenStore();

    _projectMetadata = JBProjectMetadata({content: 'myIPFSHash', domain: 1});

    _data = JBFundingCycleData({
      duration: 14,
      weight: _weight,
      discountRate: 450000000,
      ballot: IJBFundingCycleBallot(address(0))
    });

    _metadata = JBFundingCycleMetadata({
      global: JBGlobalFundingCycleMetadata({allowSetTerminals: false, allowSetController: false}),
      reservedRate: 0,
      redemptionRate: 10000, //100%
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

    _terminals.push(_terminal);

    _fundAccessConstraints.push(
      JBFundAccessConstraints({
        terminal: _terminal,
        token: jbLibraries().ETHToken(),
        distributionLimit: _targetInWei, // 10 ETH target
        overflowAllowance: 5 ether,
        distributionLimitCurrency: 1, // Currency = ETH
        overflowAllowanceCurrency: 1
      })
    );

    _projectOwner = multisig();

    _projectId = _controller.launchProjectFor(
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
  }

  function testFuzzPayBurnRedeemFlow(
    bool payPreferClaimed, //false
    bool burnPreferClaimed, //false
    uint96 payAmountInWei, // 1
    uint256 burnTokenAmount, // 0
    uint256 redeemTokenAmount // 0
  ) external {
    // issue an ERC-20 token for project
    evm.prank(_projectOwner);
    _controller.issueTokenFor(_projectId, 'TestName', 'TestSymbol');

    address _userWallet = address(1234);

    // pay terminal
    _terminal.pay{value: payAmountInWei}(
      _projectId,
      payAmountInWei,
      address(0),
      _userWallet,
      /* _minReturnedTokens */
      0,
      /* _preferClaimedTokens */
      payPreferClaimed,
      /* _memo */
      'Take my money!',
      /* _delegateMetadata */
      new bytes(0)
    );

    // verify: beneficiary should have a balance of JBTokens
    uint256 _userTokenBalance = PRBMathUD60x18.mul(payAmountInWei, _weight);
    assertEq(_tokenStore.balanceOf(_userWallet, _projectId), _userTokenBalance);

    // verify: ETH balance in terminal should be up to date
    uint256 _terminalBalanceInWei = payAmountInWei;
    assertEq(jbPaymentTerminalStore().balanceOf(_terminal, _projectId), _terminalBalanceInWei);

    // burn tokens from beneficiary addr
    if (burnTokenAmount == 0) evm.expectRevert(abi.encodeWithSignature('NO_BURNABLE_TOKENS()'));
    else if (burnTokenAmount > _userTokenBalance)
      evm.expectRevert(abi.encodeWithSignature('INSUFFICIENT_FUNDS()'));
    else if (burnTokenAmount > uint256(type(int256).max))
      evm.expectRevert(abi.encodeWithSignature('Panic(uint256)', 0x11));
    else _userTokenBalance = _userTokenBalance - burnTokenAmount;

    evm.prank(_userWallet);
    _controller.burnTokensOf(
      _userWallet,
      _projectId,
      /* _tokenCount */
      burnTokenAmount,
      /* _memo */
      'I hate tokens!',
      /* _preferClaimedTokens */
      burnPreferClaimed
    );

    // verify: beneficiary should have a new balance of JBTokens
    assertEq(_tokenStore.balanceOf(_userWallet, _projectId), _userTokenBalance);

    // redeem tokens
    if (redeemTokenAmount > _userTokenBalance)
      evm.expectRevert(abi.encodeWithSignature('INSUFFICIENT_TOKENS()'));
    else _userTokenBalance = _userTokenBalance - redeemTokenAmount;

    evm.prank(_userWallet);
    uint256 _reclaimAmtInWei = _terminal.redeemTokensOf(
      /* _holder */
      _userWallet,
      /* _projectId */
      _projectId,
      /* _tokenCount */
      redeemTokenAmount,
      /* token (unused) */
      address(0),
      /* _minReturnedWei */
      0,
      /* _beneficiary */
      payable(_userWallet),
      /* _memo */
      'Refund me now!',
      /* _delegateMetadata */
      new bytes(0)
    );

    // verify: beneficiary should have a new balance of JBTokens
    assertEq(_tokenStore.balanceOf(_userWallet, _projectId), _userTokenBalance);

    // verify: ETH balance in terminal should be up to date
    assertEq(
      jbPaymentTerminalStore().balanceOf(_terminal, _projectId),
      _terminalBalanceInWei - _reclaimAmtInWei
    );
  }
}
