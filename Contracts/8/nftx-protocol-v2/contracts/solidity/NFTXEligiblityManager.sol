pragma solidity 0.6.8;

import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXEligibility.sol";
import "./util/OwnableUpgradeable.sol";
import "./proxy/ClonesUpgradeable.sol";

contract NFTXEligibilityManager is OwnableUpgradeable {
  INFTXVaultFactory public nftxVaultFactory;

  struct EligibilityModule {
    address impl;
  }
  EligibilityModule[] public modules;

  function __NFTXEligibilityManager_init() public initializer {
    __Ownable_init();
  }

  function addModule(address implementation) public onlyOwner {
    EligibilityModule memory module = EligibilityModule(implementation);
    modules.push(module);
  }

  function updateModule(uint256 index, address implementation) public onlyOwner {
    modules[index].impl = implementation;
  }

  function deployEligibility(uint256 moduleIndex, bytes calldata configData) external virtual returns (address) {
    address eligImpl = modules[moduleIndex].impl;
    address eligibilityClone = ClonesUpgradeable.clone(eligImpl);
    INFTXEligibility(eligibilityClone).__NFTXEligibility_init_bytes(configData);
    return eligibilityClone;
  }

  function allModules() external view returns (EligibilityModule[] memory) {
    return modules;
  }
}