// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {BoringOwnable} from "./utils/BoringOwnable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin-upgradeable/contracts/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";
import {IVault, IAsset} from "interfaces/balancer/IVault.sol";
import "interfaces/balancer/IWeightedPool.sol";
import "interfaces/balancer/IPriceOracle.sol";

contract sNOTE is ERC20Upgradeable, ERC20VotesUpgradeable, BoringOwnable, UUPSUpgradeable, ReentrancyGuard {
    using SafeERC20 for ERC20;

    IVault public immutable BALANCER_VAULT;
    ERC20 public immutable NOTE;
    ERC20 public immutable BALANCER_POOL_TOKEN;
    ERC20 public immutable WETH;
    bytes32 public immutable NOTE_ETH_POOL_ID;

    /// @notice Maximum shortfall withdraw of 50%
    uint256 public constant MAX_SHORTFALL_WITHDRAW = 50;
    uint256 public constant BPT_TOKEN_PRECISION = 1e18;

    /// @notice Redemption window in seconds
    uint256 public constant REDEEM_WINDOW_SECONDS = 3 days;

    /// @notice Tracks an account's redemption window
    struct AccountCoolDown {
        uint32 redeemWindowBegin;
        uint32 redeemWindowEnd;
    }

    /// @notice Number of seconds that need to pass before sNOTE can be redeemed
    uint32 public coolDownTimeInSeconds;

    /// @notice Mapping between sNOTE holders and their current cooldown status
    mapping(address => AccountCoolDown) public accountCoolDown;

    /// @notice Emitted when a cool down begins
    event CoolDownStarted(address account, uint256 redeemWindowBegin, uint256 redeemWindowEnd);

    /// @notice Emitted when a cool down ends
    event CoolDownEnded(address account);

    /// @notice Emitted when cool down time is updated
    event GlobalCoolDownUpdated(uint256 newCoolDownTimeSeconds);

    /// @notice Constructor sets immutable contract addresses
    constructor(
        IVault _balancerVault,
        bytes32 _noteETHPoolId,
        ERC20 _note,
        ERC20 _weth
    ) initializer { 
        // Validate that the pool exists
        (address poolAddress, /* */) = _balancerVault.getPool(_noteETHPoolId);
        require(poolAddress != address(0));

        WETH = _weth;
        NOTE = _note;
        NOTE_ETH_POOL_ID = _noteETHPoolId;
        BALANCER_VAULT = _balancerVault;
        BALANCER_POOL_TOKEN = ERC20(poolAddress);
    }

    /// @notice Initializes sNOTE ERC20 metadata and owner
    function initialize(
        address _owner,
        uint32 _coolDownTimeInSeconds
    ) external initializer {
        string memory _name = "Staked NOTE";
        string memory _symbol = "sNOTE";
        __ERC20_init(_name, _symbol);
        __ERC20Permit_init(_name);

        coolDownTimeInSeconds = _coolDownTimeInSeconds;
        owner = _owner;
        NOTE.safeApprove(address(BALANCER_VAULT), type(uint256).max);
        WETH.safeApprove(address(BALANCER_VAULT), type(uint256).max);

        emit OwnershipTransferred(address(0), _owner);
    }

    /** Governance Methods **/

    /// @notice Authorizes the DAO to upgrade this contract
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Updates the required cooldown time to redeem
    function setCoolDownTime(uint32 _coolDownTimeInSeconds) external onlyOwner {
        coolDownTimeInSeconds = _coolDownTimeInSeconds;
        emit GlobalCoolDownUpdated(_coolDownTimeInSeconds);
    }

    /// @notice Allows the DAO to extract up to 50% of the BPT tokens during a collateral shortfall event
    function extractTokensForCollateralShortfall(uint256 requestedWithdraw) external nonReentrant onlyOwner {
        uint256 bptBalance = BALANCER_POOL_TOKEN.balanceOf(address(this));
        uint256 maxBPTWithdraw = (bptBalance * MAX_SHORTFALL_WITHDRAW) / 100;
        // Do not allow a withdraw of more than the MAX_SHORTFALL_WITHDRAW percentage. Specifically don't
        // revert here since there may be a delay between when governance issues the token amount and when
        // the withdraw actually occurs.
        uint256 bptExitAmount = requestedWithdraw > maxBPTWithdraw ? maxBPTWithdraw : requestedWithdraw;

        IAsset[] memory assets = new IAsset[](2);
        assets[0] = IAsset(address(WETH));
        assets[1] = IAsset(address(NOTE));
        uint256[] memory minAmountsOut = new uint256[](2);
        minAmountsOut[0] = 0;
        minAmountsOut[1] = 0;

        BALANCER_VAULT.exitPool(
            NOTE_ETH_POOL_ID,
            address(this),
            payable(owner), // Owner will receive the NOTE and WETH
            IVault.ExitPoolRequest(
                assets,
                minAmountsOut,
                abi.encode(
                    IVault.ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT,
                    bptExitAmount
                ),
                false // Don't use internal balances
            )
        );
    }

    /// @notice Allows the DAO to set the swap fee on the BPT
    function setSwapFeePercentage(uint256 swapFeePercentage) external onlyOwner {
        IWeightedPool(address(BALANCER_POOL_TOKEN)).setSwapFeePercentage(swapFeePercentage);
    }

    /** User Methods **/

    /// @notice Mints sNOTE from the underlying BPT token.
    /// @param bptAmount is the amount of BPT to transfer from the msg.sender.
    function mintFromBPT(uint256 bptAmount) external nonReentrant {
        // _mint logic requires that tokens are transferred first
        BALANCER_POOL_TOKEN.safeTransferFrom(msg.sender, address(this), bptAmount);
        _mint(msg.sender, bptAmount);
    }

    /// @notice Mints sNOTE from some amount of NOTE tokens.
    /// @param noteAmount amount of NOTE to transfer into the sNOTE contract
    function mintFromNOTE(uint256 noteAmount) external nonReentrant {
        // Transfer the NOTE balance into sNOTE first
        NOTE.safeTransferFrom(msg.sender, address(this), noteAmount);

        IAsset[] memory assets = new IAsset[](2);
        assets[0] = IAsset(address(0));
        assets[1] = IAsset(address(NOTE));
        uint256[] memory maxAmountsIn = new uint256[](2);
        maxAmountsIn[0] = 0;
        maxAmountsIn[1] = noteAmount;

        _mintFromAssets(assets, maxAmountsIn);
    }

    /// @notice Mints sNOTE from some amount of ETH
    function mintFromETH() payable external nonReentrant {
        IAsset[] memory assets = new IAsset[](2);
        assets[0] = IAsset(address(0));
        assets[1] = IAsset(address(NOTE));
        uint256[] memory maxAmountsIn = new uint256[](2);
        maxAmountsIn[0] = msg.value;
        maxAmountsIn[1] = 0;

        _mintFromAssets(assets, maxAmountsIn);
    }

    /// @notice Mints sNOTE from some amount of WETH
    /// @param wethAmount amount of WETH to transfer into the sNOTE contract
    function mintFromWETH(uint256 wethAmount) external nonReentrant {
        // Transfer the NOTE balance into sNOTE first
        WETH.safeTransferFrom(msg.sender, address(this), wethAmount);

        IAsset[] memory assets = new IAsset[](2);
        assets[0] = IAsset(address(WETH));
        assets[1] = IAsset(address(NOTE));
        uint256[] memory maxAmountsIn = new uint256[](2);
        maxAmountsIn[0] = wethAmount;
        maxAmountsIn[1] = 0;

        _mintFromAssets(assets, maxAmountsIn);
    }

    function _mintFromAssets(IAsset[] memory assets, uint256[] memory maxAmountsIn) internal {
        uint256 bptBefore = BALANCER_POOL_TOKEN.balanceOf(address(this));
        // Set msgValue when joining via ETH
        uint256 msgValue = assets[0] == IAsset(address(0)) ? maxAmountsIn[0] : 0;

        BALANCER_VAULT.joinPool{value: msgValue}(
            NOTE_ETH_POOL_ID,
            address(this),
            address(this), // sNOTE will receive the BPT
            IVault.JoinPoolRequest(
                assets,
                maxAmountsIn,
                abi.encode(
                    IVault.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
                    maxAmountsIn,
                    0 // Accept however much BPT the pool will give us
                ),
                false // Don't use internal balances
            )
        );
        uint256 bptAfter = BALANCER_POOL_TOKEN.balanceOf(address(this));

        // Balancer pool token amounts must increase
        _mint(msg.sender, bptAfter - bptBefore);
    }

    /// @notice Begins a cool down period for the sender, this is required to redeem tokens
    function startCoolDown() external {
        // Cannot start a cool down if there is already one in effect
        _requireAccountNotInCoolDown(msg.sender);
        uint256 redeemWindowBegin = block.timestamp + coolDownTimeInSeconds;
        uint256 redeemWindowEnd = redeemWindowBegin + REDEEM_WINDOW_SECONDS;

        accountCoolDown[msg.sender] = AccountCoolDown(_safe32(redeemWindowBegin), _safe32(redeemWindowEnd));

        emit CoolDownStarted(msg.sender, redeemWindowBegin, redeemWindowEnd);
    }

    /// @notice Stops a cool down for the sender
    function stopCoolDown() public {
        // Reset the cool down back to zero so that the account must initiate it again to redeem
        delete accountCoolDown[msg.sender];
        emit CoolDownEnded(msg.sender);
    }

    /// @notice Redeems some amount of sNOTE to underlying BPT tokens (which can then be sold for
    /// NOTE or ETH). An account must have passed its cool down expiration before they can redeem
    /// @param sNOTEAmount amount of sNOTE to redeem
    function redeem(uint256 sNOTEAmount) external nonReentrant {
        AccountCoolDown memory coolDown = accountCoolDown[msg.sender];
        require(sNOTEAmount <= balanceOf(msg.sender), "Insufficient balance");
        require(
            coolDown.redeemWindowBegin != 0 &&
            coolDown.redeemWindowBegin < block.timestamp &&
            block.timestamp < coolDown.redeemWindowEnd,
            "Not in Redemption Window"
        );

        uint256 bptToRedeem = getPoolTokenShare(sNOTEAmount);
        _burn(msg.sender, bptToRedeem);

        BALANCER_POOL_TOKEN.safeTransfer(msg.sender, bptToRedeem);
    }

    /** External View Methods **/

    /// @notice Returns how many Balancer pool tokens an sNOTE token amount has a claim on
    function getPoolTokenShare(uint256 sNOTEAmount) public view returns (uint256 bptClaim) {
        uint256 bptBalance = BALANCER_POOL_TOKEN.balanceOf(address(this));
        // BPT and sNOTE are both in 18 decimal precision so no conversion required
        return (bptBalance * sNOTEAmount) / totalSupply();
    }

    /// @notice Returns the pool token share of a specific account
    function poolTokenShareOf(address account) public view returns (uint256 bptClaim) {
        return getPoolTokenShare(balanceOf(account));
    }

    /// @notice Calculates voting power for a given amount of sNOTE
    /// @param sNOTEAmount amount of sNOTE to calculate voting power for
    /// @return corresponding NOTE voting power
    function getVotingPower(uint256 sNOTEAmount) public view returns (uint256) {
        // Gets the BPT token price (in ETH)
        uint256 bptPrice = IPriceOracle(address(BALANCER_POOL_TOKEN)).getLatest(IPriceOracle.Variable.BPT_PRICE);
        // Gets the NOTE token price (in ETH)
        uint256 notePrice = IPriceOracle(address(BALANCER_POOL_TOKEN)).getLatest(IPriceOracle.Variable.PAIR_PRICE);
        
        // Since both bptPrice and notePrice are denominated in ETH, we can use
        // this formula to calculate noteAmount
        // bptBalance * bptPrice = notePrice * noteAmount
        // noteAmount = bptPrice/notePrice * bptBalance
        uint256 priceRatio = bptPrice * 1e18 / notePrice;
        uint256 bptBalance = BALANCER_POOL_TOKEN.balanceOf(address(this));

        // Amount_note = Price_NOTE_per_BPT * BPT_supply * 80% (80/20 pool)
        uint256 noteAmount = priceRatio * bptBalance * 80 / 100;

        // Reduce precision down to 1e8 (NOTE token)
        // priceRatio and bptBalance are both 1e18 (1e36 total)
        // we divide by 1e28 to get to 1e8
        noteAmount /= 1e28;

        return (noteAmount * sNOTEAmount) / totalSupply();
    }

    /// @notice Calculates voting power for a given account
    /// @param account a given sNOTE holding account
    /// @return corresponding NOTE voting power
    function votingPowerOf(address account) external view returns (uint256) {
        return getVotingPower(balanceOf(account));
    }

    /** Internal Methods **/

    function _requireAccountNotInCoolDown(address account) internal view {
        AccountCoolDown memory coolDown = accountCoolDown[account];
        // An account is in cool down if the redeem window has begun and the window end has not
        // passed yet.
        bool isInCoolDown = (0 < coolDown.redeemWindowBegin && block.timestamp < coolDown.redeemWindowEnd);
        require(!isInCoolDown, "Account in Cool Down");
    }

    /// @notice Burns sNOTE tokens when they are redeemed
    /// @param account account to burn tokens on
    /// @param bptToRedeem the number of BPT tokens being redeemed by the account
    function _burn(address account, uint256 bptToRedeem) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        uint256 poolTokenShare = poolTokenShareOf(account);
        require(bptToRedeem <= poolTokenShare, "Invalid Redeem Amount");

        // Burns the portion of the sNOTE corresponding to the bptToRedeem
        uint256 sNOTEToBurn = balanceOf(account) * bptToRedeem / poolTokenShare;
        // Handles event emission, balance update and total supply update
        super._burn(account, sNOTEToBurn);
    }

    /// @notice Mints sNOTE tokens given a bptAmount
    /// @param account account to mint tokens to
    /// @param bptAmount the number of BPT tokens being minted by the account
    function _mint(address account, uint256 bptAmount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        // Cannot mint if a cooldown is already in effect. If an account mints during a cool down period then they will
        // be able to redeem the tokens immediately, bypassing the cool down.
        _requireAccountNotInCoolDown(account);

        // Immediately after minting, we need to satisfy the equality:
        // (sNOTEToMint * bptBalance) / (totalSupply + sNOTEToMint) == bptAmount

        // Rearranging to get sNOTEToMint on one side:
        // (sNOTEToMint * bptBalance) = (totalSupply + sNOTEToMint) * bptAmount
        // (sNOTEToMint * bptBalance) = totalSupply * bptAmount + sNOTEToMint * bptAmount
        // (sNOTEToMint * bptBalance) - (sNOTEToMint * bptAmount) = totalSupply * bptAmount
        // sNOTEToMint * (bptBalance - bptAmount) = totalSupply * bptAmount
        // sNOTEToMint = (totalSupply * bptAmount) / (bptBalance - bptAmount)

        // NOTE: at this point the BPT has already been transferred into the sNOTE contract, so this
        // bptBalance amount includes bptAmount.
        uint256 bptBalance = BALANCER_POOL_TOKEN.balanceOf(address(this));
        uint256 _totalSupply = totalSupply();
        uint256 sNOTEToMint;
        if (_totalSupply == 0) {
            sNOTEToMint = bptAmount;
        } else {
            sNOTEToMint = (_totalSupply * bptAmount) / (bptBalance - bptAmount);
        }

        // Handles event emission, balance update and total supply update
        super._mint(account, sNOTEToMint);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable) {
        // Cannot send or receive tokens if a cool down is in effect or else accounts
        // can bypass the cool down. It's not clear if sending tokens can be used to bypass
        // the cool down but we restrict it here anyway, there's no clear use case for sending
        // sNOTE tokens during a cool down.
        if (to != address(0)) {
            // Run these checks only when we are not burning tokens. (OZ ERC20 does not allow transfers
            // to address(0), to == address(0) only when _burn is called).
            _requireAccountNotInCoolDown(from);
            _requireAccountNotInCoolDown(to);
        }

        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        // Moves sNOTE checkpoints
        super._afterTokenTransfer(from, to, amount);
    }

    function _safe32(uint256 x) internal pure returns (uint32) {
        require (x <= type(uint32).max);
        return uint32(x);
    }
}