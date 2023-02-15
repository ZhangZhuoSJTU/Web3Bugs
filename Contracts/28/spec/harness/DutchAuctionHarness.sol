pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../contracts/Auctions/DutchAuction.sol";

/*
 * Harness for the DutchAuction to support the Certora Prover.
 * Contains some simplifications and helper getter methods.
 */
contract DutchAuctionHarness is DutchAuction {
    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    mapping(uint256 => uint256) public currentPrice;
    mapping(uint256 => uint256) public tokenPrice_;

    ////////////////////////////////////////////////////////////
    //                         Getters                        //
    ////////////////////////////////////////////////////////////

    function tokenBalanceOf(address token, address user) public returns (uint256) {
        if (token == ETH_ADDRESS) {
                return address(user).balance;
        } else {
            return IERC20(token).balanceOf(user);
        }
    }

    function getCommitmentsTotal() public returns (uint256) {
        return marketStatus.commitmentsTotal;
    }

    function getStartPrice() public returns (uint256) {
        return marketPrice.startPrice;
    }

    ////////////////////////////////////////////////////////////
    //                     Simplifications                    //
    ////////////////////////////////////////////////////////////

    function _currentPrice() internal override view returns (uint256) {
        uint256 price = currentPrice[block.timestamp];
        require(price <= marketPrice.startPrice);
        require(price >= marketPrice.minimumPrice); 
        return price;
    }

    function clearingPrice() public override view returns (uint256) {
        uint256 tokenPrice_ = tokenPrice();
        uint256 priceFunction_ = priceFunction(); 
        if (tokenPrice_ > priceFunction_) {
            return tokenPrice_;
        }
        return priceFunction_;
    }

    function batch(bytes[] calldata calls, bool revertOnFail) external override payable
            returns (bool[] memory successes, bytes[] memory results) { }


    function batchCommitEth(address payable _beneficiary1, bool readAndAgreedToMarketParticipationAgreement1, address payable _beneficiary2, 
                        bool readAndAgreedToMarketParticipationAgreement2) external payable
    {

        commitEth( _beneficiary1, readAndAgreedToMarketParticipationAgreement1);
        commitEth( _beneficiary2, readAndAgreedToMarketParticipationAgreement2);
                 
    }

}