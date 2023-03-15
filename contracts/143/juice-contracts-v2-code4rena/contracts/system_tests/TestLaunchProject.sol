// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './helpers/TestBaseWorkflow.sol';

contract TestLaunchProject is TestBaseWorkflow {
  JBController controller;
  JBProjectMetadata _projectMetadata;
  JBFundingCycleData _data;
  JBFundingCycleMetadata _metadata;
  JBGroupedSplits[] _groupedSplits; // Default empty
  JBFundAccessConstraints[] _fundAccessConstraints; // Default empty
  IJBPaymentTerminal[] _terminals; // Default empty

  function setUp() public override {
    super.setUp();

    controller = jbController();

    _projectMetadata = JBProjectMetadata({content: 'myIPFSHash', domain: 1});

    _data = JBFundingCycleData({
      duration: 14,
      weight: 1000 * 10**18,
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
  }

  function testLaunchProject() public {
    uint256 projectId = controller.launchProjectFor(
      msg.sender,
      _projectMetadata,
      _data,
      _metadata,
      block.timestamp,
      _groupedSplits,
      _fundAccessConstraints,
      _terminals,
      ''
    );

    JBFundingCycle memory fundingCycle = jbFundingCycleStore().currentOf(projectId); //, latestConfig);

    assertEq(fundingCycle.number, 1);
    assertEq(fundingCycle.weight, 1000 * 10**18);
  }

  function testLaunchProjectFuzzWeight(uint256 WEIGHT) public {
    _data = JBFundingCycleData({
      duration: 14,
      weight: WEIGHT,
      discountRate: 450000000,
      ballot: IJBFundingCycleBallot(address(0))
    });

    uint256 projectId;

    // expectRevert on the next call if weight overflowing
    if (WEIGHT > type(uint88).max) {
      evm.expectRevert(abi.encodeWithSignature('INVALID_WEIGHT()'));

      projectId = controller.launchProjectFor(
        msg.sender,
        _projectMetadata,
        _data,
        _metadata,
        block.timestamp,
        _groupedSplits,
        _fundAccessConstraints,
        _terminals,
        ''
      );
    } else {
      projectId = controller.launchProjectFor(
        msg.sender,
        _projectMetadata,
        _data,
        _metadata,
        block.timestamp,
        _groupedSplits,
        _fundAccessConstraints,
        _terminals,
        ''
      );

      JBFundingCycle memory fundingCycle = jbFundingCycleStore().currentOf(projectId); //, latestConfig);

      assertEq(fundingCycle.number, 1);
      assertEq(fundingCycle.weight, WEIGHT);
    }
  }
}
