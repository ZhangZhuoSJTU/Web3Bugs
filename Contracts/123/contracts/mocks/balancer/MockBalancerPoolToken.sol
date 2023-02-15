// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";

contract MockBalancerPoolToken is ERC20("MockBPT", "MockBPT") {
    struct OracleAverageQuery {
        Variable variable;
        uint256 secs;
        uint256 ago;
    }

    enum Variable {
        PAIR_PRICE,
        BPT_PRICE,
        INVARIANT
    }

    uint8 dec;

    uint256 public price;

    constructor(
        uint8 _decimals,
        address _initialRecipient,
        uint256 _initialMint
    ) {
        dec = _decimals;
        _mint(_initialRecipient, _initialMint * (10**uint256(_decimals)));
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getTimeWeightedAverage(OracleAverageQuery[] memory) external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](1);
        results[0] = price;
        return results;
    }
}
