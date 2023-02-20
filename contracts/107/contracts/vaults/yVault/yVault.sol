// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../../interfaces/IController.sol";
import "../../interfaces/IYVault.sol";

/// @title JPEG'd yVault
/// @notice Allows users to deposit fungible assets into autocompounding strategy contracts (e.g. {StrategyPUSDConvex}).
/// Non whitelisted contracts can't deposit/withdraw.
/// Owner is DAO
contract YVault is ERC20, Ownable {
    using SafeERC20 for ERC20;
    using Address for address;

    event Deposit(address indexed depositor, uint256 wantAmount);
    event Withdrawal(address indexed withdrawer, uint256 wantAmount);

    struct Rate {
        uint128 numerator;
        uint128 denominator;
    }

    ERC20 public immutable token;
    IController public controller;
    
    address public farm;
    
    Rate internal availableTokensRate;

    mapping(address => bool) public whitelistedContracts;

    /// @param _token The token managed by this vault
    /// @param _controller The JPEG'd strategies controller
    constructor(
        address _token,
        address _controller,
        Rate memory _availableTokensRate
    )
        ERC20(
            string(
                abi.encodePacked("JPEG\xE2\x80\x99d ", ERC20(_token).name())
            ),
            string(abi.encodePacked("JPEGD", ERC20(_token).symbol()))
        )
    {
        setController(_controller);
        setAvailableTokensRate(_availableTokensRate);
        token = ERC20(_token);
    }

    /// @dev Modifier that ensures that non-whitelisted contracts can't interact with the vault.
    /// Prevents non-whitelisted 3rd party contracts from diluting stakers.
    /// The {isContract} function returns false when `_account` is a contract executing constructor code.
    /// This may lead to some contracts being able to bypass this check.
    /// @param _account Address to check
    modifier noContract(address _account) {
        require(
            !_account.isContract() || whitelistedContracts[_account],
            "Contracts not allowed"
        );
        _;
    }

    /// @inheritdoc ERC20
    function decimals() public view virtual override returns (uint8) {
        return token.decimals();
    }

    /// @return The total amount of tokens managed by this vault and the underlying strategy
    function balance() public view returns (uint256) {
        return
            token.balanceOf(address(this)) +
            controller.balanceOf(address(token));
    }

    // @return The amount of JPEG tokens claimable by {YVaultLPFarming}
    function balanceOfJPEG() external view returns (uint256) {
        return controller.balanceOfJPEG(address(token));
    }

    /// @notice Allows the owner to whitelist/blacklist contracts
    /// @param _contract The contract address to whitelist/blacklist
    /// @param _isWhitelisted Whereter to whitelist or blacklist `_contract`
    function setContractWhitelisted(address _contract, bool _isWhitelisted)
        external
        onlyOwner
    {
        whitelistedContracts[_contract] = _isWhitelisted;
    }

    /// @notice Allows the owner to set the rate of tokens held by this contract that the underlying strategy should be able to borrow
    /// @param _rate The new rate
    function setAvailableTokensRate(Rate memory _rate) public onlyOwner {
        require(
            _rate.numerator > 0 && _rate.denominator >= _rate.numerator,
            "INVALID_RATE"
        );
        availableTokensRate = _rate;
    }

    /// @notice ALlows the owner to set this vault's controller
    /// @param _controller The new controller
    function setController(address _controller) public onlyOwner {
        require(_controller != address(0), "INVALID_CONTROLLER");
        controller = IController(_controller);
    }

    /// @notice Allows the owner to set the yVault LP farm
    /// @param _farm The new farm
    function setFarmingPool(address _farm) public onlyOwner {
        require(_farm != address(0), "INVALID_FARMING_POOL");
        farm = _farm;
    }

    /// @return How much the vault allows to be borrowed by the underlying strategy.
    /// Sets minimum required on-hand to keep small withdrawals cheap
    function available() public view returns (uint256) {
        return
            (token.balanceOf(address(this)) * availableTokensRate.numerator) /
            availableTokensRate.denominator;
    }

    /// @notice Deposits `token` into the underlying strategy
    function earn() external {
        uint256 _bal = available();
        token.safeTransfer(address(controller), _bal);
        controller.earn(address(token), _bal);
    }

    /// @notice Allows users to deposit their entire `token` balance
    function depositAll() external {
        deposit(token.balanceOf(msg.sender));
    }

    /// @notice Allows users to deposit `token`. Contracts can't call this function
    /// @param _amount The amount to deposit
    function deposit(uint256 _amount) public noContract(msg.sender) {
        require(_amount > 0, "INVALID_AMOUNT");
        uint256 balanceBefore = balance();
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 supply = totalSupply();
        uint256 shares;
        if (supply == 0) {
            shares = _amount;
        } else {
            //balanceBefore can't be 0 if totalSupply is > 0
            shares = (_amount * supply) / balanceBefore;
        }
        _mint(msg.sender, shares);

        emit Deposit(msg.sender, _amount);
    }

    /// @notice Allows users to withdraw all their deposited balance
    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    /// @notice Allows users to withdraw tokens. Contracts can't call this function
    /// @param _shares The amount of shares to burn
    function withdraw(uint256 _shares) public noContract(msg.sender) {
        require(_shares > 0, "INVALID_AMOUNT");

        uint256 supply = totalSupply();
        require(supply > 0, "NO_TOKENS_DEPOSITED");

        uint256 backingTokens = (balance() * _shares) / supply;
        _burn(msg.sender, _shares);

        // Check balance
        uint256 vaultBalance = token.balanceOf(address(this));
        if (vaultBalance < backingTokens) {
            uint256 toWithdraw = backingTokens - vaultBalance;
            controller.withdraw(address(token), toWithdraw);
        }

        token.safeTransfer(msg.sender, backingTokens);
        emit Withdrawal(msg.sender, backingTokens);
    }

    /// @notice Allows anyone to withdraw JPEG to `farm` 
    function withdrawJPEG() external {
        require(farm != address(0), "NO_FARM");
        controller.withdrawJPEG(address(token), farm);
    }

    /// @return The underlying tokens per share
    function getPricePerFullShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (balance() * 1e18) / supply;
    }

    /// @dev Prevent the owner from renouncing ownership. Having no owner would render this contract unusable due to the inability to create new epochs
    function renounceOwnership() public view override onlyOwner {
        revert("Cannot renounce ownership");
    }
}
