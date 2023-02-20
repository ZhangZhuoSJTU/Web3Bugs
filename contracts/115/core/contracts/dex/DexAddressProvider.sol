// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "./interfaces/IDexAddressProvider.sol";
import "../interfaces/IAddressProvider.sol";

contract DexAddressProvider is IDexAddressProvider {
  IAddressProvider private _a;
  mapping(uint256 => Dex) private _dexMapping;

  constructor(IAddressProvider a, Dex[] memory dexes) public {
    require(address(a) != address(0), "LM000");
    _a = a;
    for (uint256 i; i < dexes.length; i++) {
      _dexMapping[i] = Dex({ proxy: dexes[i].proxy, router: dexes[i].router });
    }
  }

  modifier onlyManager() {
    require(_a.controller().hasRole(_a.controller().MANAGER_ROLE(), msg.sender), "LM010");
    _;
  }

  /**
    Set the dex address for dexMapping
    @dev only manager or address(this) can call this method.
    @param _index the index for the dex.
    @param _proxy the address for the proxy.
    @param _router the address for the router.
  */
  function setDexMapping(
    uint256 _index,
    address _proxy,
    address _router
  ) external override onlyManager {
    require(_proxy != address(0), "LM000");
    require(_router != address(0), "LM000");
    _dexMapping[_index] = Dex({ proxy: _proxy, router: _router });
  }

  function parallel() public view override returns (IAddressProvider) {
    return _a;
  }

  /** 
    Returns proxy and router address for a specific dex index
    @param index the index for the dex
    @return (proxy address, router address)
  */
  function dexMapping(uint256 index) public view override returns (address, address) {
    return (_dexMapping[index].proxy, _dexMapping[index].router);
  }
}
