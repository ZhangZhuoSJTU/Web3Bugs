pragma solidity ^0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../zeppelin/Ownable.sol";

contract ILivepeerToken is ERC20, Ownable {
    function mint(address _to, uint256 _amount) public returns (bool);

    function burn(uint256 _amount) public;
}
