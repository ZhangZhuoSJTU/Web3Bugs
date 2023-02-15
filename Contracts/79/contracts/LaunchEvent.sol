// SPDX-License-Identifier: None
// Copyright (c) 2022 Trader Joe - All rights reserved

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./interfaces/IJoeFactory.sol";
import "./interfaces/IJoePair.sol";
import "./interfaces/IJoeRouter02.sol";
import "./interfaces/IRocketJoeFactory.sol";
import "./interfaces/IRocketJoeToken.sol";
import "./interfaces/IWAVAX.sol";

/// @title Rocket Joe Launch Event
/// @author Trader Joe
/// @notice A liquidity launch contract enabling price discovery and token distribution at secondary market listing price
contract LaunchEvent is Ownable {
    /// @notice The phases the launch event can be in
    /// @dev Should these have more semantic names: Bid, Cancel, Withdraw
    enum Phase {
        NotStarted,
        PhaseOne,
        PhaseTwo,
        PhaseThree
    }

    struct UserInfo {
        /// @notice How much AVAX user can deposit for this launch event
        /// @dev Can be increased by burning more rJOE, but will always be
        /// smaller than `maxAllocation`
        uint256 allocation;
        /// @notice How much AVAX user has deposited for this launch event
        uint256 balance;
        /// @notice Whether user has withdrawn the LP
        bool hasWithdrawnPair;
        /// @notice Whether user has withdrawn the issuing token incentives
        bool hasWithdrawnIncentives;
    }

    /// @notice Issuer of sale tokens
    address public issuer;

    /// @notice The start time of phase 1
    uint256 public auctionStart;

    uint256 public PHASE_ONE_DURATION;
    uint256 public PHASE_ONE_NO_FEE_DURATION;
    uint256 public PHASE_TWO_DURATION;

    /// @dev Amount of tokens used as incentives for locking up LPs during phase 3,
    /// in parts per 1e18 and expressed as an additional percentage to the tokens for auction.
    /// E.g. if tokenIncentivesPercent = 5e16 (5%), and issuer sends 105 000 tokens,
    /// then 105 000 * 1e18 / (1e18 + 5e16) = 5 000 tokens are used for incentives
    uint256 public tokenIncentivesPercent;

    /// @notice Floor price in AVAX per token (can be 0)
    /// @dev floorPrice is scaled to 1e18
    uint256 public floorPrice;

    /// @notice Timelock duration post phase 3 when can user withdraw their LP tokens
    uint256 public userTimelock;

    /// @notice Timelock duration post phase 3 When can issuer withdraw their LP tokens
    uint256 public issuerTimelock;

    /// @notice The max withdraw penalty during phase 1, in parts per 1e18
    /// e.g. max penalty of 50% `maxWithdrawPenalty`= 5e17
    uint256 public maxWithdrawPenalty;

    /// @notice The fixed withdraw penalty during phase 2, in parts per 1e18
    /// e.g. fixed penalty of 20% `fixedWithdrawPenalty = 2e17`
    uint256 public fixedWithdrawPenalty;

    IRocketJoeToken public rJoe;
    uint256 public rJoePerAvax;
    IWAVAX private WAVAX;
    IERC20Metadata public token;

    IJoeRouter02 private router;
    IJoeFactory private factory;
    IRocketJoeFactory public rocketJoeFactory;

    bool private initialized;
    bool public stopped;

    uint256 public maxAllocation;

    mapping(address => UserInfo) public getUserInfo;

    /// @dev The address of the JoePair, set after createLiquidityPool is called
    IJoePair public pair;

    /// @dev The total amount of wavax that was sent to the router to create the initial liquidity pair.
    /// Used to calculate the amount of LP to send based on the user's participation in the launch event
    uint256 private wavaxAllocated;

    /// @dev The exact supply of LP minted when creating the initial liquidity pair.
    uint256 private lpSupply;

    /// @dev Used to know how many issuing tokens will be sent to JoeRouter to create the initial
    /// liquidity pair. If floor price is not met, we will send fewer issuing tokens and `tokenReserve`
    /// will keep track of the leftover amount. It's then used to calculate the number of tokens needed
    /// to be sent to both issuer and users (if there are leftovers and every token is sent to the pair,
    /// tokenReserve will be equal to 0)
    uint256 private tokenReserve;

    /// @dev Keeps track of amount of token incentives that needs to be kept by contract in order to send the right
    /// amounts to issuer and users
    uint256 private tokenIncentivesBalance;
    /// @dev Total incentives for users for locking their LPs for an additional period of time after the pair is created
    uint256 private tokenIncentivesForUsers;
    /// @dev The share refunded to the issuer. Users receive 5% of the token that were sent to the Router.
    /// If the floor price is not met, the incentives still needs to be 5% of the value sent to the Router, so there
    /// will be an excess of tokens returned to the issuer if he calls `withdrawIncentives()`
    uint256 private tokenIncentiveIssuerRefund;

    /// @dev wavaxReserve is the exact amount of WAVAX that needs to be kept inside the contract in order to send everyone's
    /// WAVAX. If there is some excess (because someone sent token directly to the contract), the
    /// penaltyCollector can collect the excess using `skim()`
    uint256 private wavaxReserve;

    event IssuingTokenDeposited(address indexed token, uint256 amount);

    event UserParticipated(
        address indexed user,
        uint256 avaxAmount,
        uint256 rJoeAmount
    );

    event UserWithdrawn(address indexed user, uint256 avaxAmount);

    event LiquidityPoolCreated(
        address indexed pair,
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1
    );

    event UserLiquidityWithdrawn(
        address indexed user,
        address indexed pair,
        uint256 amount
    );

    event IssuerLiquidityWithdrawn(
        address indexed issuer,
        address indexed pair,
        uint256 amount
    );

    event Stopped();

    event AvaxEmergencyWithdraw(address indexed user, uint256 amount);

    event TokenEmergencyWithdraw(address indexed user, uint256 amount);

    /// @notice Receive AVAX from the WAVAX contract
    /// @dev Needed for withdrawing from WAVAX contract
    receive() external payable {
        require(
            msg.sender == address(WAVAX),
            "LaunchEvent: you can't send AVAX directly to this contract"
        );
    }

    /// @notice Modifier which ensures contract is in a defined phase
    modifier atPhase(Phase _phase) {
        _atPhase(_phase);
        _;
    }

    /// @notice Modifier which ensures the caller's timelock to withdraw has elapsed
    modifier timelockElapsed() {
        uint256 phase3Start = auctionStart +
            PHASE_ONE_DURATION +
            PHASE_TWO_DURATION;
        if (msg.sender == issuer) {
            require(
                block.timestamp > phase3Start + issuerTimelock,
                "LaunchEvent: can't withdraw before issuer's timelock"
            );
        } else {
            require(
                block.timestamp > phase3Start + userTimelock,
                "LaunchEvent: can't withdraw before user's timelock"
            );
        }
        _;
    }

    /// @notice Ensures launch event is stopped/running
    modifier isStopped(bool _stopped) {
        if (_stopped) {
            require(stopped, "LaunchEvent: is still running");
        } else {
            require(!stopped, "LaunchEvent: stopped");
        }
        _;
    }

    /// @notice Initialise the launch event with needed paramaters
    /// @param _issuer Address of the token issuer
    /// @param _auctionStart The start time of the auction
    /// @param _token The contract address of auctioned token
    /// @param _tokenIncentivesPercent The token incentives percent, in part per 1e18, e.g 5e16 is 5% of incentives
    /// @param _floorPrice The minimum price the token is sold at
    /// @param _maxWithdrawPenalty The max withdraw penalty during phase 1, in parts per 1e18
    /// @param _fixedWithdrawPenalty The fixed withdraw penalty during phase 2, in parts per 1e18
    /// @param _maxAllocation The maximum amount of AVAX depositable
    /// @param _userTimelock The time a user must wait after auction ends to withdraw liquidity
    /// @param _issuerTimelock The time the issuer must wait after auction ends to withdraw liquidity
    /// @dev This function is called by the factory immediately after it creates the contract instance
    function initialize(
        address _issuer,
        uint256 _auctionStart,
        address _token,
        uint256 _tokenIncentivesPercent,
        uint256 _floorPrice,
        uint256 _maxWithdrawPenalty,
        uint256 _fixedWithdrawPenalty,
        uint256 _maxAllocation,
        uint256 _userTimelock,
        uint256 _issuerTimelock
    ) external atPhase(Phase.NotStarted) {
        require(!initialized, "LaunchEvent: already initialized");

        rocketJoeFactory = IRocketJoeFactory(msg.sender);
        WAVAX = IWAVAX(rocketJoeFactory.wavax());
        router = IJoeRouter02(rocketJoeFactory.router());
        factory = IJoeFactory(rocketJoeFactory.factory());
        rJoe = IRocketJoeToken(rocketJoeFactory.rJoe());
        rJoePerAvax = rocketJoeFactory.rJoePerAvax();

        require(
            _maxWithdrawPenalty <= 5e17,
            "LaunchEvent: maxWithdrawPenalty too big"
        ); // 50%
        require(
            _fixedWithdrawPenalty <= 5e17,
            "LaunchEvent: fixedWithdrawPenalty too big"
        ); // 50%
        require(
            _userTimelock <= 7 days,
            "LaunchEvent: can't lock user LP for more than 7 days"
        );
        require(
            _issuerTimelock > _userTimelock,
            "LaunchEvent: issuer can't withdraw before users"
        );
        require(
            _auctionStart > block.timestamp,
            "LaunchEvent: start of phase 1 cannot be in the past"
        );

        issuer = _issuer;

        auctionStart = _auctionStart;
        PHASE_ONE_DURATION = rocketJoeFactory.PHASE_ONE_DURATION();
        PHASE_ONE_NO_FEE_DURATION = rocketJoeFactory.PHASE_ONE_NO_FEE_DURATION();
        PHASE_TWO_DURATION = rocketJoeFactory.PHASE_TWO_DURATION();

        token = IERC20Metadata(_token);
        uint256 balance = token.balanceOf(address(this));

        tokenIncentivesPercent = _tokenIncentivesPercent;

        /// We do this math because `tokenIncentivesForUsers + tokenReserve = tokenSent`
        /// and `tokenIncentivesForUsers = tokenReserve * 0.05` (i.e. incentives are 5% of reserves for issuing).
        /// E.g. if issuer sends 105e18 tokens, `tokenReserve = 100e18` and `tokenIncentives = 5e18`
        tokenReserve = (balance * 1e18) / (1e18 + _tokenIncentivesPercent);
        tokenIncentivesForUsers = balance - tokenReserve;
        tokenIncentivesBalance = tokenIncentivesForUsers;

        floorPrice = _floorPrice;

        maxWithdrawPenalty = _maxWithdrawPenalty;
        fixedWithdrawPenalty = _fixedWithdrawPenalty;

        maxAllocation = _maxAllocation;

        userTimelock = _userTimelock;
        issuerTimelock = _issuerTimelock;
        initialized = true;
    }

    /// @notice The current phase the auction is in
    function currentPhase() public view returns (Phase) {
        if (block.timestamp < auctionStart || auctionStart == 0) {
            return Phase.NotStarted;
        } else if (block.timestamp < auctionStart + PHASE_ONE_DURATION) {
            return Phase.PhaseOne;
        } else if (
            block.timestamp <
            auctionStart + PHASE_ONE_DURATION + PHASE_TWO_DURATION
        ) {
            return Phase.PhaseTwo;
        }
        return Phase.PhaseThree;
    }

    /// @notice Deposits AVAX and burns rJoe
    /// @dev Checks are done in the `_depositWAVAX` function
    function depositAVAX()
        external
        payable
        isStopped(false)
        atPhase(Phase.PhaseOne)
    {
        require(msg.sender != issuer, "LaunchEvent: issuer cannot participate");
        require(
            msg.value > 0,
            "LaunchEvent: expected non-zero AVAX to deposit"
        );

        UserInfo storage user = getUserInfo[msg.sender];
        uint256 newAllocation = user.balance + msg.value;
        require(
            newAllocation <= maxAllocation,
            "LaunchEvent: amount exceeds max allocation"
        );

        uint256 rJoeNeeded;
        // check if additional allocation is required.
        if (newAllocation > user.allocation) {
            // Burn tokens and update allocation.
            rJoeNeeded = getRJoeAmount(newAllocation - user.allocation);
            // Set allocation to the current balance as it's impossible
            // to buy more allocation without sending AVAX too
            user.allocation = newAllocation;
        }

        user.balance = newAllocation;
        wavaxReserve += msg.value;

        if (rJoeNeeded > 0) {
            rJoe.burnFrom(msg.sender, rJoeNeeded);
        }

        WAVAX.deposit{value: msg.value}();

        emit UserParticipated(msg.sender, msg.value, rJoeNeeded);
    }

    /// @notice Withdraw AVAX, only permitted during phase 1 and 2
    /// @param _amount The amount of AVAX to withdraw
    function withdrawAVAX(uint256 _amount) public isStopped(false) {
        Phase _currentPhase = currentPhase();
        require(
            _currentPhase == Phase.PhaseOne || _currentPhase == Phase.PhaseTwo,
            "LaunchEvent: unable to withdraw"
        );
        require(_amount > 0, "LaunchEvent: invalid withdraw amount");
        UserInfo storage user = getUserInfo[msg.sender];
        require(
            user.balance >= _amount,
            "LaunchEvent: withdrawn amount exceeds balance"
        );
        user.balance -= _amount;

        uint256 feeAmount = (_amount * getPenalty()) / 1e18;
        uint256 amountMinusFee = _amount - feeAmount;

        wavaxReserve -= _amount;

        WAVAX.withdraw(_amount);
        _safeTransferAVAX(msg.sender, amountMinusFee);
        if (feeAmount > 0) {
            _safeTransferAVAX(rocketJoeFactory.penaltyCollector(), feeAmount);
        }
    }

    /// @notice Create the JoePair
    /// @dev Can only be called once after phase 3 has started
    function createPair() external isStopped(false) atPhase(Phase.PhaseThree) {
        (address wavaxAddress, address tokenAddress) = (
            address(WAVAX),
            address(token)
        );
        require(
            factory.getPair(wavaxAddress, tokenAddress) == address(0) ||
                IJoePair(
                    IJoeFactory(factory).getPair(wavaxAddress, tokenAddress)
                ).totalSupply() ==
                0,
            "LaunchEvent: liquid pair already exists"
        );
        require(wavaxReserve > 0, "LaunchEvent: no wavax balance");

        uint256 tokenAllocated = tokenReserve;

        // Adjust the amount of tokens sent to the pool if floor price not met
        if (
            floorPrice > (wavaxReserve * 10**token.decimals()) / tokenAllocated
        ) {
            tokenAllocated = (wavaxReserve * 10**token.decimals()) / floorPrice;
            tokenIncentivesForUsers =
                (tokenIncentivesForUsers * tokenAllocated) /
                tokenReserve;
            tokenIncentiveIssuerRefund =
                tokenIncentivesBalance -
                tokenIncentivesForUsers;
        }

        WAVAX.approve(address(router), wavaxReserve);
        token.approve(address(router), tokenAllocated);

        /// We can't trust the output cause of reflect tokens
        (, , lpSupply) = router.addLiquidity(
            wavaxAddress, // tokenA
            tokenAddress, // tokenB
            wavaxReserve, // amountADesired
            tokenAllocated, // amountBDesired
            wavaxReserve, // amountAMin
            tokenAllocated, // amountBMin
            address(this), // to
            block.timestamp // deadline
        );

        pair = IJoePair(factory.getPair(tokenAddress, wavaxAddress));
        wavaxAllocated = wavaxReserve;
        wavaxReserve = 0;

        tokenReserve -= tokenAllocated;

        emit LiquidityPoolCreated(
            address(pair),
            tokenAddress,
            wavaxAddress,
            tokenAllocated,
            wavaxAllocated
        );
    }

    /// @notice Withdraw liquidity pool tokens
    function withdrawLiquidity() external isStopped(false) timelockElapsed {
        require(address(pair) != address(0), "LaunchEvent: pair not created");

        UserInfo storage user = getUserInfo[msg.sender];
        require(
            !user.hasWithdrawnPair,
            "LaunchEvent: liquidity already withdrawn"
        );

        uint256 balance = pairBalance(msg.sender);
        user.hasWithdrawnPair = true;

        if (msg.sender == issuer) {
            balance = lpSupply / 2;

            emit IssuerLiquidityWithdrawn(msg.sender, address(pair), balance);

            if (tokenReserve > 0) {
                uint256 amount = tokenReserve;
                tokenReserve = 0;
                token.transfer(msg.sender, amount);
            }
        } else {
            emit UserLiquidityWithdrawn(msg.sender, address(pair), balance);
        }

        pair.transfer(msg.sender, balance);
    }

    /// @notice Withdraw incentives tokens
    function withdrawIncentives() external isStopped(false) {
        require(address(pair) != address(0), "LaunchEvent: pair not created");

        UserInfo storage user = getUserInfo[msg.sender];
        require(
            !user.hasWithdrawnIncentives,
            "LaunchEvent: incentives already withdrawn"
        );

        user.hasWithdrawnIncentives = true;
        uint256 amount;

        if (msg.sender == issuer) {
            amount = tokenIncentiveIssuerRefund;
        } else {
            amount = (user.balance * tokenIncentivesForUsers) / wavaxAllocated;
        }

        require(amount > 0, "LaunchEvent: caller has no incentive to claim");

        tokenIncentivesBalance -= amount;

        token.transfer(msg.sender, amount);
    }

    /// @notice Withdraw AVAX if launch has been cancelled
    function emergencyWithdraw() external isStopped(true) {
        if (msg.sender != issuer) {
            UserInfo storage user = getUserInfo[msg.sender];
            require(
                user.balance > 0,
                "LaunchEvent: expected user to have non-zero balance to perform emergency withdraw"
            );

            uint256 balance = user.balance;
            user.balance = 0;
            wavaxReserve -= balance;
            WAVAX.withdraw(balance);

            _safeTransferAVAX(msg.sender, balance);

            emit AvaxEmergencyWithdraw(msg.sender, balance);
        } else {
            uint256 balance = tokenReserve + tokenIncentivesBalance;
            tokenReserve = 0;
            tokenIncentivesBalance = 0;
            token.transfer(issuer, balance);
            emit TokenEmergencyWithdraw(msg.sender, balance);
        }
    }

    /// @notice Stops the launch event and allows participants withdraw deposits
    function allowEmergencyWithdraw() external {
        require(
            msg.sender == Ownable(address(rocketJoeFactory)).owner(),
            "LaunchEvent: caller is not RocketJoeFactory owner"
        );
        stopped = true;
        emit Stopped();
    }

    /// @notice Force balances to match tokens that were deposited, but not sent directly to the contract.
    /// Any excess tokens are sent to the penaltyCollector
    function skim() external {
        address penaltyCollector = rocketJoeFactory.penaltyCollector();

        uint256 excessToken = token.balanceOf(address(this)) -
            tokenReserve -
            tokenIncentivesBalance;
        if (excessToken > 0) {
            token.transfer(penaltyCollector, excessToken);
        }

        uint256 excessWavax = WAVAX.balanceOf(address(this)) - wavaxReserve;
        if (excessWavax > 0) {
            WAVAX.transfer(penaltyCollector, excessWavax);
        }

        uint256 excessAvax = address(this).balance;
        if (excessAvax > 0) _safeTransferAVAX(penaltyCollector, excessAvax);
    }

    /// @notice Returns the current penalty for early withdrawal
    /// @return The penalty to apply to a withdrawal amount
    function getPenalty() public view returns (uint256) {
        uint256 timeElapsed = block.timestamp - auctionStart;
        if (timeElapsed < PHASE_ONE_NO_FEE_DURATION) {
            return 0;
        } else if (timeElapsed < PHASE_ONE_DURATION) {
            return
                ((timeElapsed - PHASE_ONE_NO_FEE_DURATION) *
                    maxWithdrawPenalty) /
                uint256(PHASE_ONE_DURATION - PHASE_ONE_NO_FEE_DURATION);
        }
        return fixedWithdrawPenalty;
    }

    /// @notice Returns the current balance of the pool
    /// @return The balances of WAVAX and issued token held by the launch contract
    function getReserves() external view returns (uint256, uint256) {
        return (wavaxReserve, tokenReserve + tokenIncentivesBalance);
    }

    /// @notice Get the rJOE amount needed to deposit AVAX
    /// @param _avaxAmount The amount of AVAX to deposit
    /// @return The amount of rJOE needed
    function getRJoeAmount(uint256 _avaxAmount) public view returns (uint256) {
        return _avaxAmount * rJoePerAvax;
    }

    /// @notice The total amount of liquidity pool tokens the user can withdraw
    /// @param _user The address of the user to check
    function pairBalance(address _user) public view returns (uint256) {
        UserInfo memory user = getUserInfo[_user];
        if (wavaxAllocated == 0 || user.hasWithdrawnPair) {
            return 0;
        }
        return (user.balance * lpSupply) / wavaxAllocated / 2;
    }

    /// @dev Bytecode size optimization for the `atPhase` modifier.
    /// This works becuase internal functions are not in-lined in modifiers
    function _atPhase(Phase _phase) internal view {
        if (_phase == Phase.NotStarted) {
            require(
                currentPhase() == Phase.NotStarted,
                "LaunchEvent: not in not started"
            );
        } else if (_phase == Phase.PhaseOne) {
            require(
                currentPhase() == Phase.PhaseOne,
                "LaunchEvent: not in phase one"
            );
        } else if (_phase == Phase.PhaseTwo) {
            require(
                currentPhase() == Phase.PhaseTwo,
                "LaunchEvent: not in phase two"
            );
        } else if (_phase == Phase.PhaseThree) {
            require(
                currentPhase() == Phase.PhaseThree,
                "LaunchEvent: not in phase three"
            );
        } else {
            revert("LaunchEvent: unknown state");
        }
    }

    /// @notice Send AVAX
    /// @param _to The receiving address
    /// @param _value The amount of AVAX to send
    /// @dev Will revert on failure
    function _safeTransferAVAX(address _to, uint256 _value) internal {
        (bool success, ) = _to.call{value: _value}(new bytes(0));
        require(success, "LaunchEvent: avax transfer failed");
    }
}
