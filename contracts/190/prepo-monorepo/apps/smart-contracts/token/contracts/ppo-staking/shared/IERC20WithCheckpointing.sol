// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

// From https://github.com/aragonone/voting-connectors
abstract contract IERC20WithCheckpointing {
  function balanceOf(address _owner) public view virtual returns (uint256);

  function balanceOfAt(address _owner, uint256 _blockNumber)
    public
    view
    virtual
    returns (uint256);

  function totalSupply() public view virtual returns (uint256);

  function totalSupplyAt(uint256 _blockNumber)
    public
    view
    virtual
    returns (uint256);
}
