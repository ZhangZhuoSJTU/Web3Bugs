pragma solidity 0.6.12;

interface IMisoAuction {


    function initAuction(
        address _funder,
        address _token,
        uint256 _tokenSupply,
        uint256 _startDate,
        uint256 _endDate,
        address _paymentCurrency,
        uint256 _startPrice,
        uint256 _minimumPrice,
        address _operator,
        address _pointList,
        address payable _wallet
    ) external;
    function auctionSuccessful() external view returns (bool);
    function finalized() external view returns (bool);
    function wallet() external view returns (address);
    function paymentCurrency() external view returns (address);
    function auctionToken() external view returns (address);

    function finalize() external;
    function tokenPrice() external view returns (uint256);
    function getTotalTokens() external view returns (uint256);
}
