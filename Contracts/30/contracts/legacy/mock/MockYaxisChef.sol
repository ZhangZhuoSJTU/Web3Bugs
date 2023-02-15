// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract MockYaxisChef {
    mapping(address => uint256) private _userInfo;
    mapping(address => uint256) private _pending;

    function addBalance(
        address _user,
        uint256 _amount,
        uint256 _pendingAmount
    )
        external
    {
        _userInfo[_user] += _amount;
        _pending[_user] += _pendingAmount;
    }

    function userInfo(
        uint256,
        address _user
    )
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (_userInfo[_user], 0, 0);
    }

    function pendingYaxis(
        uint256,
        address _user
    )
        external
        view
        returns (uint256)
    {
        return _pending[_user];
    }
}
