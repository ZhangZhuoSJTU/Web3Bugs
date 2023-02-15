pragma solidity ^0.5.11;

import "../zeppelin/MintableToken.sol";

contract VariableSupplyToken is MintableToken {
    event Burn(address indexed burner, uint256 value);

    /**
     * @dev Burns a specific amount of the sender's tokens
     * @param _amount The amount of tokens to be burned
     */
    function burn(uint256 _amount) public {
        _burn(msg.sender, _amount);
        emit Burn(msg.sender, _amount);
    }
}
