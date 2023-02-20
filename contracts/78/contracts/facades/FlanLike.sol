// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract FlanLike is IERC20 {
    function mint(address recipient, uint256 amount)
        public
        virtual
        returns (bool);

    function setBurnOnTransferFee(uint8 fee) public virtual;

    function burn(uint256 amount) public virtual returns (bool); 
}
