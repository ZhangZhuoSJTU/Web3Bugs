pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IBurnMintableERC20.sol";

interface IFaucet {
  function faucet() external;
}

contract TestFaucetTwo is Initializable {
  using SafeMath for uint256;

  IFaucet public faucetContract;
  IBurnMintableERC20 public token;

  function initialize(address _faucet, address _token) external initializer {
    faucetContract = IFaucet(_faucet);
    token = IBurnMintableERC20(_token);
  }
  
  function faucet(uint256 _amount) external {
    uint256 balance = 0;
    while (true) {
      faucetContract.faucet();
      balance = token.balanceOf(address(this));

      if (balance > _amount) {
        break;
      }
    }

    token.transfer(msg.sender, balance);
  }
}
