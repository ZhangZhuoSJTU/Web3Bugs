//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../interfaces/IMoneyMarketAdapter.sol";
import "../Controller.sol";

contract PureTokenAdapter is Controller, IMoneyMarketAdapter {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public assetManager;
    mapping(address => uint256) public override floorMap;
    mapping(address => uint256) public override ceilingMap;

    modifier checkTokenSupported(address tokenAddress) {
        require(_supportsToken(tokenAddress), "PureTokenAdapter: token not supported");
        _;
    }

    modifier onlyAssetManager() {
        require(msg.sender == assetManager, "PureTokenAdapter: only asset manager can call");
        _;
    }

    function __PureTokenAdapter_init(address _assetManager) public initializer {
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

    function getRate(address) external pure override returns (uint256) {
        return 0;
    }

    // solhint-disable-next-line no-empty-blocks
    function deposit(address tokenAddress) external view override checkTokenSupported(tokenAddress) {
        // Don't have to do anything because AssetManager already transfered tokens here
    }

    function withdraw(
        address tokenAddress,
        address recipient,
        uint256 tokenAmount
    ) external override onlyAssetManager checkTokenSupported(tokenAddress) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        token.safeTransfer(recipient, tokenAmount);
    }

    function withdrawAll(address tokenAddress, address recipient)
        external
        override
        onlyAssetManager
        checkTokenSupported(tokenAddress)
    {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        token.safeTransfer(recipient, token.balanceOf(address(this)));
    }

    function claimTokens(address tokenAddress, address recipient) external override onlyAssetManager {
        _claimTokens(tokenAddress, recipient);
    }

    function getSupply(address tokenAddress) external view override returns (uint256) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        return token.balanceOf(address(this));
    }

    function getSupplyView(address tokenAddress) external view override returns (uint256) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        return token.balanceOf(address(this));
    }

    function supportsToken(address tokenAddress) external view override returns (bool) {
        return _supportsToken(tokenAddress);
    }

    function _supportsToken(address tokenAddress) internal view returns (bool) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        return tokenAddress != address(0) && token.balanceOf(address(this)) >= 0; // simple check if the token is ERC20 compatible
    }

    function _claimTokens(address tokenAddress, address recipient) private {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.safeTransfer(recipient, balance);
    }
}
