pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IBurnMintableERC20.sol";


contract TestFaucet is Initializable {
  using SafeMath for uint256;

  IBurnMintableERC20 public token;

  function initialize(address _token) external initializer {
    token = IBurnMintableERC20(_token);
  }
  
  function faucet() external {
    uint256 decimals = token.decimals();
    token.mint(msg.sender, 10000*10**decimals);
  }
}
