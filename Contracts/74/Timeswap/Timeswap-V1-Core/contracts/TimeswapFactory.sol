// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IFactory} from './interfaces/IFactory.sol';
import {IPair} from './interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {TimeswapPair} from './TimeswapPair.sol';

/// @title Timeswap Factory
/// @author Timeswap Labs
/// @notice It is recommnded to use Timeswap Convenience to interact with this contract.
/// @notice All error messages are coded and can be found in the documentation.
contract TimeswapFactory is IFactory {
    /* ===== MODEL ===== */

    /// @inheritdoc IFactory
    address public override owner;
    /// @inheritdoc IFactory
    address public override pendingOwner;
    /// @inheritdoc IFactory
    uint16 public immutable override fee;
    /// @inheritdoc IFactory
    uint16 public immutable override protocolFee;

    /// @inheritdoc IFactory
    mapping(IERC20 => mapping(IERC20 => IPair)) public override getPair;

    /* ===== INIT ===== */

    /// @param _owner The chosen owner address.
    /// @param _fee The chosen fee rate.
    /// @param _protocolFee The chosen protocol fee rate.
    constructor(
        address _owner,
        uint16 _fee,
        uint16 _protocolFee
    ) {
        require(_owner != address(0), 'E101');
        owner = _owner;
        fee = _fee;
        protocolFee = _protocolFee;
    }

    /* ===== UPDATE ===== */

    /// @inheritdoc IFactory
    function createPair(IERC20 asset, IERC20 collateral) external override returns (IPair pair) {
        require(asset != collateral, 'E103');
        require(asset != IERC20(address(0)) && collateral != IERC20(address(0)), 'E101');
        require(getPair[asset][collateral] == IPair(address(0)), 'E104');

        pair = new TimeswapPair{salt: keccak256(abi.encode(asset, collateral))}(asset, collateral, fee, protocolFee);

        getPair[asset][collateral] = pair;

        emit CreatePair(asset, collateral, pair);
    }

    /// @inheritdoc IFactory
    function setOwner(address _pendingOwner) external override {
        require(msg.sender == owner, 'E102');
        require(_pendingOwner != address(0), 'E101');
        pendingOwner = _pendingOwner;

        emit SetOwner(_pendingOwner);
    }

    /// @inheritdoc IFactory
    function acceptOwner() external override {
        require(msg.sender == pendingOwner, 'E102');
        owner = msg.sender;

        emit AcceptOwner(msg.sender);
    }
}
