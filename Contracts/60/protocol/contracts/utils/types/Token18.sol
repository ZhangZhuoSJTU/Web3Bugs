// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./UFixed18.sol";

/// @dev Token18
type Token18 is address;

/**
 * @title Token18Lib
 * @notice Library to manager Ether and ERC20s that is compliant with the fixed-decimal types.
 * @dev Normalizes token operations with Ether operations (using a magic Ether address).
 */
library Token18Lib {
    using UFixed18Lib for UFixed18;
    using Address for address;
    using SafeERC20 for IERC20;

    error Token18PullEtherError();

    Token18 public constant ETHER = Token18.wrap(address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));

    /**
     * @notice Returns whether a token is the Ether address
     * @param self Token to check for
     * @return Whether the token is Ether
     */
    function isEther(Token18 self) internal pure returns (bool) {
        return Token18.unwrap(self) == Token18.unwrap(ETHER);
    }

    /**
     * @notice Transfers all held tokens from the caller to the `recipient`
     * @param self Token to transfer
     * @param recipient Address to receive the tokens
     */
    function push(Token18 self, address recipient) internal {
        push(self, recipient, balanceOf(self, address(this)));
    }

    /**
     * @notice Transfers `amount` tokens from the caller to the `recipient`
     * @param self Token to transfer
     * @param recipient Address to transfer tokens to
     * @param amount Amount of tokens to transfer
     */
    function push(
        Token18 self,
        address recipient,
        UFixed18 amount
    ) internal {
        isEther(self)
            ? Address.sendValue(payable(recipient), toTokenAmount(self, amount))
            : IERC20(Token18.unwrap(self)).safeTransfer(recipient, toTokenAmount(self, amount));
    }

    /**
     * @notice Transfers `amount` tokens from the `benefactor` to the caller
     * @dev Reverts if trying to pull Ether
     * @param self Token to transfer
     * @param benefactor Address to transfer tokens from
     * @param amount Amount of tokens to transfer
     */
    function pull(
        Token18 self,
        address benefactor,
        UFixed18 amount
    ) internal {
        if (isEther(self)) revert Token18PullEtherError();
        IERC20(Token18.unwrap(self)).safeTransferFrom(benefactor, address(this), toTokenAmount(self, amount));
    }

    /**
     * @notice Transfers `amount` tokens from the `benefactor` to `recipient`
     * @dev Reverts if trying to pull Ether
     * @param self Token to transfer
     * @param benefactor Address to transfer tokens from
     * @param recipient Address to transfer tokens to
     * @param amount Amount of tokens to transfer
     */
    function pullTo(
        Token18 self,
        address benefactor,
        address recipient,
        UFixed18 amount
    ) internal {
        if (isEther(self)) revert Token18PullEtherError();
        IERC20(Token18.unwrap(self)).safeTransferFrom(benefactor, recipient, toTokenAmount(self, amount));
    }

    /**
     * @notice Returns the name of the token
     * @param self Token to check for
     * @return Token name
     */
    function name(Token18 self) internal view returns (string memory) {
        return isEther(self) ? "Ether" : IERC20Metadata(Token18.unwrap(self)).name();
    }

    /**
     * @notice Returns the symbol of the token
     * @param self Token to check for
     * @return Token symbol
     */
    function symbol(Token18 self) internal view returns (string memory) {
        return isEther(self) ? "ETH" : IERC20Metadata(Token18.unwrap(self)).symbol();
    }

    /**
     * @notice Returns the decimals of the token
     * @param self Token to check for
     * @return Token decimals
     */
    function decimals(Token18 self) internal view returns (uint8) {
        return isEther(self) ? 18 : IERC20Metadata(Token18.unwrap(self)).decimals();
    }

    /**
     * @notice Returns the `self` token balance of the caller
     * @param self Token to check for
     * @return Token balance of the caller
     */
    function balanceOf(Token18 self) internal view returns (UFixed18) {
        return balanceOf(self, address(this));
    }

    /**
     * @notice Returns the `self` token balance of `account`
     * @param self Token to check for
     * @param account Account to check
     * @return Token balance of the account
     */
    function balanceOf(Token18 self, address account) internal view returns (UFixed18) {
        uint256 tokenAmount = isEther(self) ?
            account.balance :
            IERC20(Token18.unwrap(self)).balanceOf(account);
        return fromTokenAmount(self, tokenAmount);
    }

    /**
     * @notice Converts the unsigned fixed-decimal amount into the token amount according to
     *         it's defined decimals
     * @param self Token to check for
     * @param amount Amount to convert
     * @return Normalized token amount
     */
    function toTokenAmount(Token18 self, UFixed18 amount) private view returns (uint256) {
        UFixed18 conversion = UFixed18Lib.ratio(10 ** uint256(decimals(self)), 10 ** 18);
        return UFixed18.unwrap(amount.mul(conversion));
    }

    /**
     * @notice Converts the token amount into the unsigned fixed-decimal amount according to
     *         it's defined decimals
     * @param self Token to check for
     * @param amount Token amount to convert
     * @return Normalized unsigned fixed-decimal amount
     */
    function fromTokenAmount(Token18 self, uint256 amount) private view returns (UFixed18) {
        UFixed18 conversion = UFixed18Lib.ratio(10 ** 18, 10 ** uint256(decimals(self)));
        return UFixed18.wrap(amount).mul(conversion);
    }
}