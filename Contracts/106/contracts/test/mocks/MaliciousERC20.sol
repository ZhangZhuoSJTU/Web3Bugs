// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../../interfaces/INFTLoanFacilitator.sol";

contract MaliciousERC20 is ERC20, IERC721Receiver {
    INFTLoanFacilitator nftLoanFacilitator;

    constructor(address facilitatorAddress) ERC20("", "MAL") {
        nftLoanFacilitator = INFTLoanFacilitator(facilitatorAddress);
        _mint(msg.sender, 1000000 * (10**uint256(decimals())));
    }

    function mint(uint256 amount, address to) external {
        _mint(to, amount * (10**decimals()));
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        nftLoanFacilitator.closeLoan(1, address(this));
        return true;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}