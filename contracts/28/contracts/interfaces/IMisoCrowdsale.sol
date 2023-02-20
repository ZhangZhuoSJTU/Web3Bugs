pragma solidity 0.6.12;

interface IMisoCrowdsale {
    function initCrowdsale(
        address _funder,
        address _token,
        address _paymentCurrency,
        uint256 _tokenSupply,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _rate,
        uint256 _goal,
        address _operator,
        address payable _wallet
    ) external;
}
