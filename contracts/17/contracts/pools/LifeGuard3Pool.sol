// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import {FixedStablecoins, FixedVaults} from "../common/FixedContracts.sol";
import "../common/Controllable.sol";
import "../common/Whitelist.sol";

import "../interfaces/IBuoy.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/ILifeGuard.sol";
import "../interfaces/IVault.sol";
import {ICurve3Deposit} from "../interfaces/ICurve.sol";

/// @notice Contract for interactions with curve3pool
///     Handles asset swapping and investment into underlying vaults for larger deposits.
///         The lifeguard also handles interaction with any Curve pool token vaults (currently 3Crv),
///         This vault is treated specially as it causes exposures against all three stablecoins:
///             1) Large deposits that go through the lifeguard on their way into the vault adapters
///                 may have a set percentage of their assets left in the lifeguard for later deposit into
///                 the Curve vault - This is a binary action determined by the current Curve exposure.
///             2) Withdrawals will only happen from the Curve vault in edge cases - when withdrawal is
///                 greater than total amount of assets in stablecoin vaults.
///             3) The lifeguard can pull out assets from the Curve vault and redistribute it to the
///                 underlying stablecoin vaults to avoid overexposure.
///
///     In addition the lifeguard allows the system to toggle additional price checks on
///     each deposit/withdrawal (see buoy for more details)
contract LifeGuard3Pool is ILifeGuard, Controllable, Whitelist, FixedStablecoins {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ICurve3Deposit public immutable crv3pool; // curve pool
    IERC20 public immutable lpToken; // Pool token
    IBuoy public immutable buoy; // Oracle

    address public insurance;
    address public depositHandler;
    address public withdrawHandler;

    uint256 public investToCurveThreshold;
    /// Mapping of asset amounts in lifeguard (DAI, USDC, USDT)
    mapping(uint256 => uint256) public override assets;

    event LogHealhCheckUpdate(bool status);
    event LogNewCurveThreshold(uint256 threshold);
    event LogNewEmergencyWithdrawal(uint256 indexed token1, uint256 indexed token2, uint256 ratio, uint256 decimals);
    event LogNewInvest(
        uint256 depositAmount,
        uint256[N_COINS] delta,
        uint256[N_COINS] amounts,
        uint256 dollarAmount,
        bool needSkim
    );
    event LogNewStableDeposit(uint256[N_COINS] inAmounts, uint256 lpToken, bool rebalance);

    constructor(
        address _crv3pool,
        address poolToken,
        address _buoy,
        address[N_COINS] memory _tokens,
        uint256[N_COINS] memory _decimals
    ) public FixedStablecoins(_tokens, _decimals) {
        crv3pool = ICurve3Deposit(_crv3pool);
        buoy = IBuoy(_buoy);
        lpToken = IERC20(poolToken);
        for (uint256 i = 0; i < N_COINS; i++) {
            IERC20(_tokens[i]).safeApprove(_crv3pool, type(uint256).max);
        }
    }

    /// @notice Approve the wihtdrawHandler to pull from lifeguard
    function setDependencies() external onlyOwner {
        IController ctrl = _controller();
        if (withdrawHandler != address(0)) {
            for (uint256 i = 0; i < N_COINS; i++) {
                address coin = getToken(i);
                IERC20(coin).safeApprove(withdrawHandler, uint256(0));
            }
        }
        withdrawHandler = ctrl.withdrawHandler();
        for (uint256 i = 0; i < N_COINS; i++) {
            address coin = getToken(i);
            IERC20(coin).safeApprove(withdrawHandler, uint256(0));
            IERC20(coin).safeApprove(withdrawHandler, type(uint256).max);
        }
        depositHandler = ctrl.depositHandler();
        insurance = ctrl.insurance();
    }

    function getAssets() external view override returns (uint256[N_COINS] memory _assets) {
        for (uint256 i; i < N_COINS; i++) {
            _assets[i] = assets[i];
        }
    }

    /// @notice Approve vault adaptor to pull from lifeguard
    /// @param index Index of vaultAdaptors underlying asset
    function approveVaults(uint256 index) external onlyOwner {
        IVault vault;
        if (index < N_COINS) {
            vault = IVault(_controller().underlyingVaults(index));
        } else {
            vault = IVault(_controller().curveVault());
        }
        address coin = vault.token();
        IERC20(coin).safeApprove(address(vault), uint256(0));
        IERC20(coin).safeApprove(address(vault), type(uint256).max);
    }

    /// @notice Set the upper limit to the amount of assets the lifeguard will
    ///     hold on to before signaling that an invest to Curve action is necessary.
    /// @param _investToCurveThreshold New invest threshold
    function setInvestToCurveThreshold(uint256 _investToCurveThreshold) external onlyOwner {
        investToCurveThreshold = _investToCurveThreshold;
        emit LogNewCurveThreshold(_investToCurveThreshold);
    }

    /// @notice Invest assets into Curve vault
    function investToCurveVault() external override onlyWhitelist {
        uint256[N_COINS] memory _inAmounts;
        for (uint256 i = 0; i < N_COINS; i++) {
            _inAmounts[i] = assets[i];
            assets[i] = 0;
        }
        crv3pool.add_liquidity(_inAmounts, 0);
        _investToVault(N_COINS, false);
    }

    /// @notice Check if lifeguard is ready to invest into the Curve vault
    function investToCurveVaultTrigger() external view override returns (bool invest) {
        uint256 totalAssetsLP = _totalAssets();
        return totalAssetsLP > investToCurveThreshold.mul(uint256(10)**IERC20Detailed(address(lpToken)).decimals());
    }

    /// @notice Pull out and redistribute Curve vault assets (3Crv) to underlying stable vaults
    /// @param amount Amount to pull out
    /// @param delta Distribution of assets to vaults (%BP)
    function distributeCurveVault(uint256 amount, uint256[N_COINS] memory delta)
        external
        override
        returns (uint256[N_COINS] memory)
    {
        require(msg.sender == controller, "distributeCurveVault: !controller");
        IVault vault = IVault(_controller().curveVault());

        vault.withdraw(amount);
        _withdrawUnbalanced(amount, delta);
        uint256[N_COINS] memory amounts;
        for (uint256 i = 0; i < N_COINS; i++) {
            amounts[i] = _investToVault(i, false);
        }
        return amounts;
    }

    /// @notice Deposit lifeguards stablecoins into Curve pool
    /// @param rebalance Is the deposit for a rebalance Y/N
    function depositStable(bool rebalance) external override returns (uint256) {
        require(msg.sender == withdrawHandler || msg.sender == insurance, "depositStable: !depositHandler");
        uint256[N_COINS] memory _inAmounts;
        uint256 countOfStableHasAssets = 0;
        for (uint256 i = 0; i < N_COINS; i++) {
            uint256 balance = IERC20(getToken(i)).balanceOf(address(this));
            if (balance != 0) {
                countOfStableHasAssets++;
            }
            if (!rebalance) {
                balance = balance.sub(assets[i]);
            } else {
                assets[i] = 0;
            }
            _inAmounts[i] = balance;
        }
        if (countOfStableHasAssets == 0) return 0;
        crv3pool.add_liquidity(_inAmounts, 0);
        uint256 lpAmount = lpToken.balanceOf(address(this));
        emit LogNewStableDeposit(_inAmounts, lpAmount, rebalance);
        return lpAmount;
    }

    /// @notice Leave part of user deposits assets in lifeguard for depositing into alternative vault
    /// @param amount Amount of token deposited
    /// @param index Index of token
    /// @dev Updates internal assets mapping so lifeguard can keep track of how much
    ///     extra assets it is holding
    function skim(uint256 amount, uint256 index) internal returns (uint256 balance) {
        uint256 skimPercent = _controller().getSkimPercent();
        uint256 skimmed = amount.mul(skimPercent).div(PERCENTAGE_DECIMAL_FACTOR);
        balance = amount.sub(skimmed);
        assets[index] = assets[index].add(skimmed);
    }

    /// @notice Deposit assets into Curve pool
    function deposit() external override returns (uint256 newAssets) {
        require(msg.sender == depositHandler, "depositStable: !depositHandler");
        uint256[N_COINS] memory _inAmounts;
        for (uint256 i = 0; i < N_COINS; i++) {
            IERC20 coin = IERC20(getToken(i));
            _inAmounts[i] = coin.balanceOf(address(this)).sub(assets[i]);
        }
        uint256 previousAssets = lpToken.balanceOf(address(this));
        crv3pool.add_liquidity(_inAmounts, 0);
        newAssets = lpToken.balanceOf(address(this)).sub(previousAssets);
    }

    /// @notice Withdraw single asset from Curve pool
    /// @param i Token index
    /// @param minAmount Acceptable minimum amount of token to recieve
    /// @param recipient Recipient of assets
    /// @dev withdrawSingle Swaps available assets in the lifeguard into target assets
    ///        using the Curve exhange function. This asset is then sent to target recipient
    function withdrawSingleByLiquidity(
        uint256 i,
        uint256 minAmount,
        address recipient
    ) external override returns (uint256, uint256) {
        require(msg.sender == withdrawHandler, "withdrawSingleByLiquidity: !withdrawHandler");
        IERC20 coin = IERC20(getToken(i));
        crv3pool.remove_liquidity_one_coin(lpToken.balanceOf(address(this)), int128(i), 0);
        uint256 balance = coin.balanceOf(address(this)).sub(assets[i]);
        require(balance > minAmount, "withdrawSingle: !minAmount");
        coin.safeTransfer(recipient, balance);
        return (buoy.singleStableToUsd(balance, i), balance);
    }

    /// @notice Exchange underlying assets into one token
    /// @param i Index of token to exchange to
    /// @param minAmount Acceptable minimum amount of token to recieve
    /// @param recipient Recipient of assets
    /// @dev withdrawSingle Swaps available assets in the lifeguard into target assets
    ///        using the Curve exhange function. This asset is then sent to target recipient
    function withdrawSingleByExchange(
        uint256 i,
        uint256 minAmount,
        address recipient
    ) external override returns (uint256 usdAmount, uint256 balance) {
        require(msg.sender == withdrawHandler, "withdrawSingleByExchange: !withdrawHandler");
        IERC20 coin = IERC20(getToken(i));
        balance = coin.balanceOf(address(this)).sub(assets[i]);
        // Are available assets - locked assets for LP vault more than required
        // minAmount. Then estimate USD value and transfer...
        if (minAmount <= balance) {
            uint256[N_COINS] memory inAmounts;
            inAmounts[i] = balance;
            usdAmount = buoy.stableToUsd(inAmounts, false);
            // ...if not, swap other loose assets into target assets before
            // estimating USD value and transfering.
        } else {
            for (uint256 j; j < N_COINS; j++) {
                if (j == i) continue;
                IERC20 inCoin = IERC20(getToken(j));
                uint256 inBalance = inCoin.balanceOf(address(this)).sub(assets[j]);
                if (inBalance > 0) {
                    _exchange(inBalance, int128(j), int128(i));
                    if (coin.balanceOf(address(this)).sub(assets[i]) >= minAmount) {
                        break;
                    }
                }
            }
            balance = coin.balanceOf(address(this)).sub(assets[i]);
            uint256[N_COINS] memory inAmounts;
            inAmounts[i] = balance;
            usdAmount = buoy.stableToUsd(inAmounts, false);
        }
        require(balance >= minAmount);
        coin.safeTransfer(recipient, balance);
    }

    /// @notice Return underlying buoy
    function getBuoy() external view override returns (address) {
        return address(buoy);
    }

    /// @notice Deposit into underlying vaults
    /// @param depositAmount LP amount to invest
    /// @param delta Target distribution of investment (%BP)
    function invest(uint256 depositAmount, uint256[N_COINS] calldata delta)
        external
        override
        returns (uint256 dollarAmount)
    {
        require(msg.sender == insurance || msg.sender == depositHandler, "depositStable: !depositHandler");
        bool needSkim = true;
        if (depositAmount == 0) {
            depositAmount = lpToken.balanceOf(address(this));
            needSkim = false;
        }
        uint256[N_COINS] memory amounts;
        _withdrawUnbalanced(depositAmount, delta);
        for (uint256 i = 0; i < N_COINS; i++) {
            amounts[i] = _investToVault(i, needSkim);
        }
        dollarAmount = buoy.stableToUsd(amounts, true);
        emit LogNewInvest(depositAmount, delta, amounts, dollarAmount, needSkim);
    }

    /// @notice Invest target stablecoins into specified vaults. The two
    ///     specified vaults, i and j should represent the least and second least
    ///     exposed vaults. This function will exchanges any unwanted stablecoins
    ///     (most exposed) to the least exposed vaults underlying asset (i).
    /// @param inAmounts Stable coin amounts
    /// @param i Index of target stablecoin/vault
    /// @param j Index of target stablecoin/vault
    /// @dev i and j represent the two least exposed vaults, any invested assets
    ///     targeting the most exposed vault will be exchanged for i, the least
    ///     exposed asset.
    function investSingle(
        uint256[N_COINS] calldata inAmounts,
        uint256 i,
        uint256 j
    ) external override returns (uint256 dollarAmount) {
        require(msg.sender == depositHandler, "!investSingle: !depositHandler");
        // Swap any additional stablecoins to target
        for (uint256 k; k < N_COINS; k++) {
            if (k == i || k == j) continue;
            uint256 inBalance = inAmounts[k];
            if (inBalance > 0) {
                _exchange(inBalance, int128(k), int128(i));
            }
        }
        uint256[N_COINS] memory amounts;

        uint256 k = N_COINS - (i + j);
        if (inAmounts[i] > 0 || inAmounts[k] > 0) {
            amounts[i] = _investToVault(i, true);
        }
        if (inAmounts[j] > 0) {
            amounts[j] = _investToVault(j, true);
        }
        // Assess USD value of new stablecoin amount
        dollarAmount = buoy.stableToUsd(amounts, true);
    }

    function totalAssets() external view override returns (uint256) {
        return _totalAssets();
    }

    /// @notice Total available (not reserved for Curve vault) assets held by contract (denoted in LP tokens)
    function availableLP() external view override returns (uint256) {
        uint256[N_COINS] memory _assets;
        for (uint256 i; i < N_COINS; i++) {
            IERC20 coin = IERC20(getToken(i));
            _assets[i] = coin.balanceOf(address(this)).sub(assets[i]);
        }
        return buoy.stableToLp(_assets, true);
    }

    function totalAssetsUsd() external view override returns (uint256) {
        return buoy.lpToUsd(_totalAssets());
    }

    // @notice Total available (not reserved for Curve vault) assets held by contract (denoted in USD)
    function availableUsd() external view override returns (uint256) {
        uint256 lpAmount = lpToken.balanceOf(address(this));
        uint256 skimPercent = _controller().getSkimPercent();
        lpAmount = lpAmount.sub(lpAmount.mul(skimPercent).div(PERCENTAGE_DECIMAL_FACTOR));
        return buoy.lpToUsd(lpAmount);
    }

    // Private functions

    /// @notice Exchange one stable coin to another
    /// @param amount Amount of in token
    /// @param _in Index of in token
    /// @param out Index of out token
    function _exchange(
        uint256 amount,
        int128 _in,
        int128 out
    ) private returns (uint256) {
        crv3pool.exchange(_in, out, amount, 0);
    }

    /// @notice Withdraw from pool in specific coin targets
    /// @param inAmount Total amount of withdraw (in LP tokens)
    /// @param delta Distribution of underlying assets to withdraw (%BP)
    function _withdrawUnbalanced(uint256 inAmount, uint256[N_COINS] memory delta) private {
        uint256 leftAmount = inAmount;
        for (uint256 i; i < N_COINS - 1; i++) {
            if (delta[i] > 0) {
                uint256 amount = inAmount.mul(delta[i]).div(PERCENTAGE_DECIMAL_FACTOR);
                leftAmount = leftAmount.sub(amount);
                crv3pool.remove_liquidity_one_coin(amount, int128(i), 0);
            }
        }
        if (leftAmount > 0) {
            crv3pool.remove_liquidity_one_coin(leftAmount, int128(N_COINS - 1), 0);
        }
    }

    function _totalAssets() private view returns (uint256) {
        uint256[N_COINS] memory _assets;
        for (uint256 i; i < N_COINS; i++) {
            _assets[i] = assets[i];
        }
        return buoy.stableToLp(_assets, true);
    }

    /// @notice Deposit all target stablecoins to vault
    /// @param i Target vault
    /// @param needSkim Leave assets in lifeguard for deposit into Curve vault (Y/N)
    function _investToVault(uint256 i, bool needSkim) private returns (uint256 balance) {
        IVault vault;
        IERC20 coin;
        if (i < N_COINS) {
            vault = IVault(_controller().underlyingVaults(i));
            coin = IERC20(getToken(i));
        } else {
            vault = IVault(_controller().curveVault());
            coin = lpToken;
        }
        balance = coin.balanceOf(address(this)).sub(assets[i]);
        if (balance > 0) {
            if (i == N_COINS) {
                IVault(vault).deposit(balance);
                IVault(vault).invest();
            } else {
                uint256 investBalance = needSkim ? skim(balance, i) : balance;
                IVault(vault).deposit(investBalance);
            }
        }
    }
}
