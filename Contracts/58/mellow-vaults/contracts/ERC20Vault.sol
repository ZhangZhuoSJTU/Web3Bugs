// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./trader/interfaces/IChiefTrader.sol";
import "./trader/interfaces/ITrader.sol";
import "./interfaces/IERC20VaultGovernance.sol";
import "./Vault.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Vault that stores ERC20 tokens.
contract ERC20Vault is Vault, ITrader {
    /// @notice Creates a new contract.
    /// @param vaultGovernance_ Reference to VaultGovernance for this vault
    /// @param vaultTokens_ ERC20 tokens under Vault management
    constructor(IVaultGovernance vaultGovernance_, address[] memory vaultTokens_)
        Vault(vaultGovernance_, vaultTokens_)
    {}

    /// @inheritdoc Vault
    function tvl() public view override returns (uint256[] memory tokenAmounts) {
        address[] memory tokens = _vaultTokens;
        tokenAmounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            tokenAmounts[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }

    /// @inheritdoc ITrader
    function swapExactInput(
        uint256 traderId,
        uint256 amount,
        address,
        PathItem[] memory path,
        bytes memory options
    ) external returns (uint256 amountOut) {
        require(
            path.length > 0  && isVaultToken(path[path.length - 1].token1), 
            ExceptionsLibrary.NOT_VAULT_TOKEN
        );
        require(_isStrategy(msg.sender), ExceptionsLibrary.NOT_STRATEGY_TREASURY);
        IERC20VaultGovernance vg = IERC20VaultGovernance(address(_vaultGovernance));
        ITrader trader = ITrader(vg.delayedProtocolParams().trader);
        IChiefTrader chiefTrader = IChiefTrader(address(trader));
        _approveERC20TokenIfNecessary(path[0].token0, chiefTrader.getTrader(traderId));
        return trader.swapExactInput(traderId, amount, address(0), path, options);
    }

    /// @inheritdoc ITrader
    function swapExactOutput(
        uint256 traderId,
        uint256 amount,
        address,
        PathItem[] memory path,
        bytes calldata options
    ) external returns (uint256 amountOut) {
        require(
            path.length > 0  && isVaultToken(path[path.length - 1].token1), 
            ExceptionsLibrary.NOT_VAULT_TOKEN
        );
        require(_isStrategy(msg.sender), ExceptionsLibrary.NOT_STRATEGY_TREASURY);
        IERC20VaultGovernance vg = IERC20VaultGovernance(address(_vaultGovernance));
        ITrader trader = ITrader(vg.delayedProtocolParams().trader);
        IChiefTrader chiefTrader = IChiefTrader(address(trader));
        _approveERC20TokenIfNecessary(path[0].token0, chiefTrader.getTrader(traderId));
        return trader.swapExactOutput(traderId, amount, address(0), path, options);
    }

    function _push(uint256[] memory tokenAmounts, bytes memory)
        internal
        pure
        override
        returns (uint256[] memory actualTokenAmounts)
    {
        // no-op, tokens are already on balance
        return tokenAmounts;
    }

    function _pull(
        address to,
        uint256[] memory tokenAmounts,
        bytes memory
    ) internal override returns (uint256[] memory actualTokenAmounts) {
        for (uint256 i = 0; i < tokenAmounts.length; i++) {
            IERC20(_vaultTokens[i]).transfer(to, tokenAmounts[i]);
        }
        actualTokenAmounts = tokenAmounts;
    }

    function _postReclaimTokens(address, address[] memory tokens) internal view override {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(!isVaultToken(tokens[i]), ExceptionsLibrary.OTHER_VAULT_TOKENS); // vault token is part of TVL
        }
    }

    function _isStrategy(address addr) internal view returns (bool) {
        return _vaultGovernance.internalParams().registry.getApproved(_nft) == addr;
    }

    function _approveERC20TokenIfNecessary(address token, address to) internal {
        if (IERC20(token).allowance(to, address(this)) < type(uint256).max / 2)
            IERC20(token).approve(to, type(uint256).max);
    }
}
