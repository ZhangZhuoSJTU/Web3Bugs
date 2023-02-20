// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./metatx/ERC2771ContextUpgradeable.sol";

import "../security/Pausable.sol";
import "./interfaces/ILPToken.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/IWhiteListPeriodManager.sol";
import "./interfaces/ILiquidityPool.sol";

contract LiquidityProviders is
    Initializable,
    ReentrancyGuardUpgradeable,
    ERC2771ContextUpgradeable,
    OwnableUpgradeable,
    Pausable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address internal constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 public constant BASE_DIVISOR = 10**18;

    ILPToken internal lpToken;
    ILiquidityPool internal liquidityPool;
    ITokenManager internal tokenManager;
    IWhiteListPeriodManager internal whiteListPeriodManager;

    event LiquidityAdded(address indexed tokenAddress, uint256 indexed amount, address indexed lp);
    event LiquidityRemoved(address indexed tokenAddress, uint256 indexed amount, address indexed lp);
    event FeeClaimed(address indexed tokenAddress, uint256 indexed fee, address indexed lp, uint256 sharesBurnt);
    event FeeAdded(address indexed tokenAddress, uint256 indexed fee);
    event EthReceived(address indexed sender, uint256 value);
    event CurrentLiquidityChanged(address indexed token, uint256 indexed oldValue, uint256 indexed newValue);

    // LP Fee Distribution
    mapping(address => uint256) public totalReserve; // Include Liquidity + Fee accumulated
    mapping(address => uint256) public totalLiquidity; // Include Liquidity only
    mapping(address => uint256) public currentLiquidity; // Include current liquidity, updated on every in and out transfer
    mapping(address => uint256) public totalLPFees;
    mapping(address => uint256) public totalSharesMinted;

    /**
     * @dev Modifier for checking to validate a NFTId and it's ownership
     * @param _tokenId token id to validate
     * @param _transactor typically msgSender(), passed to verify against owner of _tokenId
     */
    modifier onlyValidLpToken(uint256 _tokenId, address _transactor) {
        (address token, , ) = lpToken.tokenMetadata(_tokenId);
        require(lpToken.exists(_tokenId), "ERR__TOKEN_DOES_NOT_EXIST");
        require(lpToken.ownerOf(_tokenId) == _transactor, "ERR__TRANSACTOR_DOES_NOT_OWN_NFT");
        _;
    }

    /**
     * @dev Modifier for checking if msg.sender in liquiditypool
     */
    modifier onlyLiquidityPool() {
        require(_msgSender() == address(liquidityPool), "ERR__UNAUTHORIZED");
        _;
    }

    modifier tokenChecks(address tokenAddress) {
        require(tokenAddress != address(0), "Token address cannot be 0");
        require(_isSupportedToken(tokenAddress), "Token not supported");
        _;
    }

    /**
     * @dev initalizes the contract, acts as constructor
     * @param _trustedForwarder address of trusted forwarder
     */
    function initialize(
        address _trustedForwarder,
        address _lpToken,
        address _tokenManager,
        address _pauser
    ) public initializer {
        __ERC2771Context_init(_trustedForwarder);
        __Ownable_init();
        __Pausable_init(_pauser);
        __ReentrancyGuard_init();
        _setLPToken(_lpToken);
        _setTokenManager(_tokenManager);
    }

    function _isSupportedToken(address _token) internal view returns (bool) {
        return tokenManager.getTokensInfo(_token).supportedToken;
    }

    function getTotalReserveByToken(address tokenAddress) public view returns (uint256) {
        return totalReserve[tokenAddress];
    }

    function getSuppliedLiquidityByToken(address tokenAddress) public view returns (uint256) {
        return totalLiquidity[tokenAddress];
    }

    function getTotalLPFeeByToken(address tokenAddress) public view returns (uint256) {
        return totalLPFees[tokenAddress];
    }

    function getCurrentLiquidity(address tokenAddress) public view returns (uint256) {
        return currentLiquidity[tokenAddress];
    }

    /**
     * @dev To be called post initialization, used to set address of NFT Contract
     * @param _lpToken address of lpToken
     */
    function setLpToken(address _lpToken) external onlyOwner {
        _setLPToken(_lpToken);
    }

    /**
     * Internal method to set LP token contract.
     */
    function _setLPToken(address _lpToken) internal {
        lpToken = ILPToken(_lpToken);
    }

    function increaseCurrentLiquidity(address tokenAddress, uint256 amount) public onlyLiquidityPool {
        _increaseCurrentLiquidity(tokenAddress, amount);
    }

    function decreaseCurrentLiquidity(address tokenAddress, uint256 amount) public onlyLiquidityPool {
        _decreaseCurrentLiquidity(tokenAddress, amount);
    }

    function _increaseCurrentLiquidity(address tokenAddress, uint256 amount) private {
        currentLiquidity[tokenAddress] += amount;
        emit CurrentLiquidityChanged(tokenAddress, currentLiquidity[tokenAddress]-amount, currentLiquidity[tokenAddress]);
    }

    function _decreaseCurrentLiquidity(address tokenAddress, uint256 amount) private {
        currentLiquidity[tokenAddress] -= amount;
        emit CurrentLiquidityChanged(tokenAddress, currentLiquidity[tokenAddress]+amount, currentLiquidity[tokenAddress]);
    }

    /**
     * Public method to set TokenManager contract.
     */
    function setTokenManager(address _tokenManager) external onlyOwner {
        _setTokenManager(_tokenManager);
    }

    /**
     * Internal method to set TokenManager contract.
     */
    function _setTokenManager(address _tokenManager) internal {
        tokenManager = ITokenManager(_tokenManager);
    }

    /**
     * @dev To be called post initialization, used to set address of WhiteListPeriodManager Contract
     * @param _whiteListPeriodManager address of WhiteListPeriodManager
     */
    function setWhiteListPeriodManager(address _whiteListPeriodManager) external onlyOwner {
        whiteListPeriodManager = IWhiteListPeriodManager(_whiteListPeriodManager);
    }

    /**
     * @dev To be called post initialization, used to set address of LiquidityPool Contract
     * @param _liquidityPool address of LiquidityPool
     */
    function setLiquidityPool(address _liquidityPool) external onlyOwner {
        liquidityPool = ILiquidityPool(_liquidityPool);
    }

    /**
     * @dev Returns price of Base token in terms of LP Shares
     * @param _baseToken address of baseToken
     * @return Price of Base token in terms of LP Shares
     */
    function getTokenPriceInLPShares(address _baseToken) public view returns (uint256) {
        uint256 supply = totalSharesMinted[_baseToken];
        if (supply > 0) {
            return totalSharesMinted[_baseToken] / totalReserve[_baseToken];
        }
        return BASE_DIVISOR;
    }

    /**
     * @dev Converts shares to token amount
     */

    function sharesToTokenAmount(uint256 _shares, address _tokenAddress) public view returns (uint256) {
        return (_shares * totalReserve[_tokenAddress]) / totalSharesMinted[_tokenAddress];
    }

    /**
     * @dev Returns the fee accumulated on a given NFT
     * @param _nftId Id of NFT
     * @return accumulated fee
     */
    function getFeeAccumulatedOnNft(uint256 _nftId) public view returns (uint256) {
        require(lpToken.exists(_nftId), "ERR__INVALID_NFT");

        (address _tokenAddress, uint256 nftSuppliedLiquidity, uint256 totalNFTShares) = lpToken.tokenMetadata(_nftId);

        if (totalNFTShares == 0) {
            return 0;
        }
        // Calculate rewards accumulated
        uint256 eligibleLiquidity = sharesToTokenAmount(totalNFTShares, _tokenAddress);
        uint256 lpFeeAccumulated;

        // Handle edge cases where eligibleLiquidity is less than what was supplied by very small amount 
        if(nftSuppliedLiquidity > eligibleLiquidity) {
            lpFeeAccumulated = 0;
        } else {
            unchecked {
                lpFeeAccumulated = eligibleLiquidity - nftSuppliedLiquidity;
            }
        }
        return lpFeeAccumulated;
    }

    /**
     * @dev Records fee being added to total reserve
     * @param _token Address of Token for which LP fee is being added
     * @param _amount Amount being added
     */
    function addLPFee(address _token, uint256 _amount) external onlyLiquidityPool tokenChecks(_token) whenNotPaused {
        totalReserve[_token] += _amount;
        totalLPFees[_token] += _amount;
        emit FeeAdded(_token, _amount);
    }

    /**
     * @dev Internal function to add liquidity to a new NFT
     */
    function _addLiquidity(address _token, uint256 _amount) internal {
        require(_amount > 0, "ERR__AMOUNT_IS_0");
        uint256 nftId = lpToken.mint(_msgSender());
        LpTokenMetadata memory data = LpTokenMetadata(_token, 0, 0);
        lpToken.updateTokenMetadata(nftId, data);
        _increaseLiquidity(nftId, _amount);
    }

    /**
     * @dev Function to mint a new NFT for a user, add native liquidity and store the
     *      record in the newly minted NFT
     */
    function addNativeLiquidity() external payable nonReentrant tokenChecks(NATIVE) whenNotPaused {
        (bool success, ) = address(liquidityPool).call{value: msg.value}("");
        require(success, "ERR__NATIVE_TRANSFER_FAILED");
        _addLiquidity(NATIVE, msg.value);
    }

    /**
     * @dev Function to mint a new NFT for a user, add token liquidity and store the
     *      record in the newly minted NFT
     * @param _token Address of token for which liquidity is to be added
     * @param _amount Amount of liquidity added
     */
    function addTokenLiquidity(address _token, uint256 _amount)
        external
        nonReentrant
        tokenChecks(_token)
        whenNotPaused
    {
        require(_token != NATIVE, "ERR__WRONG_FUNCTION");
        require(
            IERC20Upgradeable(_token).allowance(_msgSender(), address(this)) >= _amount,
            "ERR__INSUFFICIENT_ALLOWANCE"
        );
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(_token), _msgSender(), address(liquidityPool), _amount);
        _addLiquidity(_token, _amount);
    }

    /**
     * @dev Internal helper function to increase liquidity in a given NFT
     */
    function _increaseLiquidity(uint256 _nftId, uint256 _amount) internal onlyValidLpToken(_nftId, _msgSender()) {
        (address token, uint256 totalSuppliedLiquidity, uint256 totalShares) = lpToken.tokenMetadata(_nftId);

        require(_amount > 0, "ERR__AMOUNT_IS_0");
        whiteListPeriodManager.beforeLiquidityAddition(_msgSender(), token, _amount);

        uint256 mintedSharesAmount;
        // Adding liquidity in the pool for the first time
        if (totalReserve[token] == 0) {
            mintedSharesAmount = BASE_DIVISOR * _amount;
        } else {
            mintedSharesAmount = (_amount * totalSharesMinted[token]) / totalReserve[token];
        }

        require(mintedSharesAmount >= BASE_DIVISOR, "ERR__AMOUNT_BELOW_MIN_LIQUIDITY");

        totalLiquidity[token] += _amount;
        totalReserve[token] += _amount;
        totalSharesMinted[token] += mintedSharesAmount;

        LpTokenMetadata memory data = LpTokenMetadata(
            token,
            totalSuppliedLiquidity + _amount,
            totalShares + mintedSharesAmount
        );
        lpToken.updateTokenMetadata(_nftId, data);

        // Increase the current liquidity
        _increaseCurrentLiquidity(token, _amount);
        emit LiquidityAdded(token, _amount, _msgSender());
    }

    /**
     * @dev Function to allow LPs to add ERC20 token liquidity to existing NFT
     * @param _nftId ID of NFT for updating the balances
     * @param _amount Token amount to be added
     */
    function increaseTokenLiquidity(uint256 _nftId, uint256 _amount) external nonReentrant whenNotPaused {
        (address token, , ) = lpToken.tokenMetadata(_nftId);
        require(_isSupportedToken(token), "ERR__TOKEN_NOT_SUPPORTED");
        require(token != NATIVE, "ERR__WRONG_FUNCTION");
        require(
            IERC20Upgradeable(token).allowance(_msgSender(), address(this)) >= _amount,
            "ERR__INSUFFICIENT_ALLOWANCE"
        );
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(token), _msgSender(), address(liquidityPool), _amount);
        _increaseLiquidity(_nftId, _amount);
    }

    /**
     * @dev Function to allow LPs to add native token liquidity to existing NFT
     */
    function increaseNativeLiquidity(uint256 _nftId) external payable nonReentrant whenNotPaused {
        (address token, , ) = lpToken.tokenMetadata(_nftId);
        require(_isSupportedToken(NATIVE), "ERR__TOKEN_NOT_SUPPORTED");
        require(token == NATIVE, "ERR__WRONG_FUNCTION");
        (bool success, ) = address(liquidityPool).call{value: msg.value}("");
        require(success, "ERR__NATIVE_TRANSFER_FAILED");
        _increaseLiquidity(_nftId, msg.value);
    }

    /**
     * @dev Function to allow LPs to remove their liquidity from an existing NFT
     *      Also automatically redeems any earned fee
     */
    function removeLiquidity(uint256 _nftId, uint256 _amount)
        external
        nonReentrant
        onlyValidLpToken(_nftId, _msgSender())
        whenNotPaused
    {
        (address _tokenAddress, uint256 nftSuppliedLiquidity, uint256 totalNFTShares) = lpToken.tokenMetadata(_nftId);
        require(_isSupportedToken(_tokenAddress), "ERR__TOKEN_NOT_SUPPORTED");

        require(_amount != 0, "ERR__INVALID_AMOUNT");
        require(nftSuppliedLiquidity >= _amount, "ERR__INSUFFICIENT_LIQUIDITY");
        whiteListPeriodManager.beforeLiquidityRemoval(_msgSender(), _tokenAddress, _amount);
        // Claculate how much shares represent input amount
        uint256 lpSharesForInputAmount = _amount * getTokenPriceInLPShares(_tokenAddress);

        // Calculate rewards accumulated
        uint256 eligibleLiquidity = sharesToTokenAmount(totalNFTShares, _tokenAddress);
        
        uint256 lpFeeAccumulated;

        // Handle edge cases where eligibleLiquidity is less than what was supplied by very small amount 
        if(nftSuppliedLiquidity > eligibleLiquidity) {
            lpFeeAccumulated = 0;
        } else {
            unchecked {
                lpFeeAccumulated = eligibleLiquidity - nftSuppliedLiquidity;
            }
        }
        // Calculate amount of lp shares that represent accumulated Fee
        uint256 lpSharesRepresentingFee = lpFeeAccumulated * getTokenPriceInLPShares(_tokenAddress);

        totalLPFees[_tokenAddress] -= lpFeeAccumulated;
        uint256 amountToWithdraw = _amount + lpFeeAccumulated;
        uint256 lpSharesToBurn = lpSharesForInputAmount + lpSharesRepresentingFee;

        // Handle round off errors to avoid dust lp token in contract
        if (totalNFTShares - lpSharesToBurn < BASE_DIVISOR) {
            lpSharesToBurn = totalNFTShares;
        }
        totalReserve[_tokenAddress] -= amountToWithdraw;
        totalLiquidity[_tokenAddress] -= _amount;
        totalSharesMinted[_tokenAddress] -= lpSharesToBurn;

        _decreaseCurrentLiquidity(_tokenAddress, _amount);

        _burnSharesFromNft(_nftId, lpSharesToBurn, _amount, _tokenAddress);

        _transferFromLiquidityPool(_tokenAddress, _msgSender(), amountToWithdraw);

        emit LiquidityRemoved(_tokenAddress, amountToWithdraw, _msgSender());
    }

    /**
     * @dev Function to allow LPs to claim the fee earned on their NFT
     * @param _nftId ID of NFT where liquidity is recorded
     */
    function claimFee(uint256 _nftId) external onlyValidLpToken(_nftId, _msgSender()) whenNotPaused nonReentrant {
        (address _tokenAddress, uint256 nftSuppliedLiquidity, uint256 totalNFTShares) = lpToken.tokenMetadata(_nftId);
        require(_isSupportedToken(_tokenAddress), "ERR__TOKEN_NOT_SUPPORTED");

        uint256 lpSharesForSuppliedLiquidity = nftSuppliedLiquidity * getTokenPriceInLPShares(_tokenAddress);

        // Calculate rewards accumulated
        uint256 eligibleLiquidity = sharesToTokenAmount(totalNFTShares, _tokenAddress);
        uint256 lpFeeAccumulated = eligibleLiquidity - nftSuppliedLiquidity;
        require(lpFeeAccumulated > 0, "ERR__NO_REWARDS_TO_CLAIM");
        // Calculate amount of lp shares that represent accumulated Fee
        uint256 lpSharesRepresentingFee = totalNFTShares - lpSharesForSuppliedLiquidity;

        totalReserve[_tokenAddress] -= lpFeeAccumulated;
        totalSharesMinted[_tokenAddress] -= lpSharesRepresentingFee;
        totalLPFees[_tokenAddress] -= lpFeeAccumulated;

        _burnSharesFromNft(_nftId, lpSharesRepresentingFee, 0, _tokenAddress);
        _transferFromLiquidityPool(_tokenAddress, _msgSender(), lpFeeAccumulated);
        emit FeeClaimed(_tokenAddress, lpFeeAccumulated, _msgSender(), lpSharesRepresentingFee);
    }

    /**
     * @dev Internal Function to burn LP shares and remove liquidity from existing NFT
     */
    function _burnSharesFromNft(
        uint256 _nftId,
        uint256 _shares,
        uint256 _tokenAmount,
        address _tokenAddress
    ) internal {
        (, uint256 nftSuppliedLiquidity, uint256 nftShares) = lpToken.tokenMetadata(_nftId);
        nftShares -= _shares;
        nftSuppliedLiquidity -= _tokenAmount;

        lpToken.updateTokenMetadata(_nftId, LpTokenMetadata(_tokenAddress, nftSuppliedLiquidity, nftShares));
    }

    function _transferFromLiquidityPool(
        address _tokenAddress,
        address _receiver,
        uint256 _tokenAmount
    ) internal {
        liquidityPool.transfer(_tokenAddress, _receiver, _tokenAmount);
    }

    function getSuppliedLiquidity(uint256 _nftId) external view returns (uint256) {
        (, uint256 totalSuppliedLiquidity, ) = lpToken.tokenMetadata(_nftId);
        return totalSuppliedLiquidity;
    }

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address sender)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771ContextUpgradeable._msgData();
    }

    receive() external payable {
        emit EthReceived(_msgSender(), msg.value);
    }
}
