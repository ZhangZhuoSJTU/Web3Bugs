// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "../interfaces/ILongShortToken.sol";
import "../interfaces/IStrategyController.sol";
import "../interfaces/IStrategy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IStrategyController private _controller;
    /**
     * This would be an IERC20 in a real strategy, but we are using
     * ILongShortToken due to this being a mock strategy that needs
     * to mint/burn its `_baseToken`
     */
    ILongShortToken private _baseToken;

    /**
     * This would not exist in an actual strategy since strategies are vault
     * agnostic, only exists because we need to know vault shares supply to
     * simulate a `totalValue()`
     */
    IERC20 public vault;
    // Timestamp to denote when virtual yield can begin to accumulate
    uint256 public beginning;
    /**
     * Integer percent APY for mock strategy, editable in case we need to
     * modify later for testnet
     */
    uint256 public apy;
    // Virtual value of a vault share is initialized to 1 `_baseToken`
    uint256 public constant INITIAL_SHARE_VALUE = 1e18;

    event VaultChanged(address vault);

    modifier onlyController() {
        require(
            msg.sender == address(_controller),
            "Caller is not the controller"
        );
        _;
    }

    constructor(address _newController, address _newBaseToken) {
        _controller = IStrategyController(_newController);
        _baseToken = ILongShortToken(_newBaseToken);
        beginning = block.timestamp;
    }

    /**
     * `_baseToken` must blacklist users besides governance and controller
     * from sending to this contract to prevent unwanted share inflation from
     * users directly sending funds to the strategy
     */
    function deposit(uint256 _amount) external override onlyController {
        uint256 _actualBalance = _baseToken.balanceOf(address(this));
        uint256 _virtualBalance = _getVirtualBalance();
        if (_actualBalance > 0) {
            /**
             * Bring `_baseToken` balance in line with our expected virtual
             * balance, this is so that the difference in `totalValue()`
             * before/after reflects the deposit amount
             */
            if (_virtualBalance > _actualBalance) {
                require(
                    _baseToken.owner() == address(this),
                    "Strategy must be baseToken owner"
                );
                /**
                 * Mint tokens to bring `_baseToken` balance up to
                 * `_virtualBalance` before deposit
                 */
                _baseToken.mint(
                    address(this),
                    _virtualBalance - _actualBalance
                );
            }
        }
        IERC20(_baseToken).safeTransferFrom(
            address(_controller),
            address(this),
            _amount
        );
    }

    /**
     * We enforce `_baseToken` ownership here and not in the initializer since
     * we would have to deterministically figure out strategy deployment
     * address ahead of time
     */
    function withdraw(address _recipient, uint256 _amount)
        external
        override
        onlyController
    {
        require(
            _baseToken.owner() == address(this),
            "Strategy must be baseToken owner"
        );
        if (_amount > _baseToken.balanceOf(address(this))) {
            uint256 _shortfall = _amount - _baseToken.balanceOf(address(this));
            _baseToken.mint(address(this), _shortfall);
        }
        IERC20(_baseToken).safeTransfer(_recipient, _amount);
    }

    function setVault(IERC20 _newVault) external onlyOwner {
        vault = _newVault;
        emit VaultChanged(address(vault));
    }

    /**
     * Initializes to current timestamp, changeable by governance if needed
     * later
     */
    function setBeginning(uint256 _beginning) external onlyOwner {
        beginning = _beginning;
    }

    /**
     * Virtual APY yields will be calculated from the starting value of
     * INITIAL_SHARE_VALUE
     */
    function setApy(uint256 _apy) external onlyOwner {
        apy = _apy;
    }

    /**
     * Virtual balance is the amount owed to all shareholders based on the
     * current timestamp and virtual APY. This returns the actual `_baseToken`
     * balance if it is greater than the `_virtualBalance`, which for this
     * mock strategy, will always be when a user deposits funds prior to
     * minting shares.
     *
     * After a user deposits funds via `deposit()`, `totalValue()`
     * should return the `_actualBalance` to allow Collateral to determine how
     * many shares to mint for a user. Once the shares are minted, the
     * `_virtualBalance` will once again surpass the `_actualBalance`.
     */
    function totalValue() external view override returns (uint256) {
        uint256 _actualBalance = _baseToken.balanceOf(address(this));
        uint256 _virtualBalance = _getVirtualBalance();
        if (_actualBalance > _virtualBalance) {
            return _actualBalance;
        } else {
            return _virtualBalance;
        }
    }

    function getController()
        external
        view
        override
        returns (IStrategyController)
    {
        return _controller;
    }

    function getBaseToken() external view override returns (IERC20) {
        return IERC20(_baseToken);
    }

    function _getVirtualBalance() internal view returns (uint256) {
        return
            (vault.totalSupply() * _currentShareValue()) / INITIAL_SHARE_VALUE;
    }

    /**
     * INITIAL_SHARE_VALUE is only being re-used here as a denominator for wei
     * token math.
     */
    function _currentShareValue() internal view returns (uint256) {
        uint256 _returnPerSecond = (INITIAL_SHARE_VALUE * apy) /
            100 /
            31536000;
        uint256 _timeDeployed = block.timestamp - beginning;
        return INITIAL_SHARE_VALUE + (_returnPerSecond * _timeDeployed);
    }
}
