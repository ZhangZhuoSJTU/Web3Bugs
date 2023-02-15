// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/ERC20.sol";


/**
 * @title   cvxCrvToken
 * @author  ConvexFinance
 * @notice  Dumb ERC20 token that allows the operator (crvDepositor) to mint and burn tokens
 */
contract cvxCrvToken is ERC20 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public operator;

    constructor(string memory _nameArg, string memory _symbolArg)
        public
        ERC20(
            _nameArg,
            _symbolArg
        )
    {
        operator = msg.sender;
    }

    /**
     * @notice Allows the initial operator (deployer) to set the operator.
     *         Note - crvDepositor has no way to change this back, so it's effectively immutable
     */
    function setOperator(address _operator) external {
        require(msg.sender == operator, "!auth");
        operator = _operator;
    }

    /**
     * @notice Allows the crvDepositor to mint
     */
    function mint(address _to, uint256 _amount) external {
        require(msg.sender == operator, "!authorized");
        
        _mint(_to, _amount);
    }

    /**
     * @notice Allows the crvDepositor to burn
     */
    function burn(address _from, uint256 _amount) external {
        require(msg.sender == operator, "!authorized");
        
        _burn(_from, _amount);
    }

}
