// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Adminable.sol";

/// @title Total reserves of OLE
/// @author OpenLeverage
/// @notice OLE token not distributed 
/// @dev Admin of this contract is the address of Timelock.
contract Reserve is Adminable {
    IERC20 public oleToken;
    using SafeMath for uint;

    event TransferTo(address to, uint amount);

    constructor (
        address payable _admin,
        IERC20 _oleToken
    ) {
        require(_admin != address(0), "_admin address cannot be 0");
        require(address(_oleToken) != address(0), "_oleToken address cannot be 0");

        admin = _admin;
        oleToken = _oleToken;
    }

    function transfer(address to, uint amount) external onlyAdmin {
        require(to != address(0), "to address cannot be 0");
        require(amount > 0, "amount is 0!");
        oleToken.transfer(to, amount);
        emit TransferTo(to, amount);
    }
}
