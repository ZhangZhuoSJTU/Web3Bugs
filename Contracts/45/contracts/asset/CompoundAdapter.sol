//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../interfaces/IMoneyMarketAdapter.sol";
import "../Controller.sol";

abstract contract CToken is IERC20Upgradeable {
    function supplyRatePerBlock() external view virtual returns (uint256);

    function mint(uint256 mintAmount) external virtual returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external virtual returns (uint256);

    function balanceOfUnderlying(address owner) external virtual returns (uint256);

    function exchangeRateStored() external view virtual returns (uint256);
}

/**
 * @title CompoundAdapter
 *  @dev The implementation of Compound.Finance MoneyMarket that integrates with AssetManager.
 */
contract CompoundAdapter is Controller, IMoneyMarketAdapter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    mapping(address => address) public tokenToCToken;

    address public assetManager;
    mapping(address => uint256) public override floorMap;
    mapping(address => uint256) public override ceilingMap;

    modifier checkTokenSupported(address tokenAddress) {
        require(_supportsToken(tokenAddress), "Token not supported");
        _;
    }

    modifier onlyAssetManager() {
        require(msg.sender == assetManager, "Only asset manager can call");
        _;
    }

    function __CompoundAdapter_init(address _assetManager) public initializer {
        Controller.__Controller_init(msg.sender);
        assetManager = _assetManager;
    }

    function setAssetManager(address _assetManager) external onlyAdmin {
        assetManager = _assetManager;
    }

    function setFloor(address tokenAddress, uint256 floor) external onlyAdmin {
        floorMap[tokenAddress] = floor;
    }

    function setCeiling(address tokenAddress, uint256 ceiling) external onlyAdmin {
        ceilingMap[tokenAddress] = ceiling;
    }

    function mapTokenToCToken(address tokenAddress, address cTokenAddress) external onlyAdmin {
        tokenToCToken[tokenAddress] = cTokenAddress;
    }

    function getRate(address tokenAddress) external view override returns (uint256) {
        address cTokenAddress = tokenToCToken[tokenAddress];
        CToken cToken = CToken(cTokenAddress);

        return cToken.supplyRatePerBlock();
    }

    function deposit(address tokenAddress) external override checkTokenSupported(tokenAddress) {
        // get cToken
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        address cTokenAddress = tokenToCToken[tokenAddress];
        CToken cToken = CToken(cTokenAddress);
        uint256 amount = token.balanceOf(address(this));
        // mint cTokens
        token.safeApprove(cTokenAddress, 0);
        token.safeApprove(cTokenAddress, amount);
        uint256 result = cToken.mint(amount);
        require(result == 0, "Error minting the cToken");
    }

    function withdraw(
        address tokenAddress,
        address recipient,
        uint256 tokenAmount
    ) external override onlyAssetManager checkTokenSupported(tokenAddress) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        address cTokenAddress = tokenToCToken[tokenAddress];
        CToken cToken = CToken(cTokenAddress);

        uint256 result = cToken.redeemUnderlying(tokenAmount);
        require(result == 0, "Error redeeming the cToken");
        token.safeTransfer(recipient, tokenAmount);
    }

    function withdrawAll(address tokenAddress, address recipient)
        external
        override
        onlyAssetManager
        checkTokenSupported(tokenAddress)
    {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        address cTokenAddress = tokenToCToken[tokenAddress];
        CToken cToken = CToken(cTokenAddress);

        uint256 result = cToken.redeemUnderlying(cToken.balanceOfUnderlying(address(this)));
        require(result == 0, "Error redeeming the cToken");
        token.safeTransfer(recipient, token.balanceOf(address(this)));
    }

    function claimTokens(address tokenAddress, address recipient) external override onlyAssetManager {
        _claimTokens(tokenAddress, recipient);
    }

    function getSupply(address tokenAddress) external override returns (uint256) {
        address cTokenAddress = tokenToCToken[tokenAddress];
        CToken cToken = CToken(cTokenAddress);

        // hack for preventing a rounding issue in `redeemUnderlying`
        if (cToken.balanceOf(address(this)) <= 10) {
            return 0;
        }

        return cToken.balanceOfUnderlying(address(this));
    }

    function getSupplyView(address tokenAddress) external view override returns (uint256) {
        address cTokenAddress = tokenToCToken[tokenAddress];
        CToken cToken = CToken(cTokenAddress);

        // hack for preventing a rounding issue in `redeemUnderlying`
        if (cToken.balanceOf(address(this)) <= 10) {
            return 0;
        }

        uint256 exchangeRate = cToken.exchangeRateStored();
        uint256 balance = cToken.balanceOf(address(this));
        return (balance * exchangeRate) / 10**18;
    }

    function supportsToken(address tokenAddress) external view override returns (bool) {
        return _supportsToken(tokenAddress);
    }

    function _supportsToken(address tokenAddress) internal view returns (bool) {
        address cTokenAddress = tokenToCToken[tokenAddress];

        return cTokenAddress != address(0);
    }

    function _claimTokens(address tokenAddress, address recipient) private {
        require(recipient != address(0), "Recipient can not be zero");
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.safeTransfer(recipient, balance);
    }
}
