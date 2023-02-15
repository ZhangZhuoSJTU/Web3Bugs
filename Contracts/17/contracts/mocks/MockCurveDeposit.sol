// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "../interfaces/ICurve.sol";
import "./MockERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./MockLPToken.sol";

// Mock curve 3pool for deposit/withdrawal
contract MockCurveDeposit is ICurve3Deposit {
    using SafeERC20 for IERC20;

    address[] public coins;
    uint256 N_COINS = 3;
    uint256[] public PRECISION_MUL = [1, 1000000000000, 1000000000000];
    uint256[] public decimals = [18, 6, 6];
    uint256[] public rates = [1001835600000000000, 999482, 999069];
    uint256 constant vp = 1005530723799997871;
    uint256[] vpSingle = [996343755718242128, 994191500557422927, 993764724471177721];
    uint256[] desired_ratio = [250501710687927000, 386958750403203000, 362539538908870000];
    uint256[] poolratio = [20, 40, 40];
    uint256 Fee = 4000;
    MockLPToken PoolToken;

    constructor(address[] memory _tokens, address _PoolToken) public {
        coins = _tokens;
        PoolToken = MockLPToken(_PoolToken);
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

    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external override {
        i;
        j;
        dx;
        min_dy;
    }

    function add_liquidity(uint256[3] calldata uamounts, uint256 min_mint_amount) external override {
        uint256 amount;
        for (uint256 i; i < N_COINS; i++) {
            IERC20 token = IERC20(coins[i]);
            token.safeTransferFrom(msg.sender, address(this), uamounts[i]);
            amount = ((uamounts[i] * (10**(18 - decimals[i]))) * vpSingle[i]) / (10**18);
        }
        PoolToken.mint(msg.sender, min_mint_amount);
    }

    function remove_liquidity(uint256 amount, uint256[3] calldata min_uamounts) external override {
        require(PoolToken.balanceOf(msg.sender) > amount, "remove_liquidity: !balance");
        PoolToken.burn(msg.sender, amount);
        for (uint256 i; i < N_COINS; i++) {
            IERC20 token = IERC20(coins[i]);
            token.transfer(msg.sender, min_uamounts[i]);
        }
    }

    function remove_liquidity_imbalance(uint256[3] calldata amounts, uint256 max_burn_amount) external override {
        require(PoolToken.balanceOf(msg.sender) > max_burn_amount, "remove_liquidity: !balance");
        PoolToken.burn(msg.sender, max_burn_amount);
        for (uint256 i; i < N_COINS; i++) {
            IERC20 token = IERC20(coins[i]);
            if (amounts[i] > 0) {
                token.safeTransfer(msg.sender, amounts[i]);
            }
        }
    }

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        int128 i,
        uint256 min_amount
    ) external override {
        min_amount;
        require(PoolToken.balanceOf(msg.sender) > _token_amount, "remove_liquidity: !balance");
        uint256 outAmount = ((_token_amount * (10**18)) / vpSingle[uint256(i)]) / PRECISION_MUL[uint256(i)];
        PoolToken.burn(msg.sender, _token_amount);
        IERC20 token = IERC20(coins[uint256(i)]);
        token.safeTransfer(msg.sender, outAmount);
    }

    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view override returns (uint256) {
        uint256 x = rates[uint256(i)] * dx * PRECISION_MUL[uint256(i)];
        uint256 y = rates[uint256(j)] * PRECISION_MUL[uint256(j)];
        return x / y;
    }

    function calc_token_amount(uint256[3] calldata inAmounts, bool deposit) external view returns (uint256) {
        deposit;
        uint256 totalAmount;
        for (uint256 i = 0; i < vpSingle.length; i++) {
            totalAmount += (inAmounts[i] * vpSingle[i]) / (10**decimals[i]);
        }
        return totalAmount;
    }
}
