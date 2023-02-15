// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";
import "../interfaces/ILegacyController.sol";
import "../interfaces/ILegacyVault.sol";
import "../interfaces/IManager.sol";
import "../interfaces/IVault.sol";

contract LegacyController is ILegacyController {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant MAX = 10000;

    IManager public immutable manager;
    IERC20 public immutable token;
    address public immutable metavault;

    bool public investEnabled;
    IVault public vault;
    IConverter public converter;

    event Earn(uint256 amount);
    event Withdraw(uint256 amount);

    /**
     * @param _manager The vault manager contract
     * @param _metavault The legacy MetaVault contract
     */
    constructor(
        address _manager,
        address _metavault
    )
        public
    {
        manager = IManager(_manager);
        metavault = _metavault;
        address _token = ILegacyVault(_metavault).want();
        token = IERC20(_token);
    }

    /**
     * @notice Sets the vault address
     * @param _vault The v3 vault address
     */
    function setVault(
        address _vault
    )
        external
        onlyStrategist
    {
        IVault cachedVault = vault;
        if (address(cachedVault) != address(0)) {
            cachedVault.withdrawAll();
            token.safeTransfer(metavault, token.balanceOf(address(this)));
        }
        vault = IVault(_vault);
    }

    /**
     * @notice Sets the converter address
     * @param _converter The address of the converter
     */
    function setConverter(
        address _converter
    )
        external
        onlyStrategist
    {
        converter = IConverter(_converter);
    }

    /**
     * @notice Sets the investEnabled status flag
     * @param _investEnabled Bool for enabling investment
     */
    function setInvestEnabled(
        bool _investEnabled
    )
        external
        onlyStrategist
    {
        investEnabled = _investEnabled;
    }

    /**
     * @notice Recovers stuck tokens sent directly to this contract
     * @dev This only allows the strategist to recover unsupported tokens
     * @param _token The address of the token
     * @param _receiver The address to receive the tokens
     */
    function recoverUnsupportedToken(
        address _token,
        address _receiver
    )
        external
        onlyStrategist
    {
        require(_token != address(token), "!_token");
        IERC20(_token).safeTransfer(_receiver, IERC20(_token).balanceOf(address(this)));
    }

    /**
     * @notice Returns the balance of the given token on the vault
     */
    function balanceOf(
        address
    )
        external
        view
        returns (uint256)
    {
        return token.balanceOf(address(this))
                    .add(IERC20(vault.getLPToken()).balanceOf(address(this)));
    }

    /**
     * @notice Returns the withdraw fee for withdrawing the given token and amount
     * @param _amount The amount to withdraw
     */
    function withdrawFee(
        address ,
        uint256 _amount
    )
        external
        view
        returns (uint256)
    {
        return manager.withdrawalProtectionFee().mul(_amount).div(MAX);
    }

    /**
     * @notice Withdraws the amount from the v3 vault
     * @param _amount The amount to withdraw
     */
    function withdraw(
        address,
        uint256 _amount
    )
        external
        onlyEnabledVault
        onlyMetaVault
    {
        uint256 _balance = token.balanceOf(address(this));
        // happy path exits without calling back to the vault
        if (_balance >= _amount) {
            token.safeTransfer(metavault, _amount);
            emit Withdraw(_amount);
        } else {
            uint256 _toWithdraw = _amount.sub(_balance);
            IVault cachedVault = vault;
            // convert to vault shares
            address _token = cachedVault.getToken();
            // get the amount of the token that we would be withdrawing
            uint256 _expected = converter.expected(address(token), _token, _toWithdraw);
            uint256 _shares = _expected.mul(1e18).div(cachedVault.getPricePerFullShare());
            cachedVault.withdraw(_shares);
            _balance = IERC20(_token).balanceOf(address(this));
            IERC20(_token).safeTransfer(address(converter), _balance);
            // TODO: calculate expected
            converter.convert(_token, address(token), _balance, 1);
            emit Withdraw(token.balanceOf(address(this)));
            token.safeTransfer(metavault, token.balanceOf(address(this)));
        }
    }

    /**
     * @notice Only emits the Earn event
     * @dev This is a dummy function to allow the MetaVault to call
     * @param _amount The amount to earn
     */
    function earn(
        address,
        uint256 _amount
    )
        external
        onlyMetaVault
    {
        emit Earn(_amount);
    }

    /**
     * @notice Deposits the given token to the v3 vault
     * @param _expected The expected amount to deposit after conversion
     */
    function legacyDeposit(
        uint256 _expected
    )
        external
        override
        onlyEnabledConverter
        onlyHarvester
    {
        address _token = vault.getToken();
        uint256 _amount = token.balanceOf(address(this));
        token.safeTransfer(address(converter), _amount);
        converter.convert(address(token), _token, _amount, _expected);
        IERC20(_token).safeApprove(address(vault), 0);
        IERC20(_token).safeApprove(address(vault), type(uint256).max);
        vault.deposit(IERC20(_token).balanceOf(address(this)));
    }

    /**
     * @notice Reverts if the converter is not set
     */
    modifier onlyEnabledConverter() {
        require(address(converter) != address(0), "!converter");
        _;
    }

    /**
     * @notice Reverts if the vault is not set
     */
    modifier onlyEnabledVault() {
        require(address(vault) != address(0), "!vault");
        _;
    }

    /**
     * @notice Reverts if the caller is not the harvester
     */
    modifier onlyHarvester() {
        require(msg.sender == manager.harvester(), "!harvester");
        _;
    }

    /**
     * @notice Reverts if the caller is not the MetaVault
     */
    modifier onlyMetaVault() {
        require(msg.sender == metavault, "!metavault");
        _;
    }

    /**
     * @notice Reverts if the caller is not the strategist
     */
    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
