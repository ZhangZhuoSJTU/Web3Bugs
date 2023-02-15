//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.12;

import "../deps/@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "../deps/@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./ICore.sol";

/*
    Wrapped Interest-Bearing Bitcoin (Ethereum mainnet variant)
*/
contract WrappedIbbtcEth is Initializable, ERC20Upgradeable {
    address public governance;
    address public pendingGovernance;
    ERC20Upgradeable public ibbtc; 
    
    ICore public core;

    uint256 public pricePerShare;
    uint256 public lastPricePerShareUpdate;

    event SetCore(address core);
    event SetPricePerShare(uint256 pricePerShare, uint256 updateTimestamp);
    event SetPendingGovernance(address pendingGovernance);
    event AcceptPendingGovernance(address pendingGovernance);

    /// ===== Modifiers =====
    modifier onlyPendingGovernance() {
        require(msg.sender == pendingGovernance, "onlyPendingGovernance");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "onlyGovernance");
        _;
    }

    function initialize(address _governance, address _ibbtc, address _core) public initializer {
        __ERC20_init("Wrapped Interest-Bearing Bitcoin", "wibBTC");
        governance = _governance;
        core = ICore(_core);
        ibbtc = ERC20Upgradeable(_ibbtc);

        updatePricePerShare();

        emit SetCore(_core);
    }

    /// ===== Permissioned: Governance =====
    function setPendingGovernance(address _pendingGovernance) external onlyGovernance {
        pendingGovernance = _pendingGovernance;
        emit SetPendingGovernance(pendingGovernance);
    }

    /// @dev The ibBTC token is technically capable of having it's Core contract changed via governance process. This allows the wrapper to adapt.
    /// @dev This function should be run atomically with setCore() on ibBTC if that eventuality ever arises.
    function setCore(address _core) external onlyGovernance {
        core = ICore(_core);
        emit SetCore(_core);
    }

    /// ===== Permissioned: Pending Governance =====
    function acceptPendingGovernance() external onlyPendingGovernance {
        governance = pendingGovernance;
        emit AcceptPendingGovernance(pendingGovernance);
    }

    /// ===== Permissionless Calls =====

    /// @dev Update live ibBTC price per share from core
    /// @dev We cache this to reduce gas costs of mint / burn / transfer operations.
    /// @dev Update function is permissionless, and must be updated at least once every X time as a sanity check to ensure value is up-to-date
    function updatePricePerShare() public virtual returns (uint256) {
        pricePerShare = core.pricePerShare();
        lastPricePerShareUpdate = now;

        emit SetPricePerShare(pricePerShare, lastPricePerShareUpdate);
    }

    /// @dev Deposit ibBTC to mint wibBTC shares
    function mint(uint256 _shares) external {
        require(ibbtc.transferFrom(_msgSender(), address(this), _shares));
        _mint(_msgSender(), _shares);
    }

    /// @dev Redeem wibBTC for ibBTC. Denominated in shares.
    function burn(uint256 _shares) external {
        _burn(_msgSender(), _shares);
        require(ibbtc.transfer(_msgSender(), _shares));
    }

    /// ===== Transfer Overrides =====
    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20};
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        /// The _balances mapping represents the underlying ibBTC shares ("non-rebased balances")
        /// Some naming confusion emerges due to maintaining original ERC20 var names

        uint256 amountInShares = balanceToShares(amount);

        _transfer(sender, recipient, amountInShares);
        _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amountInShares, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        /// The _balances mapping represents the underlying ibBTC shares ("non-rebased balances")
        /// Some naming confusion emerges due to maintaining original ERC20 var names

        uint256 amountInShares = balanceToShares(amount);

        _transfer(_msgSender(), recipient, amountInShares);
        return true;
    }

    /// ===== View Methods =====

    /// @dev Wrapped ibBTC shares of account
    function sharesOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    /// @dev Current account shares * pricePerShare
    function balanceOf(address account) public view override returns (uint256) {
        return sharesOf(account).mul(pricePerShare).div(1e18);
    }

    /// @dev Total wrapped ibBTC shares
    function totalShares() public view returns (uint256) {
        return _totalSupply;
    }

    /// @dev Current total shares * pricePerShare
    function totalSupply() public view override returns (uint256) {
        return totalShares().mul(pricePerShare).div(1e18);
    }

    function balanceToShares(uint256 balance) public view returns (uint256) {
        return balance.mul(1e18).div(pricePerShare);
    }

    function sharesToBalance(uint256 shares) public view returns (uint256) {
        return shares.mul(pricePerShare).div(1e18);
    }
}
