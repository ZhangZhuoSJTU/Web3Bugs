// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../security/Pausable.sol";
import "./metatx/ERC2771ContextUpgradeable.sol";
import "./interfaces/ILiquidityProviders.sol";
import "./interfaces/ITokenManager.sol";
import "./interfaces/ILPToken.sol";

contract WhitelistPeriodManager is Initializable, OwnableUpgradeable, Pausable, ERC2771ContextUpgradeable {
    ILiquidityProviders private liquidityProviders;
    ITokenManager private tokenManager;
    ILPToken private lpToken;
    bool public areWhiteListRestrictionsEnabled;

    /* LP Status */
    // EOA? -> status, stores addresses that we want to ignore, like staking contracts.
    mapping(address => bool) public isExcludedAddress;
    // Token -> TVL
    mapping(address => uint256) private totalLiquidity;
    // Token -> TVL
    mapping(address => mapping(address => uint256)) public totalLiquidityByLp;

    /* Caps */
    // Token Address -> Limit
    mapping(address => uint256) public perTokenTotalCap;
    // Token Address -> Limit
    mapping(address => uint256) public perTokenWalletCap;

    event ExcludedAddressStatusUpdated(address indexed lp, bool indexed status);
    event TotalCapUpdated(address indexed token, uint256 totalCap);
    event PerTokenWalletCap(address indexed token, uint256 perCommunityWalletCap);
    event WhiteListStatusUpdated(bool status);

    modifier onlyLiquidityPool() {
        require(_msgSender() == address(liquidityProviders), "ERR__UNAUTHORIZED");
        _;
    }

    modifier onlyLpNft() {
        require(_msgSender() == address(lpToken), "ERR__UNAUTHORIZED");
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
        address _liquidityProviders,
        address _tokenManager,
        address _lpToken,
        address _pauser
    ) public initializer {
        __ERC2771Context_init(_trustedForwarder);
        __Ownable_init();
        __Pausable_init(_pauser);
        areWhiteListRestrictionsEnabled = true;
        _setLiquidityProviders(_liquidityProviders);
        _setTokenManager(_tokenManager);
        _setLpToken(_lpToken);
    }

    function _isSupportedToken(address _token) internal view returns (bool) {
        return tokenManager.getTokensInfo(_token).supportedToken;
    }

    /**
     * @dev Internal Function which checks for various caps before allowing LP to add liqudity
     */
    function _beforeLiquidityAddition(
        address _lp,
        address _token,
        uint256 _amount
    ) internal {
        if (isExcludedAddress[_lp]) {
            return;
        }
        // Per Token Total Cap or PTTC
        require(ifEnabled(totalLiquidity[_token] + _amount <= perTokenTotalCap[_token]), "ERR__LIQUIDITY_EXCEEDS_PTTC");
        require(
            ifEnabled(totalLiquidityByLp[_token][_lp] + _amount <= perTokenWalletCap[_token]),
            "ERR__LIQUIDITY_EXCEEDS_PTWC"
        );
        totalLiquidity[_token] += _amount;
        totalLiquidityByLp[_token][_lp] += _amount;
    }

    /**
     * @dev External Function which checks for various caps before allowing LP to add liqudity. Only callable by LiquidityPoolManager
     */
    function beforeLiquidityAddition(
        address _lp,
        address _token,
        uint256 _amount
    ) external onlyLiquidityPool whenNotPaused {
        _beforeLiquidityAddition(_lp, _token, _amount);
    }

    /**
     * @dev Internal Function which checks for various caps before allowing LP to remove liqudity
     */
    function _beforeLiquidityRemoval(
        address _lp,
        address _token,
        uint256 _amount
    ) internal {
        if (isExcludedAddress[_lp]) {
            return;
        }
        totalLiquidityByLp[_token][_lp] -= _amount;
        totalLiquidity[_token] -= _amount;
    }

    /**
     * @dev External Function which checks for various caps before allowing LP to remove liqudity. Only callable by LiquidityPoolManager
     */
    function beforeLiquidityRemoval(
        address _lp,
        address _token,
        uint256 _amount
    ) external onlyLiquidityPool whenNotPaused {
        _beforeLiquidityRemoval(_lp, _token, _amount);
    }

    /**
     * @dev External Function which checks for various caps before allowing LP to transfer their LpNFT. Only callable by LpNFT contract
     */
    function beforeLiquidityTransfer(
        address _from,
        address _to,
        address _token,
        uint256 _amount
    ) external onlyLpNft whenNotPaused {
        // Release limit from  _from
        _beforeLiquidityRemoval(_from, _token, _amount);

        // Block limit of _to
        _beforeLiquidityAddition(_to, _token, _amount);
    }

    function _setTokenManager(address _tokenManager) internal {
        tokenManager = ITokenManager(_tokenManager);
    }

    function setTokenManager(address _tokenManager) external onlyOwner {
        _setTokenManager(_tokenManager);
    }

    function _setLiquidityProviders(address _liquidityProviders) internal {
        liquidityProviders = ILiquidityProviders(_liquidityProviders);
    }

    function setLiquidityProviders(address _liquidityProviders) external onlyOwner {
        _setLiquidityProviders(_liquidityProviders);
    }

    function _setLpToken(address _lpToken) internal {
        lpToken = ILPToken(_lpToken);
    }

    function setLpToken(address _lpToken) external onlyOwner {
        _setLpToken(_lpToken);
    }

    function setIsExcludedAddressStatus(address[] memory _addresses, bool[] memory _status) external onlyOwner {
        require(_addresses.length == _status.length, "ERR__LENGTH_MISMATCH");
        for (uint256 i = 0; i < _addresses.length; ++i) {
            isExcludedAddress[_addresses[i]] = _status[i];
            emit ExcludedAddressStatusUpdated(_addresses[i], _status[i]);
        }
    }

    function setTotalCap(address _token, uint256 _totalCap) public tokenChecks(_token) onlyOwner {
        require(totalLiquidity[_token] <= _totalCap, "ERR__TOTAL_CAP_LESS_THAN_SL");
        require(_totalCap >= perTokenWalletCap[_token], "ERR__TOTAL_CAP_LT_PTWC");
        if (perTokenTotalCap[_token] != _totalCap) {
            perTokenTotalCap[_token] = _totalCap;
            emit TotalCapUpdated(_token, _totalCap);
        }
    }

    /**
     * @dev Special care must be taken when calling this function
     *      There are no checks for _perTokenWalletCap (since it's onlyOwner), but it's essential that it
     *      should be >= max lp provided by an lp.
     *      Checking this on chain will probably require implementing a bbst, which needs more bandwidth
     *      Call the view function getMaxCommunityLpPositon() separately before changing this value
     */
    function setPerTokenWalletCap(address _token, uint256 _perTokenWalletCap) public tokenChecks(_token) onlyOwner {
        require(_perTokenWalletCap <= perTokenTotalCap[_token], "ERR__PWC_GT_PTTC");
        if (perTokenWalletCap[_token] != _perTokenWalletCap) {
            perTokenWalletCap[_token] = _perTokenWalletCap;
            emit PerTokenWalletCap(_token, _perTokenWalletCap);
        }
    }

    function setCap(
        address _token,
        uint256 _totalCap,
        uint256 _perTokenWalletCap
    ) public onlyOwner {
        setTotalCap(_token, _totalCap);
        setPerTokenWalletCap(_token, _perTokenWalletCap);
    }

    function setCaps(
        address[] memory _tokens,
        uint256[] memory _totalCaps,
        uint256[] memory _perTokenWalletCaps
    ) external onlyOwner {
        require(
            _tokens.length == _totalCaps.length && _totalCaps.length == _perTokenWalletCaps.length,
            "ERR__LENGTH_MISMACH"
        );
        for (uint256 i = 0; i < _tokens.length; ++i) {
            setCap(_tokens[i], _totalCaps[i], _perTokenWalletCaps[i]);
        }
    }

    /**
     * @dev Enables (or disables) reverts if liquidity exceeds caps.
     *      Even if this is disabled, the contract will continue to track LP's positions
     */
    function setAreWhiteListRestrictionsEnabled(bool _status) external onlyOwner {
        areWhiteListRestrictionsEnabled = _status;
        emit WhiteListStatusUpdated(_status);
    }

    /**
     * @dev Returns the maximum amount a single community LP has provided
     */
    function getMaxCommunityLpPositon(address _token) external view returns (uint256) {
        uint256 totalSupply = lpToken.totalSupply();
        uint256 maxLp = 0;
        for (uint256 i = 1; i <= totalSupply; ++i) {
            uint256 liquidity = totalLiquidityByLp[_token][lpToken.ownerOf(i)];
            if (liquidity > maxLp) {
                maxLp = liquidity;
            }
        }
        return maxLp;
    }

    /**
     * @dev returns the value of if (areWhiteListEnabled) then (_cond)
     */
    function ifEnabled(bool _cond) private view returns (bool) {
        return !areWhiteListRestrictionsEnabled || (areWhiteListRestrictionsEnabled && _cond);
    }

    /**
     * @dev Meta-Transaction Helper, returns msgSender
     */
    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    /**
     * @dev Meta-Transaction Helper, returns msgData
     */
    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771ContextUpgradeable._msgData();
    }
}
