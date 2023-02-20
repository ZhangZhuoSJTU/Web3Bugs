// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

interface IMetaVault {
    function balance() external view returns (uint);
    function setController(address _controller) external;
    function claimInsurance() external;
    function token() external view returns (address);
    function available() external view returns (uint);
    function withdrawFee(uint _amount) external view returns (uint);
    function earn() external;
    function calc_token_amount_deposit(uint[3] calldata amounts) external view returns (uint);
    function calc_token_amount_withdraw(uint _shares, address _output) external view returns (uint);
    function convert_rate(address _input, uint _amount) external view returns (uint);
    function deposit(uint _amount, address _input, uint _min_mint_amount, bool _isStake) external;
    function harvest(address reserve, uint amount) external;
    function withdraw(uint _shares, address _output) external;
    function want() external view returns (address);
    function getPricePerFullShare() external view returns (uint);
}
