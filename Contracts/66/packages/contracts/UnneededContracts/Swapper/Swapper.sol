// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ITraderJoeZap.sol";
import "../Interfaces/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";

contract Swapper is Ownable {
    using SafeMath for uint256;

    ITraderJoeZap TJZap;

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;

    constructor(address TJZapAddress) public {
        TJZap = ITraderJoeZap(TJZapAddress);
    }

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    )
    external
    onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;
    }


    // pulls in _amount of _token from _from address, then converts it to AVAX with TJ Zapper
    // then sends received AVAX to _to address
    // reverts if received AVAX < _minReceived or if sending AVAX failed
    // _from address needs to approve this contract before the swap can occur
    function TJSwaptoAvax(address _from, address _to, IERC20 _token, uint _amount, uint _minReceived) external returns (uint) {
        _requireFromYetiContract();
        uint initAVAXBalance = address(this).balance;

        // transfer token in
        _token.transferFrom(_from, address(this), _amount);
        _token.approve(address(TJZap), _amount);

        // swap _token for AVAX with TJ. TJ will be able to handle
        // any ERC20 as well as properly handle converting JLP tokens to AVAX:
        TJZap.zapOut(address(_token), _amount);

        uint finalAVAXBalance = address(this).balance;
        uint diff = finalAVAXBalance.sub(initAVAXBalance);
        require(diff >= _minReceived);
        (bool success, ) = _to.call{ value: diff }("");
        require(success, "failed to send AVAX");
        return diff;
    }

    function _requireFromYetiContract() internal view {
        require(msg.sender == borrowerOperationsAddress);
    }
}