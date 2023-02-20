// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "../NFTPair.sol";

// Minimal implementation to set up some tests.
contract LendingClubMock {
    INFTPair private immutable nftPair;
    address private immutable investor;

    constructor(INFTPair _nftPair, address _investor) public {
        nftPair = _nftPair;
        investor = _investor;
    }

    function init() public {
        nftPair.bentoBox().setMasterContractApproval(address(this), address(nftPair.masterContract()), true, 0, bytes32(0), bytes32(0));
    }

    function willLend(uint256 tokenId, TokenLoanParams memory requested) external view returns (bool) {
        if (msg.sender != address(nftPair)) {
            return false;
        }
        TokenLoanParams memory accepted = _lendingConditions(tokenId);
        // Valuation has to be an exact match, everything else must be at least
        // as good for the lender as `accepted`.

        return
            requested.valuation == accepted.valuation &&
            requested.duration <= accepted.duration &&
            requested.annualInterestBPS >= accepted.annualInterestBPS;
    }

    function _lendingConditions(uint256 tokenId) private pure returns (TokenLoanParams memory) {
        TokenLoanParams memory conditions;
        // No specific conditions given, but we'll take all even-numbered
        // ones at 100% APY:
        if (tokenId % 2 == 0) {
            // 256-bit addition fits by the above check.
            // Cast is.. relatively safe: this is a mock implementation,
            // production use is unlikely to follow this pattern for valuing
            // loans, and manipulating the token ID can only break the logic by
            // making the loan "safer" for the lender.
            conditions.valuation = uint128((tokenId + 1) * 10**18);
            conditions.duration = 365 days;
            conditions.annualInterestBPS = 10_000;
        }
        return conditions;
    }

    function lendingConditions(address _nftPair, uint256 tokenId) external view returns (TokenLoanParams memory) {
        if (_nftPair != address(nftPair)) {
            TokenLoanParams memory empty;
            return empty;
        } else {
            return _lendingConditions(tokenId);
        }
    }

    function seizeCollateral(uint256 tokenId) external {
        nftPair.removeCollateral(tokenId, investor);
    }

    function withdrawFunds(uint256 bentoShares) external {
        nftPair.bentoBox().transfer(nftPair.asset(), address(this), investor, bentoShares);
    }
}
