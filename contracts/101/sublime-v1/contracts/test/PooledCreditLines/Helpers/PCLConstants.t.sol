// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

library PCLConstants {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using SafeMath for uint128;

    uint256 public constant maxCollateralRatio = (10**18) * 200;
    uint256 public constant minCollateralRatio = (10**16);

    uint256 public constant maxDuration = 7500 days; // in days
    uint256 public constant minDuration = 1 days; // in days

    uint256 public constant maxDefaultGraceDuration = 3650 days; // in days
    uint256 public constant minDefaultGraceDuration = 1 days; // in days

    uint256 public constant maxGracePenaltyRate = 10e18 - 1;
    uint256 public constant minGracePenaltyRate = 1;

    uint256 public constant maxCollectionPeriod = 7500 days; // in days
    uint256 public constant minCollectionPeriod = 1 days; // in days

    uint256 public constant maxBorrowLimit = 1e15; // ($1,000,000,000)
    uint256 public constant minBorrowLimit = 1e10; //($10000)

    uint128 public constant maxBorrowRate = (10**18) * 200;
    uint128 public constant minBorrowRate = 10**16;

    address public constant hevmAddress = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D;

    uint256 public constant maxStrategies = 10;

    uint256 public constant protocolFeeFraction = 10e16;

    uint256 public constant startFeeFraction = 1e16;

    uint32 public constant uniswapPriceAveragingPeriod = 10;

    // Random addresses used as borrower/lender verifiers addresses
    address public constant _borrowerVerifier = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;
    address public constant _lenderVerifier = 0xDEADbEEfDeAdBeeFdeAdbeefDEADbEEFDeaDBeeC;
}
