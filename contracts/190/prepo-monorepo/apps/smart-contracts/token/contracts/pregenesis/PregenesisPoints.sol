// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interfaces/IPregenesisPoints.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract PregenesisPoints is
  IPregenesisPoints,
  SafeOwnable,
  ReentrancyGuard,
  ERC20
{
  address private shop;
  bytes32 private root;
  mapping(address => bool) private _userToClaim;

  constructor(string memory _name, string memory _symbol)
    ERC20(_name, _symbol)
  {}

  function setShop(address _newShop) external override onlyOwner {
    shop = _newShop;
  }

  function setMerkleTreeRoot(bytes32 _newRoot) external override onlyOwner {
    root = _newRoot;
  }

  function mint(address _to, uint256 _amount) external override onlyOwner {
    _mint(_to, _amount);
  }

  function burn(address _account, uint256 _amount)
    external
    override
    onlyOwner
  {
    _burn(_account, _amount);
  }

  function claim(uint256 _amount, bytes32[] memory _proof)
    external
    override
    nonReentrant
  {
    require(!_userToClaim[_msgSender()], "Already claimed");
    bytes32 _leaf = keccak256(abi.encodePacked(_msgSender(), _amount));
    bool _verified = MerkleProof.verify(_proof, root, _leaf);
    require(_verified, "Invalid claim");
    _userToClaim[_msgSender()] = true;
    _mint(_msgSender(), _amount);
  }

  function getShop() external view override returns (address) {
    return shop;
  }

  function getMerkleTreeRoot() external view override returns (bytes32) {
    return root;
  }

  function hasClaimed(address _account) external view override returns (bool) {
    return _userToClaim[_account];
  }

  function _beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _amount
  ) internal override {
    if (_from == address(0) && _msgSender() != owner()) {
      require(_userToClaim[_msgSender()], "Unauthorized mint");
    } else {
      require(
        _msgSender() == owner() || _msgSender() == shop,
        "Unauthorized transfer"
      );
    }
    super._beforeTokenTransfer(_from, _to, _amount);
  }
}
