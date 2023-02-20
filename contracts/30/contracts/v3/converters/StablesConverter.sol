// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IConverter.sol";
import "../interfaces/IManager.sol";
import "../interfaces/ICurve3Pool.sol";

/**
 * @title StablesConverter
 */
contract StablesConverter is IConverter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IManager public immutable override manager;
    ICurve3Pool public immutable stableSwap3Pool;
    IERC20 public immutable token3CRV; // 3Crv

    IERC20[3] public tokens; // DAI, USDC, USDT

    mapping(address => int128) internal indices;

    /**
     * @param _tokenDAI The address of the DAI token
     * @param _tokenUSDC The address of the USDC token
     * @param _tokenUSDT The address of the USDT token
     * @param _token3CRV The address of the 3CRV token
     * @param _stableSwap3Pool The address of 3Pool
     * @param _manager The address of the Vault Manager
     */
    constructor(
        IERC20 _tokenDAI,
        IERC20 _tokenUSDC,
        IERC20 _tokenUSDT,
        IERC20 _token3CRV,
        ICurve3Pool _stableSwap3Pool,
        IManager _manager
    ) public {
        tokens[0] = _tokenDAI;
        tokens[1] = _tokenUSDC;
        tokens[2] = _tokenUSDT;
        indices[address(_tokenDAI)] = 0;
        indices[address(_tokenUSDC)] = 1;
        indices[address(_tokenUSDT)] = 2;
        token3CRV = _token3CRV;
        stableSwap3Pool = _stableSwap3Pool;
        tokens[0].safeApprove(address(_stableSwap3Pool), type(uint256).max);
        tokens[1].safeApprove(address(_stableSwap3Pool), type(uint256).max);
        tokens[2].safeApprove(address(_stableSwap3Pool), type(uint256).max);
        _token3CRV.safeApprove(address(_stableSwap3Pool), type(uint256).max);
        manager = _manager;
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    /**
     * @notice Called by the strategist to approve a token address to be spent by an address
     * @param _token The address of the token
     * @param _spender The address of the spender
     * @param _amount The amount to spend
     */
    function approveForSpender(
        IERC20 _token,
        address _spender,
        uint256 _amount
    )
        external
        onlyStrategist
    {
        _token.safeApprove(_spender, 0);
        _token.safeApprove(_spender, _amount);
    }

    /**
     * @notice Allows the strategist to withdraw tokens from the converter
     * @dev This contract should never have any tokens in it at the end of a transaction
     * @param _token The address of the token
     * @param _amount The amount to withdraw
     * @param _to The address to receive the tokens
     */
    function recoverUnsupported(
        IERC20 _token,
        uint256 _amount,
        address _to
    )
        external
        onlyStrategist
    {
        _token.safeTransfer(_to, _amount);
    }

    /**
     * AUTHORIZED-ONLY FUNCTIONS
     */

    /**
     * @notice Converts the amount of input tokens to output tokens
     * @param _input The address of the token being converted
     * @param _output The address of the token to be converted to
     * @param _inputAmount The input amount of tokens that are being converted
     * @param _estimatedOutput The estimated output tokens after converting
     */
    function convert(
        address _input,
        address _output,
        uint256 _inputAmount,
        uint256 _estimatedOutput
    )
        external
        override
        onlyAuthorized
        returns (uint256 _outputAmount)
    {
        if (_output == address(token3CRV)) { // convert to 3CRV
            uint256[3] memory amounts;
            for (uint8 i = 0; i < 3; i++) {
                if (_input == address(tokens[i])) {
                    amounts[i] = _inputAmount;
                    uint256 _before = token3CRV.balanceOf(address(this));
                    stableSwap3Pool.add_liquidity(amounts, _estimatedOutput);
                    uint256 _after = token3CRV.balanceOf(address(this));
                    _outputAmount = _after.sub(_before);
                    token3CRV.safeTransfer(msg.sender, _outputAmount);
                    return _outputAmount;
                }
            }
        } else if (_input == address(token3CRV)) { // convert from 3CRV
            // A temporary cache, used to save gas.
            IERC20 _token;
            for (uint8 i = 0; i < 3; i++) {
                _token = tokens[i];
                if (_output == address(_token) {
                    uint256 _before = _token.balanceOf(address(this));
                    stableSwap3Pool.remove_liquidity_one_coin(
                        _inputAmount,
                        i,
                        _estimatedOutput
                    );
                    uint256 _after = _token.balanceOf(address(this));
                    _outputAmount = _after.sub(_before);
                    _token.safeTransfer(msg.sender, _outputAmount);
                    return _outputAmount;
                }
            }
        } else {
            stableSwap3Pool.exchange(
                indices[_input],
                indices[_output],
                _inputAmount,
                _estimatedOutput
            );
            _outputAmount = IERC20(_output).balanceOf(address(this));
            IERC20(_output).safeTransfer(msg.sender, _outputAmount);
            return _outputAmount;
        }
        return 0;
    }

    /**
     * @notice Checks the amount of input tokens to output tokens
     * @param _input The address of the token being converted
     * @param _output The address of the token to be converted to
     * @param _inputAmount The input amount of tokens that are being converted
     */
    function expected(
        address _input,
        address _output,
        uint256 _inputAmount
    )
        external
        override
        view
        returns (uint256)
    {
        if (_output == address(token3CRV)) { // convert to 3CRV
            uint256[3] memory amounts;
            for (uint8 i = 0; i < 3; i++) {
                if (_input == address(tokens[i])) {
                    amounts[i] = _inputAmount;
                    return stableSwap3Pool.calc_token_amount(amounts, true);
                }
            }
        } else if (_input == address(token3CRV)) { // convert from 3CRV
            for (uint8 i = 0; i < 3; i++) {
                if (_output == address(tokens[i])) {
                    // @dev this is for UI reference only, the actual share price
                    // (stable/CRV) will be re-calculated on-chain when we do convert()
                    return stableSwap3Pool.calc_withdraw_one_coin(_inputAmount, i);
                }
            }
        } else {
            return stableSwap3Pool.get_dy(indices[_input], indices[_output], _inputAmount);
        }
        return 0;
    }

    /**
     * MODIFIERS
     */

    /**
     * @dev Throws if not called by an allowed vault, controller, or strategy
     */
    modifier onlyAuthorized() {
        require(manager.allowedVaults(msg.sender)
            || manager.allowedControllers(msg.sender)
            || manager.allowedStrategies(msg.sender),
            "!authorized"
        );
        _;
    }

    /**
     * @dev Throws if not called by the strategist
     */
    modifier onlyStrategist {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
