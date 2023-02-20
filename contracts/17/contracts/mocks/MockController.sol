// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "../common/Constants.sol";
import "../interfaces/IBuoy.sol";
import "../interfaces/IController.sol";
import "../interfaces/IDepositHandler.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/ILifeGuard.sol";
import "../interfaces/IPnL.sol";
import "../interfaces/IToken.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IWithdrawHandler.sol";
import "./MockERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MockController is Constants, Pausable, Ownable, IController, IWithdrawHandler, IDepositHandler {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 pricePerShare = CHAINLINK_PRICE_DECIMAL_FACTOR;
    uint256 _gTokenTotalAssets;
    uint256 utilisationRatioLimit;
    address[3] underlyingTokens;
    uint256[3] delta;
    mapping(uint256 => address) public override underlyingVaults;
    address public override curveVault;
    uint256 public override deadCoin;
    bool public override emergencyState;

    mapping(address => bool) whiteListedPools;
    mapping(address => address) public override referrals;
    address public override insurance;
    address public override reward;

    address public override pnl;
    address public override lifeGuard;
    address public override buoy;
    address public gvt;
    address public pwrd;
    //tmp fix for pwrd override in withdraw
    address public _pwrd;
    uint256 public override totalAssets;
    uint256 skimPercent;

    bool public whale;
    uint256[] public vaultOrder;

    // Added for testing purposes - cant get events from function called
    // within a function in truffle test (not available in rawLogs)
    event LogNewDeposit(address indexed user, uint256 usdAmount, uint256[3] tokens);
    event LogNewWithdrawal(address indexed user, uint256 usdAmount, uint256[3] tokenAmounts);
    event LogNewSingleCoinWithdrawal(address indexed user, uint256 usdAmount, uint256 token, uint256 lpTokens);

    function setUnderlyingTokens(address[3] calldata tokens) external onlyOwner {
        underlyingTokens = tokens;
    }

    // Mocks insurance module delta calculation
    function setDelta(uint256[3] calldata newDelta) external {
        delta = newDelta;
    }

    function setGvt(address _gvt) external {
        gvt = _gvt;
    }

    function setPwrd(address newPwrd) external {
        pwrd = newPwrd;
        _pwrd = newPwrd;
    }

    function setVaultOrder(uint256[] calldata newOrder) external {
        vaultOrder = newOrder;
    }

    // Mocks insurance vaults
    function setVault(uint256 index, address vault) external {
        underlyingVaults[index] = vault;
    }

    function setCurveVault(address _curveVault) external onlyOwner {
        curveVault = _curveVault;
    }

    function stablecoins() external view override returns (address[3] memory) {
        return underlyingTokens;
    }

    function deposit(
        address gTokenAddress,
        uint256[3] calldata inAmounts,
        uint256 minAmount,
        address pool,
        address _referral
    ) external {
        require(minAmount > 0, "minAmount should be greater than 0.");
        ILifeGuard lg = ILifeGuard(pool);

        for (uint256 i = 0; i < N_COINS; i++) {
            address token = underlyingTokens[i];
            IERC20(token).safeTransferFrom(msg.sender, pool, inAmounts[i]);
        }
        uint256 dollarAmount;
        bool invest = false;

        dollarAmount = lg.deposit();

        if (invest) {
            dollarAmount = lg.invest(dollarAmount, delta);
        }

        _mintGToken(gTokenAddress, dollarAmount);
        emit LogNewDeposit(msg.sender, dollarAmount, inAmounts);
    }

    function depositGvt(
        uint256[3] calldata inAmounts,
        uint256 minAmount,
        address _referral
    ) external override {
        require(minAmount > 0, "minAmount should be greater than 0.");
        ILifeGuard lg = ILifeGuard(lifeGuard);

        for (uint256 i = 0; i < N_COINS; i++) {
            address token = underlyingTokens[i];
            IERC20(token).safeTransferFrom(msg.sender, lifeGuard, inAmounts[i]);
        }
        uint256 dollarAmount;
        bool invest = false;
        if (whale) {
            uint256 outAmount = lg.deposit();
            dollarAmount = lg.invest(outAmount, delta);
        } else {
            dollarAmount = lg.investSingle(inAmounts, vaultOrder[0], vaultOrder[1]);
        }
        _mintGToken(gvt, dollarAmount);
        emit LogNewDeposit(msg.sender, dollarAmount, inAmounts);
    }

    function depositPwrd(
        uint256[3] calldata inAmounts,
        uint256 minAmount,
        address _referral
    ) external override {
        require(minAmount > 0, "minAmount should be greater than 0.");
        ILifeGuard lg = ILifeGuard(lifeGuard);

        for (uint256 i = 0; i < N_COINS; i++) {
            address token = underlyingTokens[i];
            IERC20(token).safeTransferFrom(msg.sender, lifeGuard, inAmounts[i]);
        }
        uint256 dollarAmount;
        bool invest = false;
        if (whale) {
            uint256 outAmount = lg.deposit();
            dollarAmount = lg.invest(outAmount, delta);
        } else {
            dollarAmount = lg.investSingle(inAmounts, vaultOrder[0], vaultOrder[1]);
        }
        _mintGToken(pwrd, dollarAmount);
        emit LogNewDeposit(msg.sender, dollarAmount, inAmounts);
    }

    function withdrawAllSingle(
        address gTokenAddress,
        uint256 index,
        uint256 minAmount,
        address pool
    ) public {}

    function withdrawAllBalanced(
        address gTokenAddress,
        uint256[] calldata minAmounts,
        address pool
    ) public {}

    function withdrawalFee(bool pwrd_) external view override returns (uint256) {}

    function withdrawByLPToken(
        bool pwrd_,
        uint256 lpAmount,
        uint256[3] calldata minAmounts
    ) external override {
        _withdrawLp(pwrd_, lpAmount, minAmounts);
    }

    function _withdrawLp(
        bool pwrd_,
        uint256 lpAmount,
        uint256[3] memory minAmount
    ) internal {
        ILifeGuard lg = ILifeGuard(lifeGuard);
        IBuoy buoy = IBuoy(lg.getBuoy());
        uint256 dollarAmount;
        uint256[3] memory _amounts;
        if (whale) {
            for (uint256 i = 0; i < 3; i++) {
                uint256 lpPart = lpAmount.mul(delta[i]).div(10000);
                uint256 amount = buoy.singleStableFromLp(lpPart, int128(i));
                IVault vault = IVault(underlyingVaults[i]);
                vault.withdrawByStrategyOrder(amount, msg.sender, pwrd_);
                _amounts[i] = amount;
            }
        } else {
            uint256 i = vaultOrder[0];
            IVault vault = IVault(underlyingVaults[i]);
            uint256 amount = buoy.singleStableFromLp(lpAmount, int128(i));
            vault.withdrawByStrategyOrder(amount, msg.sender, pwrd_);
            _amounts[i] = amount;
        }
        dollarAmount = buoy.stableToUsd(_amounts, false);
        IToken dt;
        if (pwrd_) {
            dt = IToken(_pwrd);
        } else {
            dt = IToken(gvt);
        }
        dt.burn(msg.sender, dt.factor(), dollarAmount);
    }

    function withdrawByStablecoin(
        bool pwrd_,
        uint256 index,
        uint256 lpAmount,
        uint256 minAmount
    ) external override {
        _withdrawSingle(pwrd_, index, lpAmount, minAmount);
    }

    function withdrawAllSingle(
        bool pwrd_,
        uint256 index,
        uint256 minAmount
    ) external override {}

    function _withdrawSingle(
        bool pwrd_,
        uint256 index,
        uint256 lpAmount,
        uint256 minAmount
    ) internal {
        ILifeGuard lg = ILifeGuard(lifeGuard);
        IBuoy buoy = IBuoy(lg.getBuoy());
        uint256 dollarAmount;
        if (whale) {
            for (uint256 i = 0; i < 3; i++) {
                uint256 lpPart = lpAmount.mul(delta[i]).div(10000);
                uint256 amount = buoy.singleStableFromLp(lpPart, int128(i));
                IVault vault = IVault(underlyingVaults[i]);
                vault.withdrawByStrategyOrder(amount, lifeGuard, pwrd_);
                (dollarAmount, ) = lg.withdrawSingleByExchange(index, 1, msg.sender);
            }
        } else {
            IVault vault = IVault(underlyingVaults[vaultOrder[0]]);
            uint256 amount = buoy.singleStableFromLp(lpAmount, int128(vaultOrder[0]));
            vault.withdrawByStrategyOrder(amount, lifeGuard, pwrd_);
            (dollarAmount, ) = lg.withdrawSingleByExchange(index, 1, msg.sender);
        }
        IToken dt;
        if (pwrd_) {
            dt = IToken(_pwrd);
        } else {
            dt = IToken(gvt);
        }
        dt.burn(msg.sender, dt.factor(), dollarAmount);
    }

    function withdrawAllBalanced(bool pwrd_, uint256[3] calldata minAmounts) external override {}

    function addPool(address pool, address[] calldata tokens) external onlyOwner {
        tokens;
        whiteListedPools[pool] = true;
    }

    function _deposit(uint256 dollarAmount) private {
        _gTokenTotalAssets = _gTokenTotalAssets.add(dollarAmount);
    }

    function _withdraw(uint256 dollarAmount) private {
        _gTokenTotalAssets = _gTokenTotalAssets.sub(dollarAmount);
    }

    function _mintGToken(address gToken, uint256 amount) private {
        IToken dt = IToken(gToken);
        dt.mint(msg.sender, dt.factor(), amount);
        _deposit(amount);
    }

    function _burnGToken(
        address gToken,
        uint256 amount,
        uint256 bonus
    ) private {
        IToken dt = IToken(gToken);
        dt.burn(msg.sender, dt.factor(), amount);
        _withdraw(amount);
    }

    function gTokenTotalAssets() public view override returns (uint256) {
        return _gTokenTotalAssets;
    }

    function setGTokenTotalAssets(uint256 totalAssets) external {
        _gTokenTotalAssets = totalAssets;
    }

    function increaseGTokenTotalAssets(uint256 totalAssets) external {
        _gTokenTotalAssets = _gTokenTotalAssets.add(totalAssets);
    }

    function decreaseGTokenTotalAssets(uint256 totalAssets) external {
        _gTokenTotalAssets = _gTokenTotalAssets.sub(totalAssets);
    }

    function mintGTokens(address gToken, uint256 amount) external {
        _mintGToken(gToken, amount);
    }

    function burnGTokens(address gToken, uint256 amount) external {
        _burnGToken(gToken, amount, 0);
    }

    function vaults() external view override returns (address[N_COINS] memory) {
        uint256 length = underlyingTokens.length;
        address[N_COINS] memory result;
        for (uint256 i = 0; i < length; i++) {
            result[i] = underlyingVaults[i];
        }
        return result;
    }

    function setPnL(address _pnl) external {
        pnl = _pnl;
    }

    function setLifeGuard(address _lifeGuard) external {
        lifeGuard = _lifeGuard;
    }

    function setInsurance(address _insurance) external {
        insurance = _insurance;
    }

    function setUtilisationRatioLimitForDeposit(uint256 _utilisationRatioLimit) external {
        utilisationRatioLimit = _utilisationRatioLimit;
    }

    function increaseGTokenLastAmount(address gTokenAddress, uint256 dollarAmount) external {
        if (gTokenAddress == pwrd) {
            IPnL(pnl).increaseGTokenLastAmount(true, dollarAmount);
        } else {
            IPnL(pnl).increaseGTokenLastAmount(false, dollarAmount);
        }
    }

    function decreaseGTokenLastAmount(
        address gTokenAddress,
        uint256 dollarAmount,
        uint256 bonus
    ) external {
        if (gTokenAddress == pwrd) {
            IPnL(pnl).decreaseGTokenLastAmount(true, dollarAmount, bonus);
        } else {
            IPnL(pnl).decreaseGTokenLastAmount(false, dollarAmount, bonus);
        }
    }

    function setGVT(address token) external {
        gvt = token;
    }

    function setPWRD(address token) external {
        pwrd = token;
    }

    function setTotalAssets(uint256 _totalAssets) external {
        totalAssets = _totalAssets;
    }

    function eoaOnly(address sender) external override {
        sender;
    }

    function withdrawHandler() external view override returns (address) {
        return address(this);
    }

    function depositHandler() external view override returns (address) {
        return address(this);
    }

    function emergencyHandler() external view override returns (address) {
        return address(this);
    }

    function setWhale(bool _whale) external {
        whale = _whale;
    }

    function isValidBigFish(
        bool pwrd,
        bool deposit,
        uint256 amount
    ) external view override returns (bool) {
        return whale;
    }

    function gToken(bool isPWRD) external view override returns (address) {}

    function setSkimPercent(uint256 _percent) external {
        skimPercent = _percent;
    }

    function getSkimPercent() external view override returns (uint256) {
        return skimPercent;
    }

    function emergency(uint256 coin) external {}

    function restart(uint256[] calldata allocations) external {}

    function distributeStrategyGainLoss(uint256 gain, uint256 loss) external override {
        IPnL(pnl).distributeStrategyGainLoss(gain, loss, reward);
    }

    function distributePriceChange() external {
        IPnL(pnl).distributePriceChange(totalAssets);
    }

    function burnGToken(
        bool pwrd,
        bool all,
        address account,
        uint256 amount,
        uint256 bonus
    ) external override {
        IPnL(pnl).decreaseGTokenLastAmount(pwrd, amount, bonus);
        if (pwrd) {
            _burnGToken(_pwrd, amount, bonus);
        } else {
            _burnGToken(gvt, amount, bonus);
        }
    }

    function depositPool() external {
        ILifeGuard(lifeGuard).deposit();
    }

    function depositStablePool(bool rebalance) external {
        ILifeGuard(lifeGuard).depositStable(rebalance);
    }

    function investPool(uint256 amount, uint256[3] memory delta) external {
        ILifeGuard(lifeGuard).invest(amount, delta);
    }

    function mintGToken(
        bool pwrd,
        address account,
        uint256 amount
    ) external override {}

    function getUserAssets(bool pwrd, address account) external view override returns (uint256 deductUsd) {}

    function distributeCurveAssets(uint256 amount, uint256[N_COINS] memory delta) external {
        uint256[N_COINS] memory amounts = ILifeGuard(lifeGuard).distributeCurveVault(amount, delta);
    }

    function addReferral(address account, address referral) external override {}

    function getStrategiesTargetRatio() external view override returns (uint256[] memory result) {
        result = new uint256[](2);
        result[0] = 5000;
        result[1] = 5000;
    }

    function validGTokenDecrease(uint256 amount) external view override returns (bool) {}
}
