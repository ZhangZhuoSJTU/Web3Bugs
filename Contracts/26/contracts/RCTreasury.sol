// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./lib/NativeMetaTransaction.sol";
import "./interfaces/IRCTreasury.sol";
import "./interfaces/IRCMarket.sol";
import "./interfaces/IRCOrderbook.sol";
import "./interfaces/IRCNftHubL2.sol";
import "./interfaces/IRCFactory.sol";
import "./interfaces/IRCBridge.sol";

/// @title Reality Cards Treasury
/// @author Andrew Stanger & Daniel Chilvers
/// @notice If you have found a bug, please contact andrew@realitycards.io- no hack pls!!
contract RCTreasury is AccessControl, NativeMetaTransaction, IRCTreasury {
    using SafeERC20 for IERC20;

    /*╔═════════════════════════════════╗
      ║             VARIABLES           ║
      ╚═════════════════════════════════╝*/
    /// @dev orderbook instance, to remove users bids on foreclosure
    IRCOrderbook public override orderbook;
    /// @dev leaderboard instance
    IRCLeaderboard public override leaderboard;
    /// @dev token contract
    IERC20 public override erc20;
    /// @dev address of (as yet non existent) Bridge for withdrawals to mainnet
    address public override bridgeAddress;
    /// @dev the Factory so only the Factory can add new markets
    IRCFactory public override factory;
    /// @dev sum of all deposits
    uint256 public override totalDeposits;
    /// @dev the rental payments made in each market
    mapping(address => uint256) public override marketPot;
    /// @dev sum of all market pots
    uint256 public override totalMarketPots;
    /// @dev rent taken and allocated to a particular market
    uint256 public override marketBalance;
    /// @dev a quick check if a user is foreclosed
    mapping(address => bool) public override isForeclosed;
    /// @dev to keep track of the size of the rounding issue between rent collections
    uint256 public override marketBalanceTopup;

    /// @param deposit the users current deposit in wei
    /// @param rentalRate the daily cost of the cards the user current owns
    /// @param bidRate the sum total of all placed bids
    /// @param lastRentCalc The timestamp of the users last rent calculation
    /// @param lastRentalTime The timestamp the user last made a rental
    struct User {
        uint128 deposit;
        uint128 rentalRate;
        uint128 bidRate;
        uint64 lastRentCalc;
        uint64 lastRentalTime;
    }
    mapping(address => User) public user;

    /*╔═════════════════════════════════╗
      ║      GOVERNANCE VARIABLES       ║
      ╚═════════════════════════════════╝*/
    /// @dev only parameters that need to be are here, the rest are in the Factory
    /// @dev minimum rental duration (1 day divisor: i.e. 24 = 1 hour, 48 = 30 mins)
    uint256 public override minRentalDayDivisor;
    /// @dev max deposit balance, to minimise funds at risk
    uint256 public override maxContractBalance;
    /// @dev whitelist to only allow certain addresses to deposit
    /// @dev intended for beta use only, will be disabled after launch
    mapping(address => bool) public isAllowed;
    bool public whitelistEnabled;
    /// @dev allow markets to be restricted to a certain role
    mapping(address => bytes32) public marketWhitelist;

    /*╔═════════════════════════════════╗
      ║             SAFETY              ║
      ╚═════════════════════════════════╝*/
    /// @dev if true, cannot deposit, withdraw or rent any cards across all events
    bool public override globalPause;
    /// @dev if true, cannot rent, claim or upgrade any cards for specific market
    mapping(address => bool) public override marketPaused;
    /// @dev if true, owner has locked the market pause (Governors are locked out)
    mapping(address => bool) public override lockMarketPaused;

    /*╔═════════════════════════════════╗
      ║          Access Control         ║
      ╚═════════════════════════════════╝*/
    bytes32 public constant UBER_OWNER = keccak256("UBER_OWNER");
    bytes32 public constant OWNER = keccak256("OWNER");
    bytes32 public constant GOVERNOR = keccak256("GOVERNOR");
    bytes32 public constant FACTORY = keccak256("FACTORY");
    bytes32 public constant MARKET = keccak256("MARKET");
    bytes32 public constant TREASURY = keccak256("TREASURY");
    bytes32 public constant ORDERBOOK = keccak256("ORDERBOOK");
    bytes32 public constant WHITELIST = keccak256("WHITELIST");
    bytes32 public constant ARTIST = keccak256("ARTIST");
    bytes32 public constant AFFILIATE = keccak256("AFFILIATE");
    bytes32 public constant CARD_AFFILIATE = keccak256("CARD_AFFILIATE");

    /*╔═════════════════════════════════╗
      ║             EVENTS              ║
      ╚═════════════════════════════════╝*/

    event LogUserForeclosed(address indexed user, bool indexed foreclosed);
    event LogAdjustDeposit(
        address indexed user,
        uint256 indexed amount,
        bool increase
    );
    event LogMarketPaused(address market, bool paused);
    event LogGlobalPause(bool paused);
    event LogWhitelistUser(address user, bool allowed);

    /*╔═════════════════════════════════╗
      ║           CONSTRUCTOR           ║
      ╚═════════════════════════════════╝*/

    constructor(address _tokenAddress) {
        // initialise MetaTransactions
        _initializeEIP712("RealityCardsTreasury", "1");

        /* setup AccessControl

                         UBER_OWNER
            ┌───────────┬────┴─────┬────────────┬─────────┐
            │           │          │            │         │
          OWNER      FACTORY    ORDERBOOK   TREASURY  LEADERBOARD
            │           │
         GOVERNOR     MARKET
            │
         WHITELIST | ARTIST | AFFILIATE | CARD_AFFILIATE
        */
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(UBER_OWNER, _msgSender());
        _setupRole(OWNER, _msgSender());
        _setupRole(GOVERNOR, _msgSender());
        _setupRole(WHITELIST, _msgSender());
        _setupRole(TREASURY, address(this));
        _setRoleAdmin(UBER_OWNER, UBER_OWNER);
        _setRoleAdmin(OWNER, UBER_OWNER);
        _setRoleAdmin(FACTORY, UBER_OWNER);
        _setRoleAdmin(ORDERBOOK, UBER_OWNER);
        _setRoleAdmin(TREASURY, UBER_OWNER);
        _setRoleAdmin(GOVERNOR, OWNER);
        _setRoleAdmin(WHITELIST, GOVERNOR);
        _setRoleAdmin(ARTIST, GOVERNOR);
        _setRoleAdmin(AFFILIATE, GOVERNOR);
        _setRoleAdmin(CARD_AFFILIATE, GOVERNOR);
        _setRoleAdmin(MARKET, FACTORY);

        // initialise adjustable parameters
        setMinRental(24 * 6); // MinRental is a divisor of 1 day(86400 seconds), 24*6 will set to 10 minutes
        setMaxContractBalance(1_000_000 ether); // 1m
        setTokenAddress(_tokenAddress);
        whitelistEnabled = true;
    }

    /*╔═════════════════════════════════╗
      ║           MODIFIERS             ║
      ╚═════════════════════════════════╝*/

    /// @notice check that funds haven't gone missing during this function call
    modifier balancedBooks() {
        _;
        // using >= not == in case anyone sends tokens direct to contract
        require(
            erc20.balanceOf(address(this)) >=
                totalDeposits + marketBalance + totalMarketPots,
            "Books are unbalanced!"
        );
    }

    /*╔═════════════════════════════════╗
      ║       GOVERNANCE - OWNER        ║
      ╚═════════════════════════════════╝*/

    /// @dev all functions should be onlyRole(OWNER)
    // min rental event emitted by market. Nothing else need be emitted.

    /*┌────────────────────────────────────┐
      │ CALLED WITHIN CONSTRUCTOR - PUBLIC │
      └────────────────────────────────────┘*/

    /// @notice minimum rental duration (1 day divisor: i.e. 24 = 1 hour, 48 = 30 mins)
    /// @param _newDivisor the divisor to set
    function setMinRental(uint256 _newDivisor) public override onlyRole(OWNER) {
        minRentalDayDivisor = _newDivisor;
    }

    /// @notice set max deposit balance, to minimise funds at risk
    /// @dev this is only a soft check, it is possible to exceed this limit
    /// @param _newBalanceLimit the max balance to set in wei
    function setMaxContractBalance(uint256 _newBalanceLimit)
        public
        override
        onlyRole(OWNER)
    {
        maxContractBalance = _newBalanceLimit;
    }

    /*┌──────────────────────────────────────────┐
      │ NOT CALLED WITHIN CONSTRUCTOR - EXTERNAL │
      └──────────────────────────────────────────┘*/

    /// @notice if true, cannot deposit, withdraw or rent any cards
    function changeGlobalPause() external override onlyRole(OWNER) {
        globalPause = !globalPause;
        emit LogGlobalPause(globalPause);
    }

    /// @notice if true, cannot make a new rental, or claim the NFT for a specific market
    function changePauseMarket(address _market, bool _paused)
        external
        override
        onlyRole(OWNER)
    {
        require(hasRole(MARKET, _market), "This isn't a market");
        marketPaused[_market] = _paused;
        lockMarketPaused[_market] = marketPaused[_market];
        emit LogMarketPaused(_market, marketPaused[_market]);
    }

    /// @notice allow governance (via the factory) to approve and un pause the market if the owner hasn't paused it
    function unPauseMarket(address _market)
        external
        override
        onlyRole(FACTORY)
    {
        require(hasRole(MARKET, _market), "This isn't a market");
        require(!lockMarketPaused[_market], "Owner has paused market");
        marketPaused[_market] = false;
        emit LogMarketPaused(_market, marketPaused[_market]);
    }

    /*╔═════════════════════════════════╗
      ║      WHITELIST FUNCTIONS        ║
      ╚═════════════════════════════════╝*/

    /// @notice if true, users must be on the whitelist to deposit
    function toggleWhitelist() external override onlyRole(OWNER) {
        whitelistEnabled = !whitelistEnabled;
    }

    /// @notice Add/Remove multiple users to the whitelist
    /// @param _users an array of users to add or remove
    /// @param add true to add the users
    function batchWhitelist(address[] calldata _users, bool add)
        external
        override
        onlyRole(GOVERNOR)
    {
        if (add) {
            for (uint256 index = 0; index < _users.length; index++) {
                RCTreasury.grantRole(WHITELIST, _users[index]);
            }
        } else {
            for (uint256 index = 0; index < _users.length; index++) {
                RCTreasury.revokeRole(WHITELIST, _users[index]);
            }
        }
    }

    /// @notice Some markets may be restricted to certain roles,
    /// @notice This function checks if the user has the role requried for a given market
    /// @dev Used for the markets to check themselves
    /// @param _user The user to check
    function marketWhitelistCheck(address _user)
        external
        view
        override
        returns (bool)
    {
        bytes32 requiredRole = marketWhitelist[msgSender()];
        if (requiredRole == bytes32(0)) {
            return true;
        } else {
            return hasRole(requiredRole, _user);
        }
    }

    /*╔═════════════════════════════════╗
      ║     GOVERNANCE - UBER OWNER     ║
      ╠═════════════════════════════════╣
      ║  ******** DANGER ZONE ********  ║
      ╚═════════════════════════════════╝*/
    /// @dev uber owner required for upgrades
    /// @dev deploying and setting a new factory is effectively an upgrade
    /// @dev this is seperate so owner so can be set to multisig, or burn address to relinquish upgrade ability
    /// @dev ... while maintaining governance over other governance functions

    function setFactoryAddress(address _newFactory)
        external
        override
        onlyRole(UBER_OWNER)
    {
        require(_newFactory != address(0), "Must set an address");
        // factory is also an OWNER and GOVERNOR to use the proxy functions
        revokeRole(FACTORY, address(factory));
        revokeRole(OWNER, address(factory));
        revokeRole(GOVERNOR, address(factory));
        factory = IRCFactory(_newFactory);
        grantRole(FACTORY, address(factory));
        grantRole(OWNER, address(factory));
        grantRole(GOVERNOR, address(factory));
    }

    function setOrderbookAddress(address _newOrderbook)
        external
        override
        onlyRole(UBER_OWNER)
    {
        require(_newOrderbook != address(0), "Must set an address");
        revokeRole(ORDERBOOK, address(orderbook));
        orderbook = IRCOrderbook(_newOrderbook);
        grantRole(ORDERBOOK, address(orderbook));
        factory.setOrderbookAddress(orderbook);
    }

    function setLeaderboardAddress(address _newLeaderboard)
        external
        override
        onlyRole(UBER_OWNER)
    {
        require(_newLeaderboard != address(0), "Must set an address");
        leaderboard = IRCLeaderboard(_newLeaderboard);
        factory.setLeaderboardAddress(leaderboard);
    }

    function setTokenAddress(address _newToken)
        public
        override
        onlyRole(UBER_OWNER)
    {
        require(_newToken != address(0), "Must set an address");
        erc20 = IERC20(_newToken);
    }

    function setBridgeAddress(address _newBridge)
        external
        override
        onlyRole(UBER_OWNER)
    {
        require(_newBridge != address(0), "Must set an address");
        bridgeAddress = _newBridge;
        erc20.approve(_newBridge, type(uint256).max);
    }

    /// @notice Disaster recovery, pulls all funds from the Treasury to the UberOwner
    function globalExit() external onlyRole(UBER_OWNER) {
        uint256 _balance = erc20.balanceOf(address(this));
        /// @dev using msg.sender instead of msgSender as a precaution should Meta-Tx be compromised
        erc20.safeTransfer(msg.sender, _balance);
    }

    /*╔═════════════════════════════════╗
      ║ DEPOSIT AND WITHDRAW FUNCTIONS  ║
      ╚═════════════════════════════════╝*/

    /// @notice deposit tokens into RealityCards
    /// @dev it is passed the user instead of using msg.sender because might be called
    /// @dev ... via contract or Layer1->Layer2 bot
    /// @param _user the user to credit the deposit to
    /// @param _amount the amount to deposit, must be approved
    function deposit(uint256 _amount, address _user)
        external
        override
        balancedBooks
        returns (bool)
    {
        require(!globalPause, "Deposits are disabled");
        require(
            erc20.allowance(msgSender(), address(this)) >= _amount,
            "User not approved to send this amount"
        );
        require(
            (erc20.balanceOf(address(this)) + _amount) <= maxContractBalance,
            "Limit hit"
        );
        require(_amount > 0, "Must deposit something");
        if (whitelistEnabled) {
            require(hasRole(WHITELIST, _user), "Not in whitelist");
        }
        erc20.safeTransferFrom(msgSender(), address(this), _amount);

        // do some cleaning up, it might help cancel their foreclosure
        orderbook.removeOldBids(_user);

        user[_user].deposit += SafeCast.toUint128(_amount);
        totalDeposits += _amount;
        emit LogAdjustDeposit(_user, _amount, true);

        // this deposit could cancel the users foreclosure
        assessForeclosure(_user);
        return true;
    }

    /// @notice withdraw a users deposit either directly or over the bridge to the mainnet
    /// @dev this is the only function where funds leave the contract
    /// @param _amount the amount to withdraw
    /// @param _localWithdrawal if true then withdraw to the users address, otherwise to the bridge
    function withdrawDeposit(uint256 _amount, bool _localWithdrawal)
        external
        override
        balancedBooks
    {
        require(!globalPause, "Withdrawals are disabled");
        address _msgSender = msgSender();
        require(user[_msgSender].deposit > 0, "Nothing to withdraw");
        // only allow withdraw if they have no bids,
        // OR they've had their cards for at least the minimum rental period
        require(
            user[_msgSender].bidRate == 0 ||
                block.timestamp - (user[_msgSender].lastRentalTime) >
                uint256(1 days) / minRentalDayDivisor,
            "Too soon"
        );

        // step 1: collect rent on owned cards
        collectRentUser(_msgSender, block.timestamp);

        // step 2: process withdrawal
        if (_amount > user[_msgSender].deposit) {
            _amount = user[_msgSender].deposit;
        }
        emit LogAdjustDeposit(_msgSender, _amount, false);
        user[_msgSender].deposit -= SafeCast.toUint128(_amount);
        totalDeposits -= _amount;
        if (_localWithdrawal) {
            erc20.safeTransfer(_msgSender, _amount);
        } else {
            IRCBridge bridge = IRCBridge(bridgeAddress);
            bridge.withdrawToMainnet(_msgSender, _amount);
        }

        // step 3: remove bids if insufficient deposit
        // do some cleaning up first, it might help avoid their foreclosure
        orderbook.removeOldBids(_msgSender);
        if (
            user[_msgSender].bidRate != 0 &&
            user[_msgSender].bidRate / (minRentalDayDivisor) >
            user[_msgSender].deposit
        ) {
            // foreclose user, this is requred to remove them from the orderbook
            isForeclosed[_msgSender] = true;
            // remove them from the orderbook
            orderbook.removeUserFromOrderbook(_msgSender);
        }
    }

    /// @notice to increase the market balance
    /// @dev not strictly required but prevents markets being shortchanged due to rounding issues
    function topupMarketBalance(uint256 _amount)
        external
        override
        balancedBooks
    {
        erc20.safeTransferFrom(msgSender(), address(this), _amount);
        marketBalanceTopup += _amount;
        marketBalance += _amount;
    }

    /*╔═════════════════════════════════╗
      ║         ERC20 helpers           ║
      ╚═════════════════════════════════╝*/

    function checkSponsorship(address sender, uint256 _amount)
        external
        view
        override
    {
        require(
            erc20.allowance(sender, address(this)) >= _amount,
            "Insufficient Allowance"
        );
        require(erc20.balanceOf(sender) >= _amount, "Insufficient Balance");
    }

    /*╔═════════════════════════════════╗
      ║        MARKET CALLABLE          ║
      ╚═════════════════════════════════╝*/
    // only markets can call these functions

    /// @notice a rental payment is equivalent to moving from user's deposit to market pot,
    /// @notice ..called by _collectRent in the market
    /// @param _amount amount of rent to pay in wei
    function payRent(uint256 _amount)
        external
        override
        balancedBooks
        onlyRole(MARKET)
        returns (uint256)
    {
        require(!globalPause, "Rentals are disabled");
        if (marketBalance < _amount) {
            uint256 discrepancy = _amount - marketBalance;
            if (discrepancy > marketBalanceTopup) {
                marketBalanceTopup = 0;
            } else {
                marketBalanceTopup -= discrepancy;
            }
            _amount = marketBalance;
        }
        address _market = msgSender();
        marketBalance -= _amount;
        marketPot[_market] += _amount;
        totalMarketPots += _amount;
        /// @dev return the amount just incase it was adjusted
        return _amount;
    }

    /// @notice a payout is equivalent to moving from market pot to user's deposit (the opposite of payRent)
    /// @param _user the user to query
    /// @param _amount amount to payout in wei
    function payout(address _user, uint256 _amount)
        external
        override
        balancedBooks
        onlyRole(MARKET)
        returns (bool)
    {
        require(!globalPause, "Payouts are disabled");
        user[_user].deposit += SafeCast.toUint128(_amount);
        marketPot[msgSender()] -= _amount;
        totalMarketPots -= _amount;
        totalDeposits += _amount;
        assessForeclosure(_user);
        emit LogAdjustDeposit(_user, _amount, true);
        return true;
    }

    /// @dev called by _collectRentAction() in the market in situations where collectRentUser() collected too much rent
    function refundUser(address _user, uint256 _refund)
        external
        override
        balancedBooks
        onlyRole(MARKET)
    {
        marketBalance -= _refund;
        user[_user].deposit += SafeCast.toUint128(_refund);
        totalDeposits += _refund;
        emit LogAdjustDeposit(_user, _refund, true);
        assessForeclosure(_user);
    }

    /// @notice ability to add liquidity to the pot without being able to win (called by market sponsor function).
    function sponsor(address _sponsor, uint256 _amount)
        external
        override
        balancedBooks
        onlyRole(MARKET)
    {
        require(!globalPause, "Global Pause is Enabled");
        address _msgSender = msgSender();
        require(!lockMarketPaused[_msgSender], "Market is paused");
        require(
            erc20.allowance(_sponsor, address(this)) >= _amount,
            "Not approved to send this amount"
        );
        erc20.safeTransferFrom(_sponsor, address(this), _amount);
        marketPot[_msgSender] += _amount;
        totalMarketPots += _amount;
    }

    /// @notice tracks when the user last rented- so they cannot rent and immediately withdraw,
    /// @notice ..thus bypassing minimum rental duration
    /// @param _user the user to query
    function updateLastRentalTime(address _user)
        external
        override
        onlyRole(MARKET)
    {
        // update the last rental time
        user[_user].lastRentalTime = SafeCast.toUint64(block.timestamp);
        // check if this is their first rental (no previous rental calculation)
        if (user[_user].lastRentCalc == 0) {
            // we need to start their clock ticking, update their last rental calculation time
            user[_user].lastRentCalc = SafeCast.toUint64(block.timestamp);
        }
    }

    /*╔═════════════════════════════════╗
      ║        MARKET HELPERS           ║
      ╚═════════════════════════════════╝*/

    function addMarket(address _market, bool _paused) external override {
        require(hasRole(FACTORY, msgSender()), "Not Authorised");
        marketPaused[_market] = _paused;
        AccessControl.grantRole(MARKET, _market);
        emit LogMarketPaused(_market, marketPaused[_market]);
    }

    /// @notice provides the sum total of a users bids across all markets (whether active or not)
    /// @param _user the user address to query
    function userTotalBids(address _user)
        external
        view
        override
        returns (uint256)
    {
        return user[_user].bidRate;
    }

    /// @notice provide the users remaining deposit
    /// @param _user the user address to query
    function userDeposit(address _user)
        external
        view
        override
        returns (uint256)
    {
        return uint256(user[_user].deposit);
    }

    /*╔═════════════════════════════════╗
      ║      ORDERBOOK CALLABLE         ║
      ╚═════════════════════════════════╝*/

    /// @notice updates users rental rates when ownership changes
    /// @dev rentalRate = sum of all active bids
    /// @param _oldOwner the address of the user losing ownership
    /// @param _newOwner the address of the user gaining ownership
    /// @param _oldPrice the price the old owner was paying
    /// @param _newPrice the price the new owner will be paying
    /// @param _timeOwnershipChanged the timestamp of this event
    function updateRentalRate(
        address _oldOwner,
        address _newOwner,
        uint256 _oldPrice,
        uint256 _newPrice,
        uint256 _timeOwnershipChanged
    ) external override onlyRole(ORDERBOOK) {
        if (
            _timeOwnershipChanged != user[_newOwner].lastRentCalc &&
            !hasRole(MARKET, _newOwner)
        ) {
            // The new owners rent must be collected before adjusting their rentalRate
            // See if the new owner has had a rent collection before or after this ownership change
            if (_timeOwnershipChanged < user[_newOwner].lastRentCalc) {
                // the new owner has a more recent rent collection

                uint256 _additionalRentOwed = rentOwedBetweenTimestamps(
                    user[_newOwner].lastRentCalc,
                    _timeOwnershipChanged,
                    _newPrice
                );

                // they have enough funds, just collect the extra
                // we can be sure of this because it was checked they can cover the minimum rental
                _increaseMarketBalance(_additionalRentOwed, _newOwner);
                emit LogAdjustDeposit(_newOwner, _additionalRentOwed, false);
            } else {
                // the new owner has an old rent collection, do they own anything else?
                if (user[_newOwner].rentalRate != 0) {
                    // rent collect upto ownership change time
                    collectRentUser(_newOwner, _timeOwnershipChanged);
                } else {
                    // first card owned, set start time
                    user[_newOwner].lastRentCalc = SafeCast.toUint64(
                        _timeOwnershipChanged
                    );
                    // send an event for the UI to have a timestamp
                    emit LogAdjustDeposit(_newOwner, 0, false);
                }
            }
        }
        // Must add before subtract, to avoid underflow in the case a user is only updating their price.
        user[_newOwner].rentalRate += SafeCast.toUint128(_newPrice);
        user[_oldOwner].rentalRate -= SafeCast.toUint128(_oldPrice);
    }

    /// @dev increase bidRate when new bid entered
    function increaseBidRate(address _user, uint256 _price)
        external
        override
        onlyRole(ORDERBOOK)
    {
        user[_user].bidRate += SafeCast.toUint128(_price);
    }

    /// @dev decrease bidRate when bid removed
    function decreaseBidRate(address _user, uint256 _price)
        external
        override
        onlyRole(ORDERBOOK)
    {
        user[_user].bidRate -= SafeCast.toUint128(_price);
    }

    /*╔═════════════════════════════════╗
      ║      RENT CALC HELPERS          ║
      ╚═════════════════════════════════╝*/

    /// @notice returns the rent due between the users last rent calculation and
    /// @notice ..the current block.timestamp for all cards a user owns
    /// @param _user the user to query
    /// @param _timeOfCollection calculate upto a given time
    function rentOwedUser(address _user, uint256 _timeOfCollection)
        internal
        view
        returns (uint256 rentDue)
    {
        return
            (user[_user].rentalRate *
                (_timeOfCollection - user[_user].lastRentCalc)) / (1 days);
    }

    /// @notice calculates the rent owed between the given timestamps
    /// @param _time1 one of the timestamps
    /// @param _time2 the second timestamp
    /// @param _price the rental rate for this time period
    /// @param _rent the rent due for this time period
    /// @dev the timestamps can be given in any order
    function rentOwedBetweenTimestamps(
        uint256 _time1,
        uint256 _time2,
        uint256 _price
    ) internal pure returns (uint256 _rent) {
        if (_time1 < _time2) {
            (_time1, _time2) = (_time2, _time1);
        }
        _rent = (_price * (_time1 - _time2)) / (1 days);
    }

    /// @notice returns the current estimate of the users foreclosure time
    /// @param _user the user to query
    /// @param _newBid calculate foreclosure including a new card
    /// @param _timeOfNewBid timestamp of when a new card was gained
    function foreclosureTimeUser(
        address _user,
        uint256 _newBid,
        uint256 _timeOfNewBid
    ) external view override returns (uint256) {
        uint256 totalUserDailyRent = user[_user].rentalRate;
        if (totalUserDailyRent > 0) {
            uint256 timeLeftOfDeposit = (user[_user].deposit * 1 days) /
                totalUserDailyRent;

            uint256 foreclosureTimeWithoutNewCard = user[_user].lastRentCalc +
                timeLeftOfDeposit;

            if (
                foreclosureTimeWithoutNewCard > _timeOfNewBid &&
                _timeOfNewBid != 0
            ) {
                // calculate how long they can own the new card for
                uint256 _rentDifference = rentOwedBetweenTimestamps(
                    user[_user].lastRentCalc,
                    _timeOfNewBid,
                    totalUserDailyRent
                );
                uint256 _depositAtTimeOfNewBid = 0;

                if (user[_user].lastRentCalc < _timeOfNewBid) {
                    // new bid is after user rent calculation
                    _depositAtTimeOfNewBid =
                        user[_user].deposit -
                        _rentDifference;
                } else {
                    // new bid is before user rent calculation
                    _depositAtTimeOfNewBid =
                        user[_user].deposit +
                        _rentDifference;
                }

                uint256 _timeLeftOfDepositWithNewBid = (_depositAtTimeOfNewBid *
                    1 days) / (totalUserDailyRent + _newBid);

                uint256 _foreclosureTimeWithNewCard = _timeOfNewBid +
                    _timeLeftOfDepositWithNewBid;
                if (_foreclosureTimeWithNewCard > user[_user].lastRentCalc) {
                    return _foreclosureTimeWithNewCard;
                } else {
                    // The user couldn't afford to own the new card up to their last
                    // .. rent calculation, we can't rewind their rent calculation because
                    // .. of gas limits (there could be many markets having taken rent).
                    // Therefore unfortunately we can't give any ownership to this user as
                    // .. this could mean getting caught in a loop we may not be able to
                    // .. exit because of gas limits (there could be many users in this
                    // .. situation and we can't leave any unaccounted for).
                    // This means we return 0 to signify that the user can't afford this
                    // .. new ownership.
                    return 0;
                }
            } else {
                return user[_user].lastRentCalc + timeLeftOfDeposit;
            }
        } else {
            if (_newBid == 0) {
                // if no rentals they'll foreclose after the heat death of the universe
                return type(uint256).max;
            } else {
                return
                    _timeOfNewBid + ((user[_user].deposit * 1 days) / _newBid);
            }
        }
    }

    /// @notice call for a rent collection on the given user
    /// @notice IF the user doesn't have enough deposit, returns foreclosure time
    /// @notice ..otherwise returns zero
    /// @param _user the user to query
    /// @param _timeToCollectTo the timestamp to collect rent upto
    /// @return newTimeLastCollectedOnForeclosure the time the user foreclosed if they foreclosed in this calculation
    function collectRentUser(address _user, uint256 _timeToCollectTo)
        public
        override
        returns (uint256 newTimeLastCollectedOnForeclosure)
    {
        require(!globalPause, "Global pause is enabled");
        require(_timeToCollectTo != 0, "Must set collection time");
        require(
            _timeToCollectTo <= block.timestamp,
            "Can't collect future rent"
        );
        if (user[_user].lastRentCalc < _timeToCollectTo) {
            uint256 rentOwedByUser = rentOwedUser(_user, _timeToCollectTo);

            if (rentOwedByUser > 0 && rentOwedByUser > user[_user].deposit) {
                // The User has run out of deposit already.
                uint256 previousCollectionTime = user[_user].lastRentCalc;

                /*
            timeTheirDepositLasted = timeSinceLastUpdate * (usersDeposit/rentOwed)
                                  = (now - previousCollectionTime) * (usersDeposit/rentOwed)
            */
                uint256 timeUsersDepositLasts = ((_timeToCollectTo -
                    previousCollectionTime) * uint256(user[_user].deposit)) /
                    rentOwedByUser;
                /*
            Users last collection time = previousCollectionTime + timeTheirDepositLasted
            */
                rentOwedByUser = uint256(user[_user].deposit);
                newTimeLastCollectedOnForeclosure =
                    previousCollectionTime +
                    timeUsersDepositLasts;
                _increaseMarketBalance(rentOwedByUser, _user);
                user[_user].lastRentCalc = SafeCast.toUint64(
                    newTimeLastCollectedOnForeclosure
                );
                assert(user[_user].deposit == 0);
                isForeclosed[_user] = true;
                emit LogUserForeclosed(_user, true);
            } else {
                // User has enough deposit to pay rent.
                _increaseMarketBalance(rentOwedByUser, _user);
                user[_user].lastRentCalc = SafeCast.toUint64(_timeToCollectTo);
            }
            emit LogAdjustDeposit(_user, rentOwedByUser, false);
        }
    }

    /// moving from the user deposit to the markets available balance
    function _increaseMarketBalance(uint256 rentCollected, address _user)
        internal
    {
        marketBalance += rentCollected;
        user[_user].deposit -= SafeCast.toUint128(rentCollected);
        totalDeposits -= rentCollected;
    }

    /// @notice checks if the user should still be foreclosed
    function assessForeclosure(address _user) public override {
        if (user[_user].deposit > (user[_user].bidRate / minRentalDayDivisor)) {
            isForeclosed[_user] = false;
            emit LogUserForeclosed(_user, false);
        } else {
            isForeclosed[_user] = true;
            emit LogUserForeclosed(_user, true);
        }
    }

    /// @dev can't be called hasRole also because AccessControl.hasRole isn't virtual
    function checkPermission(bytes32 role, address account)
        external
        view
        override
        returns (bool)
    {
        return AccessControl.hasRole(role, account);
    }

    function grantRole(string memory role, address account) external override {
        bytes32 _role = keccak256(abi.encodePacked(role));
        RCTreasury.grantRole(_role, account);
    }

    function grantRole(bytes32 role, address account)
        public
        override(AccessControl, IRCTreasury)
    {
        if (role == WHITELIST) {
            // need to emit old event until frontend catches up
            emit LogWhitelistUser(account, true);
        }
        AccessControl.grantRole(role, account);
    }

    function revokeRole(string memory role, address account) external override {
        bytes32 _role = keccak256(abi.encodePacked(role));
        RCTreasury.revokeRole(_role, account);
    }

    function revokeRole(bytes32 role, address account)
        public
        override(AccessControl, IRCTreasury)
    {
        if (role == WHITELIST) {
            // need to emit old event until frontend catches up
            emit LogWhitelistUser(account, false);
        }
        AccessControl.revokeRole(role, account);
    }

    /*
         ▲  
        ▲ ▲ 
              */
}
