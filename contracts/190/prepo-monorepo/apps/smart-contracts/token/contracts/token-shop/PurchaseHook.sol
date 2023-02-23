// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IPurchaseHook.sol";
import "./interfaces/ITokenShop.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract PurchaseHook is IPurchaseHook, SafeOwnable {
  mapping(address => uint256) private erc721ToMaxPurchasesPerUser;
  mapping(address => mapping(uint256 => uint256))
    private erc1155ToIdToMaxPurchasesPerUser;
  ITokenShop private tokenShop;

  //TODO: EOA validation check in hookERC721 and hookERC1155 implementation
  function hookERC721(
    address _user,
    address _tokenContract,
    uint256 // _tokenId
  ) external view override {
    ITokenShop _shop = tokenShop;
    require(address(_shop) != address(0), "Token shop not set in hook");
    uint256 _maxPurchaseAmount = erc721ToMaxPurchasesPerUser[_tokenContract];
    if (_maxPurchaseAmount != 0) {
      require(
        _shop.getERC721PurchaseCount(_user, _tokenContract) <
          _maxPurchaseAmount,
        "ERC721 purchase limit reached"
      );
    }
  }

  function hookERC1155(
    address _user,
    address _tokenContract,
    uint256 _tokenId,
    uint256 _amount
  ) external view override {
    ITokenShop _shop = tokenShop;
    require(address(_shop) != address(0), "Token shop not set in hook");
    uint256 _maxPurchaseAmount = erc1155ToIdToMaxPurchasesPerUser[
      _tokenContract
    ][_tokenId];
    if (_maxPurchaseAmount != 0) {
      require(
        _shop.getERC1155PurchaseCount(_user, _tokenContract, _tokenId) +
          _amount <=
          _maxPurchaseAmount,
        "ERC1155 purchase limit reached"
      );
    }
  }

  function setTokenShop(address _newTokenShop) external override onlyOwner {
    tokenShop = ITokenShop(_newTokenShop);
  }

  function setMaxERC721PurchasesPerUser(
    address[] memory _contracts,
    uint256[] memory _amounts
  ) external override onlyOwner {
    require(_contracts.length == _amounts.length, "Array length mismatch");
    uint256 _arrayLength = _contracts.length;
    for (uint256 i; i < _arrayLength; ) {
      erc721ToMaxPurchasesPerUser[_contracts[i]] = _amounts[i];
      unchecked {
        ++i;
      }
    }
  }

  function setMaxERC1155PurchasesPerUser(
    address[] memory _contracts,
    uint256[] memory _ids,
    uint256[] memory _amounts
  ) external override onlyOwner {
    require(
      _contracts.length == _amounts.length && _ids.length == _amounts.length,
      "Array length mismatch"
    );
    uint256 _arrayLength = _contracts.length;
    for (uint256 i; i < _arrayLength; ) {
      erc1155ToIdToMaxPurchasesPerUser[_contracts[i]][_ids[i]] = _amounts[i];
      unchecked {
        ++i;
      }
    }
  }

  function getMaxERC721PurchasesPerUser(address _tokenContract)
    external
    view
    override
    returns (uint256)
  {
    return erc721ToMaxPurchasesPerUser[_tokenContract];
  }

  function getMaxERC1155PurchasesPerUser(address _tokenContract, uint256 _id)
    external
    view
    override
    returns (uint256)
  {
    return erc1155ToIdToMaxPurchasesPerUser[_tokenContract][_id];
  }

  function getTokenShop() external view override returns (ITokenShop) {
    return tokenShop;
  }
}
