// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/ERC20.sol";


/**
 * @title   DepositToken
 * @author  ConvexFinance
 * @notice  Simply creates a token that can be minted and burned from the operator
 */
contract DepositToken is ERC20 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public operator;

    /**
     * @param _operator         Booster
     * @param _lptoken          Underlying LP token for deposits
     * @param _namePostfix      Postfixes lpToken name
     * @param _symbolPrefix     Prefixed lpToken symbol
     */
    constructor(
        address _operator,
        address _lptoken,
        string memory _namePostfix,
        string memory _symbolPrefix
    )
        public
        ERC20(
             string(
                abi.encodePacked(ERC20(_lptoken).name(), _namePostfix)
            ),
            string(abi.encodePacked(_symbolPrefix, ERC20(_lptoken).symbol()))
        )
    {
        operator =  _operator;
    }
    
    function mint(address _to, uint256 _amount) external {
        require(msg.sender == operator, "!authorized");
        
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external {
        require(msg.sender == operator, "!authorized");
        
        _burn(_from, _amount);
    }

}
