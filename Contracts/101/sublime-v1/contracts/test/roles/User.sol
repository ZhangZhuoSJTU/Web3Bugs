// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../../SavingsAccount/SavingsAccount.sol';
import '../../interfaces/IYield.sol';
import '../../yield/CompoundYield.sol';
import '../../yield/NoYield.sol';
import '../../PriceOracle.sol';
import '../../interfaces/IPooledCreditLineDeclarations.sol';
import '../../interfaces/ILenderPool.sol';
import '../../PooledCreditLine/PooledCreditLine.sol';
import '../../PooledCreditLine/LenderPool.sol';
import '../../mocks/MockToken.sol';
import '../../Verification/twitterVerifier.sol';
import '../../Verification/adminVerifier.sol';
import '../../Verification/Verification.sol';

import '@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract User is IERC1155ReceiverUpgradeable, IPooledCreditLineDeclarations {
    using SafeERC20 for IERC20;

    /******************************************************************************
     ******* Savings account specific functions ***********************************
     ******************************************************************************/

    function depositToSavingsAccount(
        address savingsAccount,
        uint256 _amount,
        address _token,
        address _strategy,
        address _to
    ) public {
        SavingsAccount(savingsAccount).deposit(_token, _strategy, _to, _amount);
    }

    function switchStrategyInSavingsAccount(
        address savingsAccount,
        address _currentStrategy,
        address _newStrategy,
        address _token,
        uint256 _amount
    ) public {
        SavingsAccount(savingsAccount).switchStrategy(_currentStrategy, _newStrategy, _token, _amount);
    }

    function approveToSavingsAccount(
        address savingsAccount,
        address _token,
        address _to,
        uint256 _amount
    ) public {
        SavingsAccount(savingsAccount).approve(_token, _to, _amount);
    }

    function withdrawFromSavingsAccount(
        address savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount,
        bool _receiveShares
    ) public {
        SavingsAccount(savingsAccount).withdrawFrom(_token, _strategy, _from, _to, _amount, _receiveShares);
    }

    function withdrawAllSavingsAccount(address savingsAccount, address _token) public {
        SavingsAccount(savingsAccount).withdrawAll(_token);
    }

    function withdrawAllTokenFromStrategySavingsAccount(
        address savingsAccount,
        address _token,
        address _strategy
    ) public {
        SavingsAccount(savingsAccount).withdrawAll(_token, _strategy);
    }

    function transferFromSavingsAccount(
        address savingsAccount,
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount
    ) public {
        SavingsAccount(savingsAccount).transferFrom(_token, _strategy, _from, _to, _amount);
    }

    function transferSavingsAccount(
        address savingsAccount,
        address _token,
        address _strategy,
        address _to,
        uint256 _amount
    ) public {
        SavingsAccount(savingsAccount).transfer(_token, _strategy, _to, _amount);
    }

    function lockTokensForCompoundYield(
        address payable yield,
        address user,
        address asset,
        uint256 amount
    ) public {
        CompoundYield(yield).lockTokens(user, asset, amount);
    }

    function unlockTokensForCompoundYield(
        address payable yield,
        address asset,
        address to,
        uint256 amount
    ) public {
        CompoundYield(yield).unlockTokens(asset, to, amount);
    }

    function lockTokensForNoYield(
        address yield,
        address user,
        address asset,
        uint256 amount
    ) public {
        NoYield(yield).lockTokens(user, asset, amount);
    }

    function unlockTokensForNoYield(
        address yield,
        address asset,
        address to,
        uint256 amount
    ) public {
        NoYield(yield).unlockTokens(asset, to, amount);
    }

    function setAllowanceForSavingsAccount(
        address savingsAccountAddress,
        uint256 amount,
        address token,
        address spender
    ) public {
        ISavingsAccount savingsAccount = ISavingsAccount(savingsAccountAddress);

        savingsAccount.approve(token, spender, amount);
    }

    function savingsAccountWithdraw(
        address savingsAccountAddress,
        address _token,
        address _strategy,
        address _to,
        uint256 _amount,
        bool _receiveShares
    ) public {
        ISavingsAccount savingsAccount = ISavingsAccount(savingsAccountAddress);

        savingsAccount.withdraw(_token, _strategy, _to, _amount, _receiveShares);
    }

    /*****************************************************************************
     ******* END of Savings account specific functions ****************************
     ******************************************************************************/

    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) public {
        IERC20(token).safeApprove(spender, 0);
        IERC20(token).safeApprove(spender, amount);
    }

    // ----- ierc receiver implmentation --------//
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external virtual override returns (bytes4) {
        return bytes4(keccak256('onERC1155Received(address,address,uint256,uint256,bytes)'));
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return bytes4(keccak256('onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)'));
    }

    function supportsInterface(bytes4) external pure override returns (bool) {
        return true;
    }

    /*****************************************************************************
     ******* Start of twitter verifier specific functions ****************************
     ******************************************************************************/

    function registerUserUsingTwitterVerifier(
        TwitterVerifier twitterVerifier,
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _twitterId,
        string memory _tweetId,
        uint256 _timestamp
    ) public {
        twitterVerifier.registerSelf(_isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp);
    }

    function unregisterUserFromTwitterVerifier(TwitterVerifier twitterVerifier) public {
        twitterVerifier.unregisterSelf();
    }

    /*****************************************************************************
     ******* END of twitter verifier specific functions ****************************
     ******************************************************************************/

    /*****************************************************************************
     ******* Strat of admin verifier specific functions ****************************
     ******************************************************************************/

    function registerUserUsingAdminVerifier(
        AdminVerifier adminVerifier,
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _userData,
        uint256 _timestamp
    ) public {
        adminVerifier.registerSelf(_isMasterLinked, _v, _r, _s, _userData, _timestamp);
    }

    function unregisterUserFromAdminVerifier(AdminVerifier adminVerifier) public {
        adminVerifier.unregisterSelf();
    }

    /*****************************************************************************
     ******* END of admin verifier specific functions ****************************
     ******************************************************************************/

    /********************************************************************************************************************************
    Generic User functions. Callable by anyone. Mostly view function. Written to avoid stack too deep in test contracts
    *********************************************************************************************************************************/

    function fetchCreditLineVariable(
        address pooledCreditLineAddress,
        uint256 pooledCreditLineID,
        string memory variable
    ) public view returns (uint256) {
        PooledCreditLine pooledCreditLine = PooledCreditLine(pooledCreditLineAddress);
        (
            ,
            uint256 creditLineVariablePrincipal,
            uint256 creditLineVariableTotalInterestRepaid,
            uint256 creditLineVariableLastPrincipalUpdateTime,
            uint256 creditLineVariableInterestAccruedTillLastPrincipalUpdate
        ) = pooledCreditLine.pooledCreditLineVariables(pooledCreditLineID);
        if (keccak256(abi.encodePacked(variable)) == keccak256(abi.encodePacked('principal'))) {
            return creditLineVariablePrincipal;
        } else if (keccak256(abi.encodePacked(variable)) == keccak256(abi.encodePacked('totalInterestRepaid'))) {
            return creditLineVariableTotalInterestRepaid;
        } else if (keccak256(abi.encodePacked(variable)) == keccak256(abi.encodePacked('lastPrincipalUpdateTime'))) {
            return creditLineVariableLastPrincipalUpdateTime;
        } else if (keccak256(abi.encodePacked(variable)) == keccak256(abi.encodePacked('interestAccruedTillLastPrincipalUpdate'))) {
            return creditLineVariableInterestAccruedTillLastPrincipalUpdate;
        } else {
            revert('Incorrect credit line variable entered');
        }
    }

    function setAllowance(
        address approvedAddress,
        address token,
        uint256 amount
    ) public {
        IERC20(token).approve(approvedAddress, amount);
    }

    function increaseAllowance(
        address approvedAddress,
        address token,
        uint256 amount
    ) public {
        ERC20(token).increaseAllowance(approvedAddress, amount);
    }

    function requestAddressLinkingInVerifier(Verification verification, address _linkedAddress) public {
        verification.requestAddressLinking(_linkedAddress);
    }

    function cancelAddressLinkingRequestInVerification(Verification verification, address _linkedAddress) public {
        verification.cancelAddressLinkingRequest(_linkedAddress);
    }

    function linkAddressInVerification(Verification verification, address _masterAddress) public {
        verification.linkAddress(_masterAddress);
    }

    function unlinkAddressInVerification(Verification verification, address _linkedAddress) public {
        verification.unlinkAddress(_linkedAddress);
    }
}
