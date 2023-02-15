// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.0;
import "../hyphen/LiquidityPool.sol";

contract LiquidityProvidersMaliciousReentrant {
    LiquidityPool public lpool;
    address private constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address private owner;
    modifier onlyOwner() {
        require(owner == msg.sender, "Unauthorized");
        _;
    }

    constructor(address _lpaddress) {
        owner = msg.sender;
        lpool = LiquidityPool(payable(_lpaddress));
    }

    fallback() external payable {
        if (address(lpool).balance >= 1 ether) {
            lpool.transfer(NATIVE, address(this), 1 ether);
        }
    }

    receive() external payable {
        if (address(lpool).balance >= 1 ether) {
            lpool.transfer(NATIVE, address(this), 1 ether);
        }
    }

    function getBalance(address target) public view returns (uint256) {
        return target.balance;
    }

    function destruct() external onlyOwner {
        selfdestruct(payable(owner));
    }
}
