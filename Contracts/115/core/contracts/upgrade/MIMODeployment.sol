// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../liquidityMining/interfaces/IMIMO.sol";
import "../liquidityMining/interfaces/IMIMODistributor.sol";
import "../liquidityMining/interfaces/ISupplyMiner.sol";
import "../liquidityMining/interfaces/IDemandMiner.sol";
import "../liquidityMining/interfaces/IDebtNotifier.sol";
import "../libraries/WadRayMath.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "../governance/interfaces/IVotingEscrow.sol";
import "../interfaces/IAddressProvider.sol";

contract MIMODeployment {
  IGovernanceAddressProvider public ga;
  IMIMO public mimo;
  IMIMODistributor public mimoDistributor;
  ISupplyMiner public wethSupplyMiner;
  ISupplyMiner public wbtcSupplyMiner;
  ISupplyMiner public usdcSupplyMiner;
  IDemandMiner public demandMiner;
  IDebtNotifier public debtNotifier;
  IVotingEscrow public votingEscrow;

  address public weth;
  address public wbtc;
  address public usdc;

  modifier onlyManager() {
    require(ga.controller().hasRole(ga.controller().MANAGER_ROLE(), msg.sender), "Caller is not Manager");
    _;
  }

  constructor(
    IGovernanceAddressProvider _ga,
    IMIMO _mimo,
    IMIMODistributor _mimoDistributor,
    ISupplyMiner _wethSupplyMiner,
    ISupplyMiner _wbtcSupplyMiner,
    ISupplyMiner _usdcSupplyMiner,
    IDemandMiner _demandMiner,
    IDebtNotifier _debtNotifier,
    IVotingEscrow _votingEscrow,
    address _weth,
    address _wbtc,
    address _usdc
  ) public {
    require(address(_ga) != address(0));
    require(address(_mimo) != address(0));
    require(address(_mimoDistributor) != address(0));
    require(address(_wethSupplyMiner) != address(0));
    require(address(_wbtcSupplyMiner) != address(0));
    require(address(_usdcSupplyMiner) != address(0));
    require(address(_demandMiner) != address(0));
    require(address(_debtNotifier) != address(0));
    require(address(_votingEscrow) != address(0));
    require(_weth != address(0));
    require(_wbtc != address(0));
    require(_usdc != address(0));

    ga = _ga;
    mimo = _mimo;
    mimoDistributor = _mimoDistributor;
    wethSupplyMiner = _wethSupplyMiner;
    wbtcSupplyMiner = _wbtcSupplyMiner;
    usdcSupplyMiner = _usdcSupplyMiner;
    demandMiner = _demandMiner;
    debtNotifier = _debtNotifier;
    votingEscrow = _votingEscrow;

    weth = _weth;
    wbtc = _wbtc;
    usdc = _usdc;
  }

  function setup() public onlyManager {
    //IAddressProvider parallel = a.parallel();

    //bytes32 MIMO_MINTER_ROLE = keccak256("MIMO_MINTER_ROLE");
    //bytes32 DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;

    ga.setMIMO(mimo);
    ga.setVotingEscrow(votingEscrow);

    debtNotifier.setCollateralSupplyMiner(weth, wethSupplyMiner);
    debtNotifier.setCollateralSupplyMiner(wbtc, wbtcSupplyMiner);
    debtNotifier.setCollateralSupplyMiner(usdc, usdcSupplyMiner);

    address[] memory payees = new address[](4);
    payees[0] = address(wethSupplyMiner);
    payees[1] = address(wbtcSupplyMiner);
    payees[2] = address(usdcSupplyMiner);
    payees[3] = address(demandMiner);
    uint256[] memory shares = new uint256[](4);
    shares[0] = uint256(20);
    shares[1] = uint256(25);
    shares[2] = uint256(5);
    shares[3] = uint256(50);
    mimoDistributor.changePayees(payees, shares);

    bytes32 MANAGER_ROLE = ga.controller().MANAGER_ROLE();
    ga.controller().renounceRole(MANAGER_ROLE, address(this));
  }
}
