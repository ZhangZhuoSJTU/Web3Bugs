// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

/// @title NAV library
/// @notice Library for transfer, mint, burn and distribute vToken shares
/// @dev Used in conjunction with vToken
library NAV {
    /// @notice Initial shares quantity
    uint internal constant INITIAL_QUANTITY = 10000;

    struct Data {
        uint lastBalance;
        uint totalSupply;
        mapping(address => uint) balanceOf;
    }

    /// @notice Transfer `_amount` of shares between given addresses
    /// @param _from Account to send shares from
    /// @param _to Account to send shares to
    /// @param _amount Amount of shares to send
    function transfer(
        Data storage self,
        address _from,
        address _to,
        uint _amount
    ) internal {
        self.balanceOf[_from] -= _amount;
        self.balanceOf[_to] += _amount;
    }

    /// @notice Mints shares to the `_recipient` account
    /// @param self Data structure reference
    /// @param _balance New shares maximum limit
    /// @param _recipient Recipient that will receive minted shares
    function mint(
        Data storage self,
        uint _balance,
        address _recipient
    ) internal returns (uint shares) {
        uint amount = _balance - self.lastBalance;
        uint _totalSupply = self.totalSupply;
        if (_totalSupply != 0) {
            shares = (amount * _totalSupply) / self.lastBalance;
        } else {
            shares = amount - INITIAL_QUANTITY;
            _mint(self, address(0), INITIAL_QUANTITY);
        }
        require(shares > 0, "NAV: INSUFFICIENT_AMOUNT");
        _mint(self, _recipient, shares);
    }

    /// @notice Burns shares from the `_recipient` account
    /// @param self Data structure reference
    /// @param _balance Shares balance
    function burn(Data storage self, uint _balance) internal returns (uint amount) {
        uint value = self.balanceOf[address(this)];
        amount = (value * _balance) / self.totalSupply;
        require(amount > 0, "NAV: INSUFFICIENT_SHARES_BURNED");
        _burn(self, address(this), value);
    }

    /// @notice Synchronizes token balances
    /// @param self Data structure reference
    /// @param _newBalance Total asset amount
    function sync(Data storage self, uint _newBalance) internal {
        if (self.lastBalance != _newBalance) {
            self.lastBalance = _newBalance;
        }
    }

    /// @notice Returns amount of tokens corresponding to the given `_shares` amount
    /// @param self Data structure reference
    /// @param _shares Amount of shares
    /// @param _balance Shares balance
    /// @return Amount of tokens corresponding to given shares
    function assetBalanceForShares(
        Data storage self,
        uint _shares,
        uint _balance
    ) internal view returns (uint) {
        uint _totalSupply = self.totalSupply;
        if (_totalSupply != 0) {
            return (_shares * _balance) / _totalSupply;
        }

        return 0;
    }

    /// @notice Returns amount of shares that will be minted for the given tokens amount
    /// @param self Data structure reference
    /// @param _amount Tokens amount
    /// @return Amount of mintable shares
    function mintableShares(Data storage self, uint _amount) internal view returns (uint) {
        uint _totalSupply = self.totalSupply;
        if (_totalSupply != 0) {
            return (_amount * _totalSupply) / self.lastBalance;
        }

        return _amount - INITIAL_QUANTITY;
    }

    /// @notice Mints shares for the given account
    /// @param self Data structure reference
    /// @param _account Account to mint shares for
    /// @param _amount Amount shares to mint
    function _mint(
        Data storage self,
        address _account,
        uint _amount
    ) private {
        self.balanceOf[_account] += _amount;
        self.totalSupply += _amount;
    }

    /// @notice Burns shares of the given account
    /// @param self Data structure reference
    /// @param _account Account to burn shares of
    /// @param _amount Amount shares to burn
    function _burn(
        Data storage self,
        address _account,
        uint _amount
    ) private {
        self.balanceOf[_account] -= _amount;
        self.totalSupply -= _amount;
    }
}
