// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/ITokenShop.sol";
import "./interfaces/IPurchaseHook.sol";
import "prepo-shared-contracts/contracts/Pausable.sol";
import "prepo-shared-contracts/contracts/WithdrawERC20.sol";
import "prepo-shared-contracts/contracts/WithdrawERC721.sol";
import "prepo-shared-contracts/contracts/WithdrawERC1155.sol";

contract TokenShop is
  ITokenShop,
  Pausable,
  WithdrawERC20,
  WithdrawERC721,
  WithdrawERC1155
{
  using SafeERC20 for IERC20;

  IERC20 private paymentToken;
  IPurchaseHook private purchaseHook;
  mapping(address => mapping(uint256 => uint256)) private contractToIdToPrice;
  mapping(address => mapping(address => uint256))
    private userToERC721ToPurchaseCount;
  mapping(address => mapping(address => mapping(uint256 => uint256)))
    private userToERC1155ToIdToPurchaseCount;

  constructor(address _newPaymentToken) {
    paymentToken = IERC20(_newPaymentToken);
  }

  function setContractToIdToPrice(
    address[] memory _tokenContracts,
    uint256[] memory _ids,
    uint256[] memory _prices
  ) external override onlyOwner {
    require(
      _tokenContracts.length == _prices.length &&
        _ids.length == _prices.length,
      "Array length mismatch"
    );
    uint256 _arrayLength = _tokenContracts.length;
    for (uint256 i; i < _arrayLength; ) {
      contractToIdToPrice[_tokenContracts[i]][_ids[i]] = _prices[i];
      unchecked {
        ++i;
      }
    }
  }

  function setPurchaseHook(address _newPurchaseHook)
    external
    override
    onlyOwner
  {
    purchaseHook = IPurchaseHook(_newPurchaseHook);
  }

  function purchase(
    address[] memory _tokenContracts,
    uint256[] memory _ids,
    uint256[] memory _amounts,
    uint256[] memory _purchasePrices
  ) external override nonReentrant whenNotPaused {
    require(
      _tokenContracts.length == _ids.length &&
        _ids.length == _amounts.length &&
        _amounts.length == _purchasePrices.length,
      "Array length mismatch"
    );
    IPurchaseHook _hook = purchaseHook;
    require(address(_hook) != address(0), "Purchase hook not set");
    uint256 _arrayLength = _tokenContracts.length;
    for (uint256 i; i < _arrayLength; ) {
      uint256 _price = contractToIdToPrice[_tokenContracts[i]][_ids[i]];
      require(_price != 0, "Non-purchasable item");
      require(_purchasePrices[i] >= _price, "Purchase price < Price");
      uint256 _totalPaymentAmount = _price * _amounts[i];
      paymentToken.transferFrom(
        _msgSender(),
        address(this),
        _totalPaymentAmount
      );
      bool _isERC1155 = IERC1155(_tokenContracts[i]).supportsInterface(
        type(IERC1155).interfaceId
      );
      if (_isERC1155) {
        _hook.hookERC1155(
          msg.sender,
          _tokenContracts[i],
          _ids[i],
          _amounts[i]
        );
        userToERC1155ToIdToPurchaseCount[msg.sender][_tokenContracts[i]][
          _ids[i]
        ] += _amounts[i];
        IERC1155(_tokenContracts[i]).safeTransferFrom(
          address(this),
          _msgSender(),
          _ids[i],
          _amounts[i],
          ""
        );
      } else {
        _hook.hookERC721(msg.sender, _tokenContracts[i], _ids[i]);
        ++userToERC721ToPurchaseCount[msg.sender][_tokenContracts[i]];
        IERC721(_tokenContracts[i]).safeTransferFrom(
          address(this),
          _msgSender(),
          _ids[i]
        );
      }
      unchecked {
        ++i;
      }
    }
  }

  function getPrice(address _tokenContract, uint256 _id)
    external
    view
    override
    returns (uint256)
  {
    return contractToIdToPrice[_tokenContract][_id];
  }

  function getPaymentToken() external view override returns (address) {
    return address(paymentToken);
  }

  function getPurchaseHook() external view override returns (IPurchaseHook) {
    return purchaseHook;
  }

  function getERC721PurchaseCount(address _user, address _tokenContract)
    external
    view
    override
    returns (uint256)
  {
    return userToERC721ToPurchaseCount[_user][_tokenContract];
  }

  function getERC1155PurchaseCount(
    address _user,
    address _tokenContract,
    uint256 _id
  ) external view override returns (uint256) {
    return userToERC1155ToIdToPurchaseCount[_user][_tokenContract][_id];
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes memory
  ) external pure returns (bytes4) {
    return this.onERC721Received.selector;
  }
}
