// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './helpers/TestBaseWorkflow.sol';

/// @notice This file tests JBToken related flows
contract TestTokenFlow is TestBaseWorkflow {
  JBController private _controller;
  JBTokenStore private _tokenStore;

  JBProjectMetadata private _projectMetadata;
  JBFundingCycleData private _data;
  JBFundingCycleMetadata private _metadata;
  JBGroupedSplits[] private _groupedSplits; // Default empty
  JBFundAccessConstraints[] private _fundAccessConstraints; // Default empty
  IJBPaymentTerminal[] private _terminals; // Default empty

  uint256 private _projectId;
  address private _projectOwner;
  uint256 private _reservedRate = 5000;

  function setUp() public override {
    super.setUp();

    _controller = jbController();
    _tokenStore = jbTokenStore();

    _projectMetadata = JBProjectMetadata({content: 'myIPFSHash', domain: 1});

    _data = JBFundingCycleData({
      duration: 14,
      weight: 1000 * 10**18,
      discountRate: 450000000,
      ballot: IJBFundingCycleBallot(address(0))
    });

    _metadata = JBFundingCycleMetadata({
      global: JBGlobalFundingCycleMetadata({allowSetTerminals: false, allowSetController: false}),
      reservedRate: _reservedRate,
      redemptionRate: 5000, //50%
      ballotRedemptionRate: 0,
      pausePay: false,
      pauseDistributions: false,
      pauseRedeem: false,
      pauseBurn: false,
      allowMinting: true,
      allowChangeToken: true,
      allowTerminalMigration: false,
      allowControllerMigration: false,
      holdFees: false,
      useTotalOverflowForRedemptions: false,
      useDataSourceForPay: false,
      useDataSourceForRedeem: false,
      dataSource: address(0)
    });

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

  /**
   * @notice tests the following flow with fuzzed values:
   * launch project → issue token → change token → mint token → burn token
   */
  function testFuzzTokenFlow(
    uint256 mintAmount,
    uint256 burnAmount,
    bool mintPreferClaimed,
    bool burnPreferClaimed
  ) public {
    // Might overflow in processed token tracker if burn amount >= max int256 (ie (2**256)/2 -1 )
    evm.assume(burnAmount < (2**256)/2);
    
    // calls will originate from projectOwner addr
    evm.startPrank(_projectOwner);

    // issue an ERC-20 token for project
    _controller.issueTokenFor(_projectId, 'TestName', 'TestSymbol');

    // create a new IJBToken and change it's owner to the tokenStore
    IJBToken _newToken = new JBToken('NewTestName', 'NewTestSymbol');
    _newToken.transferOwnership(_projectId, address(_tokenStore));

    // change the projects token to _newToken
    _controller.changeTokenOf(_projectId, _newToken, address(0));

    // confirm the project's new JBToken
    assertEq(address(_tokenStore.tokenOf(_projectId)), address(_newToken));

    address _beneficiary = address(1234);
    uint256 _expectedTokenBalance = 0;
    uint256 _beneficiaryTokenAmount = mintAmount / 2; // 50% reserved rate results in half the mintAmount

    if (mintAmount == 0) evm.expectRevert(abi.encodeWithSignature('ZERO_TOKENS_TO_MINT()'));
    else _expectedTokenBalance = _beneficiaryTokenAmount;

    // mint tokens to beneficiary addr
    _controller.mintTokensOf(
      _projectId,
      mintAmount,
      _beneficiary,
      'Mint memo',
      mintPreferClaimed,
      true /*use reserved rate*/
    );

    // total token balance should be half of token count due to 50% reserved rate
    assertEq(_tokenStore.balanceOf(_beneficiary, _projectId), _expectedTokenBalance);

    if (burnAmount == 0) evm.expectRevert(abi.encodeWithSignature('NO_BURNABLE_TOKENS()'));
    else if (burnAmount > _expectedTokenBalance)
      evm.expectRevert(abi.encodeWithSignature('INSUFFICIENT_FUNDS()'));
    else _expectedTokenBalance = _expectedTokenBalance - burnAmount;

    // burn tokens from beneficiary addr
    // next call will originate from holder addr
    evm.stopPrank();
    evm.prank(_beneficiary);
    _controller.burnTokensOf(
      _beneficiary,
      _projectId,
      /* _tokenCount */
      burnAmount,
      'Burn memo',
      burnPreferClaimed
    );

    // total balance of tokens should be updated
    assertEq(_tokenStore.balanceOf(_beneficiary, _projectId), _expectedTokenBalance);
  }

  /**
   * @notice tests the following corner case:
   * launch project → issue token → mint max claimed tokens → mint max unclaimed tokens → try to claim unclaimed tokens
   */
  function testLargeTokenClaimFlow() public {
    // calls will originate from projectOwner addr
    evm.startPrank(_projectOwner);

    // issue an ERC-20 token for project
    _controller.issueTokenFor(_projectId, 'TestName', 'TestSymbol');

    address _beneficiary = address(1234);

    // mint claimed tokens to beneficiary addr
    _controller.mintTokensOf(
      _projectId,
      type(uint224).max,
      _beneficiary,
      'Mint memo',
      true,
      false /*use reserved rate*/
    );

    // mint unclaimed tokens to beneficiary addr
    _controller.mintTokensOf(
      _projectId,
      type(uint256).max,
      _beneficiary,
      'Mint memo',
      false,
      false
    );

    // try to claim the unclaimed tokens
    evm.stopPrank();
    evm.prank(_beneficiary);
    _tokenStore.claimFor(
      _beneficiary,
      _projectId,
      /* _amount */
      1
    );
  }

  /**
   * @notice tests the following corner case:
   * launch project → issue token → mint unclaimed tokens → switch to new token → claim unclaimed tokens of the new token
   */
  function testTokenChangeFlow() public {
    // calls will originate from projectOwner addr
    evm.startPrank(_projectOwner);

    // issue an ERC-20 token for project
    _controller.issueTokenFor(_projectId, 'TestName', 'TestSymbol');

    address _beneficiary = address(1234);

    // mint unclaimed tokens to beneficiary addr
    _controller.mintTokensOf(
      _projectId,
      type(uint256).max,
      _beneficiary,
      'Mint memo',
      false,
      false
    );

    // create a new IJBToken and change it's owner to the tokenStore
    IJBToken _newToken = new JBToken('NewTestName', 'NewTestSymbol');
    _newToken.transferOwnership(_projectId, address(_tokenStore));

    // change the projects token to _newToken
    _controller.changeTokenOf(_projectId, _newToken, address(0));

    // claim and mint the max possible amount of unclaimed tokens
    evm.stopPrank();
    evm.prank(_beneficiary);
    _tokenStore.claimFor(_beneficiary, _projectId, type(uint224).max);

    // total token balanced should be updated
    assertEq(_newToken.balanceOf(_beneficiary, _projectId), type(uint224).max);
    assertEq(
      _tokenStore.unclaimedBalanceOf(_beneficiary, _projectId),
      type(uint256).max - type(uint224).max
    );
    assertEq(_tokenStore.unclaimedTotalSupplyOf(_projectId), type(uint256).max - type(uint224).max);
    assertEq(_tokenStore.balanceOf(_beneficiary, _projectId), type(uint256).max);
  }
}
