/*
    Copyright 2020 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;

import "./StandardTokenMock.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";

contract StandardTokenWithRoundingErrorMock {
    using SignedSafeMath for int256;
    using SafeCast for int256;
    using SafeMath for uint256;
        event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    uint256 constant public decimals = 18;
    string public name;
    string public symbol;
    int256 public err;

    mapping (address => uint256) public _balances;

    mapping (address => mapping (address => uint256)) public _allowed;

    uint256 public _totalSupply;


    constructor(
        address _initialAccount,
        uint256 _initialBalance,
        int256 _err,
        string memory _name,
        string memory _symbol,
        uint8 /* _decimals */
    )
        public

    {
        _balances[_initialAccount] = _initialBalance;
        _totalSupply = _initialBalance;
        name = _name;
        symbol = _symbol;
        err = _err;
    }

    /**
    * @dev Returns balance of owner with the rounding error applied
    * @param owner address whose balance is to be returned
    */
    function balanceOf(address owner) external view returns (uint256) {
        uint256 balance = _balances[owner];
        if (err >= 0) {
            return balance.add(err.toUint256());
        } else {
            uint256 absoluteError = err.mul(-1).toUint256();
            if (balance >= absoluteError) {
                return balance.sub(absoluteError);
            } else {
                return 0;
            }
        }
    }

    /**
    * @dev Transfer tokens from one address to another
    * @param _from address The address which you want to send tokens from
    * @param _to address The address which you want to transfer to
    * @param _value uint256 the amount of tokens to be transferred
    */
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool) {
        require(_to != address(0), "to null");
        require(_value <= _balances[_from], "value greater than from balance");
        require(_value <= _allowed[_from][msg.sender], "value greater than allowed");

        _balances[_from] = _balances[_from].sub(_value);
        _balances[_to] = _balances[_to].add(_value);
        _allowed[_from][msg.sender] = _allowed[_from][msg.sender].sub(_value);
        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
    * @dev Transfer tokens from one address to another
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) external returns (bool) {
        require(_to != address(0), "to null");
        require(_value <= _balances[msg.sender], "value greater than sender balance");

        _balances[msg.sender] = _balances[msg.sender].sub(_value);
        _balances[_to] = _balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function setError(int256 _err) external returns (bool) {
        err = _err;
        return true;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function allowance(
        address owner,
        address spender
    )
        external
        view
        returns (uint256)
    {
        return _allowed[owner][spender];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        require(spender != address(0));

        _allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    )
        external
        returns (bool)
    {
        require(spender != address(0));

        _allowed[msg.sender][spender] = (
          _allowed[msg.sender][spender].add(addedValue));
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    )
        external
        returns (bool)
    {
        require(spender != address(0));

        _allowed[msg.sender][spender] = (
          _allowed[msg.sender][spender].sub(subtractedValue));
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }
}