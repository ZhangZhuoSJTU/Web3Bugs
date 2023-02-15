// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/external/IWETH.sol";

/// @title Manage the fees between shareholders
/// @notice Receives fees collected by the NestedFactory, and splits the income among
/// shareholders (the NFT owners, Nested treasury and a NST buybacker contract).
contract FeeSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Emitted when a payment is released
    /// @param to The address receiving the payment
    /// @param token The token transfered
    /// @param amount The amount paid
    event PaymentReleased(address to, address token, uint256 amount);

    /// @dev Emitted when a payment is released
    /// @param from The address sending the tokens
    /// @param token The token received
    /// @param amount The amount received
    event PaymentReceived(address from, address token, uint256 amount);

    /// @dev Represent a shareholder
    /// @param account Shareholders address that can receive income
    /// @param weight Determines share allocation
    struct Shareholder {
        address account;
        uint256 weight;
    }

    /// @dev Registers shares and amount release for a specific token or ETH
    struct TokenRecords {
        uint256 totalShares;
        uint256 totalReleased;
        mapping(address => uint256) shares;
        mapping(address => uint256) released;
    }

    /// @dev Map of tokens with the tokenRecords
    mapping(address => TokenRecords) private tokenRecords;

    /// @dev All the shareholders (array)
    Shareholder[] private shareholders;

    /// @dev Royalties part weights when applicable
    uint256 public royaltiesWeight;

    uint256 public totalWeights;

    address public immutable weth;

    constructor(
        address[] memory _accounts,
        uint256[] memory _weights,
        uint256 _royaltiesWeight,
        address _weth
    ) {
        // Initial shareholders addresses and weights
        setShareholders(_accounts, _weights);
        setRoyaltiesWeight(_royaltiesWeight);
        weth = _weth;
    }

    /// @dev Receive ether after a WETH withdraw call
    receive() external payable {
        require(_msgSender() == weth, "FeeSplitter: ETH_SENDER_NOT_WETH");
    }

    /// @notice Returns the amount due to an account. Call releaseToken to withdraw the amount.
    /// @param _account Account address to check the amount due for
    /// @param _token ERC20 payment token address (or ETH_ADDR)
    /// @return The total amount due for the requested currency
    function getAmountDue(address _account, IERC20 _token) public view returns (uint256) {
        TokenRecords storage _tokenRecords = tokenRecords[address(_token)];
        uint256 totalReceived = _tokenRecords.totalReleased;
        if (_tokenRecords.totalShares == 0) return 0;
        else totalReceived += _token.balanceOf(address(this));
        uint256 amountDue = (totalReceived * _tokenRecords.shares[_account]) /
            _tokenRecords.totalShares -
            _tokenRecords.released[_account];
        return amountDue;
    }

    /// @notice Sets the weight assigned to the royalties part for the fee
    /// @param _weight The new royalties weight
    function setRoyaltiesWeight(uint256 _weight) public onlyOwner {
        totalWeights -= royaltiesWeight;
        royaltiesWeight = _weight;
        totalWeights += _weight;
    }

    /// @notice Sets a new list of shareholders
    /// @param _accounts Shareholders accounts list
    /// @param _weights Weight for each shareholder. Determines part of the payment allocated to them
    function setShareholders(address[] memory _accounts, uint256[] memory _weights) public onlyOwner {
        delete shareholders;
        require(_accounts.length > 0 && _accounts.length == _weights.length, "FeeSplitter: ARRAY_LENGTHS_ERR");
        totalWeights = royaltiesWeight;

        for (uint256 i = 0; i < _accounts.length; i++) {
            _addShareholder(_accounts[i], _weights[i]);
        }
    }

    /// @notice Triggers a transfer to `msg.sender` of the amount of token they are owed, according to
    /// the amount of shares they own and their previous withdrawals.
    /// @param _token Payment token address
    function releaseToken(IERC20 _token) public nonReentrant {
        uint256 amount = _releaseToken(_msgSender(), _token);
        _token.safeTransfer(_msgSender(), amount);
        emit PaymentReleased(_msgSender(), address(_token), amount);
    }

    /// @notice Call releaseToken() for multiple tokens
    /// @param _tokens ERC20 tokens to release
    function releaseTokens(IERC20[] memory _tokens) external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            releaseToken(_tokens[i]);
        }
    }

    /// @dev Triggers a transfer to `msg.sender` of the amount of Ether they are owed, according to
    /// the amount of shares they own and their previous withdrawals.
    function releaseETH() external nonReentrant {
        uint256 amount = _releaseToken(_msgSender(), IERC20(weth));
        IWETH(weth).withdraw(amount);
        (bool success, ) = _msgSender().call{ value: amount }("");
        require(success, "FeeSplitter: ETH_TRANFER_ERROR");
        emit PaymentReleased(_msgSender(), ETH, amount);
    }

    /// @notice Sends a fee to this contract for splitting, as an ERC20 token. No royalties are expected.
    /// @param _token Currency for the fee as an ERC20 token
    /// @param _amount Amount of token as fee to be claimed by this contract
    function sendFees(IERC20 _token, uint256 _amount) external nonReentrant {
        uint256 weights = totalWeights - royaltiesWeight;
        _sendFees(_token, _amount, weights);
    }

    /// @notice Sends a fee to this contract for splitting, as an ERC20 token
    /// @param _royaltiesTarget The account that can claim royalties
    /// @param _token Currency for the fee as an ERC20 token
    /// @param _amount Amount of token as fee to be claimed by this contract
    function sendFeesWithRoyalties(
        address _royaltiesTarget,
        IERC20 _token,
        uint256 _amount
    ) external nonReentrant {
        require(_royaltiesTarget != address(0), "FeeSplitter: INVALID_ROYALTIES_TARGET_ADDRESS");

        _sendFees(_token, _amount, totalWeights);
        _addShares(_royaltiesTarget, _computeShareCount(_amount, royaltiesWeight, totalWeights), address(_token));
    }

    /// @notice Updates weight for a shareholder
    /// @param _accountIndex Account to change the weight of
    /// @param _weight The new weight
    function updateShareholder(uint256 _accountIndex, uint256 _weight) external onlyOwner {
        require(_accountIndex + 1 <= shareholders.length, "FeeSplitter: INVALID_ACCOUNT_INDEX");
        uint256 _totalWeights = totalWeights;
        _totalWeights -= shareholders[_accountIndex].weight;
        shareholders[_accountIndex].weight = _weight;
        _totalWeights += _weight;
        require(_totalWeights > 0, "FeeSplitter: TOTAL_WEIGHTS_ZERO");
        totalWeights = _totalWeights;
    }

    /// @notice Getter for the total shares held by shareholders.
    /// @param _token Payment token address, use ETH_ADDR for ETH
    /// @return The total shares count
    function totalShares(address _token) external view returns (uint256) {
        return tokenRecords[_token].totalShares;
    }

    /// @notice Getter for the total amount of token already released.
    /// @param _token Payment token address, use ETH_ADDR for ETH
    /// @return The total amount release to shareholders
    function totalReleased(address _token) external view returns (uint256) {
        return tokenRecords[_token].totalReleased;
    }

    /// @notice Getter for the amount of shares held by an account.
    /// @param _account Account the shares belong to
    /// @param _token Payment token address, use ETH_ADDR for ETH
    /// @return The shares owned by the account
    function shares(address _account, address _token) external view returns (uint256) {
        return tokenRecords[_token].shares[_account];
    }

    /// @notice Getter for the amount of Ether already released to a shareholders.
    /// @param _account The target account for this request
    /// @param _token Payment token address, use ETH_ADDR for ETH
    /// @return The amount already released to this account
    function released(address _account, address _token) external view returns (uint256) {
        return tokenRecords[_token].released[_account];
    }

    /// @notice Finds a shareholder and return its index
    /// @param _account Account to find
    /// @return The shareholder index in the storage array
    function findShareholder(address _account) external view returns (uint256) {
        for (uint256 i = 0; i < shareholders.length; i++) {
            if (shareholders[i].account == _account) return i;
        }
        revert("FeeSplitter: NOT_FOUND");
    }

    /// @dev Transfers a fee to this contract
    /// @param _token Currency for the fee
    /// @param _amount Amount of token as fee
    /// @param _totalWeights Total weights to determine the share count to allocate
    function _sendFees(
        IERC20 _token,
        uint256 _amount,
        uint256 _totalWeights
    ) private {
        IERC20(_token).safeTransferFrom(_msgSender(), address(this), _amount);

        for (uint256 i = 0; i < shareholders.length; i++) {
            _addShares(
                shareholders[i].account,
                _computeShareCount(_amount, shareholders[i].weight, _totalWeights),
                address(_token)
            );
        }
        emit PaymentReceived(_msgSender(), address(_token), _amount);
    }

    /// @dev Increase the shares of a shareholder
    /// @param _account The shareholder address
    /// @param _shares The shares of the holder
    /// @param _token The updated token
    function _addShares(
        address _account,
        uint256 _shares,
        address _token
    ) private {
        TokenRecords storage _tokenRecords = tokenRecords[_token];
        _tokenRecords.shares[_account] += _shares;
        _tokenRecords.totalShares = _tokenRecords.totalShares + _shares;
    }

    function _releaseToken(address _account, IERC20 _token) private returns (uint256) {
        TokenRecords storage _tokenRecords = tokenRecords[address(_token)];
        uint256 amountToRelease = getAmountDue(_account, _token);
        require(amountToRelease != 0, "FeeSplitter: NO_PAYMENT_DUE");

        _tokenRecords.released[_account] = _tokenRecords.released[_account] + amountToRelease;
        _tokenRecords.totalReleased = _tokenRecords.totalReleased + amountToRelease;

        return amountToRelease;
    }

    function _addShareholder(address _account, uint256 _weight) private {
        require(_weight > 0, "FeeSplitter: ZERO_WEIGHT");
        shareholders.push(Shareholder(_account, _weight));
        totalWeights += _weight;
    }

    function _computeShareCount(
        uint256 _amount,
        uint256 _weight,
        uint256 _totalWeights
    ) private pure returns (uint256) {
        return (_amount * _weight) / _totalWeights;
    }
}
