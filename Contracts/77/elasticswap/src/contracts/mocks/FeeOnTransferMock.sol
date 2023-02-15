//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import "../../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice DO NOT USE IN PRODUCTION. FOR TEST PURPOSES ONLY.
 * This token burns a fee on transfer and is used for testing fee on transfer tokens in ElasticSwap only
 */
contract FeeOnTransferMock is ERC20PresetFixedSupply, Ownable {
    using MathLib for uint256;

    uint256 public constant FEE_IN_BASIS_POINTS = 30;
    uint256 public constant BASIS_POINTS = 10000;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) ERC20PresetFixedSupply(name, symbol, initialSupply, owner) {}

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        uint256 feeAmount = (amount * FEE_IN_BASIS_POINTS) / BASIS_POINTS;
        _transfer(_msgSender(), recipient, amount - feeAmount);
        _burn(_msgSender(), feeAmount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 feeAmount = (amount * FEE_IN_BASIS_POINTS) / BASIS_POINTS;
        _transfer(sender, recipient, amount - feeAmount);
        _burn(sender, feeAmount);

        uint256 currentAllowance = allowance(sender, _msgSender());
        require(
            currentAllowance >= amount,
            "ERC20: transfer amount exceeds allowance"
        );
        _approve(sender, _msgSender(), currentAllowance - amount);

        return true;
    }
}
