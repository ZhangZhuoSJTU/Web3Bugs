// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/Iauction.sol";

contract VoteProxy is Ownable {
    Iauction public auctioneer;

    function updateAuctioneer(address _auctioneer) external onlyOwner {
        auctioneer = Iauction(_auctioneer);
    }

    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        external
        view
        returns (bytes4)
    {
        // Validate signatures
        if (auctioneer.isWinningSignature(_hash, _signature) == true) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        return (success, result);
    }
}
