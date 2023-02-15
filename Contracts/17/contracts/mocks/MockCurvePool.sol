// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "../interfaces/ICurve.sol";

// Mock curve 3pool
contract MockCurvePool is ICurve3Pool {
    address[] public override coins;

    uint256 N_COINS = 3;
    uint256[] public PRECISION_MUL = [1, 1000000000000, 1000000000000];
    uint256[] public decimals = [18, 6, 6];
    uint256[] public rates = [1001835600000000000, 999482, 999069];
    uint256 constant vp = 1005330723799997871;
    uint256[] vpSingle = [996343755718242128, 994191500557422927, 993764724471177721];

    constructor(address[] memory _tokens) public {
        coins = _tokens;
    }

    function setTokens(
        address[] calldata _tokens,
        uint256[] calldata _precisions,
        uint256[] calldata _rates
    ) external {
        coins = _tokens;
        N_COINS = _tokens.length;
        PRECISION_MUL = _precisions;
        rates = _rates;
    }

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view override returns (uint256) {
        return (vpSingle[uint256(i)] * _token_amount) / ((uint256(10)**18) * PRECISION_MUL[uint256(i)]);
    }

    function calc_token_amount(uint256[3] calldata inAmounts, bool deposit) external view override returns (uint256) {
        deposit;
        uint256 totalAmount;
        for (uint256 i = 0; i < vpSingle.length; i++) {
            totalAmount += (inAmounts[i] * vpSingle[i]) / (10**decimals[i]);
        }
        return totalAmount;
    }

    function balances(int128 i) external view override returns (uint256) {
        i;
    }

    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view override returns (uint256) {
        dx;
        uint256 x = rates[uint256(i)] * PRECISION_MUL[uint256(i)] * (10**decimals[uint256(j)]);
        uint256 y = rates[uint256(j)] * PRECISION_MUL[uint256(j)];
        return x / y;
    }

    function get_virtual_price() external view override returns (uint256) {
        return vp;
    }
}
