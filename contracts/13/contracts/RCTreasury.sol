// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
contract RCTreasury is Ownable, NativeMetaTransaction, IRCTreasury {
    /*╔═════════════════════════════════╗
      ║             VARIABLES           ║
      ╚═════════════════════════════════╝*/
    /// @dev orderbook instance, to remove users bids on foreclosure
    IRCOrderbook public orderbook;
    /// @dev nfthub instance, to query current card owner
    IRCNftHubL2 public nfthub;
    /// @dev token contract
    IERC20 public override erc20;
    /// @dev address of (as yet non existent) Bridge for withdrawals to mainnet
    address public override bridgeAddress;
    /// @dev address of the Factory so only the Factory can add new markets
    address public override factoryAddress;
    /// @dev so only markets can use certain functions
    mapping(address => bool) public override isMarket;
    /// @dev sum of all deposits
    uint256 public override totalDeposits;
    /// @dev the rental payments made in each market
    mapping(address => uint256) public override marketPot;
    /// @dev sum of all market pots
    uint256 public override totalMarketPots;
    /// @dev rent taken and allocated to a particular market
    uint256 public marketBalance;
    /// @dev a quick check if a uesr is foreclosed
    mapping(address => bool) public override isForeclosed;
    /// @dev to keep track of the size of the rounding issue between rent collections
    uint256 marketBalanceDiscrepancy;

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
    mapping(address => bool) public isAllowed;
    bool public whitelistEnabled;

    /*╔═════════════════════════════════╗
      ║             SAFETY              ║
      ╚═════════════════════════════════╝*/
    /// @dev if true, cannot deposit, withdraw or rent any cards across all events
    bool public override globalPause;
    /// @dev if true, cannot rent any cards for specific market
    mapping(address => bool) public override marketPaused;

    /*╔═════════════════════════════════╗
      ║            UBER OWNER           ║
      ╚═════════════════════════════════╝*/
    /// @dev high level owner who can change the factory address
    address public override uberOwner;

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

    /*╔═════════════════════════════════╗
      ║           CONSTRUCTOR           ║
      ╚═════════════════════════════════╝*/

    constructor(address _tokenAddress) {
        // initialise MetaTransactions
        _initializeEIP712("RealityCardsTreasury", "1");

        // at initiation, uberOwner and owner will be the same
        uberOwner = msgSender();

        // initialise adjustable parameters
        setMinRental(24 * 6); // MinRental is a divisor of 1 day(86400 seconds), 24*6 will set to 10 minutes
        setMaxContractBalance(1000000 ether); // 1m
        setTokenAddress(_tokenAddress);
        whitelistEnabled = true;
    }

    /*╔═════════════════════════════════╗
      ║           MODIFIERS             ║
      ╚═════════════════════════════════╝*/

    /// @notice check that funds haven't gone missing during this function call
    modifier balancedBooks {
        _;
        // using >= not == in case anyone sends tokens direct to contract
        require(
            erc20.balanceOf(address(this)) >=
                totalDeposits + marketBalance + totalMarketPots,
            "Books are unbalanced!"
        );
    }

    /// @notice only allow markets to call these functions
    modifier onlyMarkets {
        require(isMarket[msgSender()], "Not authorised");
        _;
    }

    /// @notice only allow orderbook to call these functions
    modifier onlyOrderbook {
        require(msgSender() == address(orderbook), "Not authorised");
        _;
    }

    /*╔═════════════════════════════════╗
      ║           ADD MARKETS           ║
      ╚═════════════════════════════════╝*/

    /// @dev so only markets can move funds from deposits to marketPots and vice versa
    function addMarket(address _newMarket) external override {
        require(msgSender() == factoryAddress, "Not factory");
        isMarket[_newMarket] = true;
    }

    /*╔═════════════════════════════════╗
      ║       GOVERNANCE - OWNER        ║
      ╚═════════════════════════════════╝*/

    /// @dev all functions should be onlyOwner
    // min rental event emitted by market. Nothing else need be emitted.

    /*┌────────────────────────────────────┐
      │ CALLED WITHIN CONSTRUTOR - PUBLIC  │
      └────────────────────────────────────┘*/

    /// @notice minimum rental duration (1 day divisor: i.e. 24 = 1 hour, 48 = 30 mins)
    /// @param _newDivisor the divisor to set
    function setMinRental(uint256 _newDivisor) public override onlyOwner {
        minRentalDayDivisor = _newDivisor;
    }

    /// @notice set max deposit balance, to minimise funds at risk
    /// @param _newBalanceLimit the max balance to set in wei
    function setMaxContractBalance(uint256 _newBalanceLimit)
        public
        override
        onlyOwner
    {
        maxContractBalance = _newBalanceLimit;
    }

    /*┌──────────────────────────────────────────┐
      │ NOT CALLED WITHIN CONSTRUTOR - EXTERNAL  │
      └──────────────────────────────────────────┘*/

    /// @notice if true, cannot deposit, withdraw or rent any cards
    function changeGlobalPause() external override onlyOwner {
        globalPause = !globalPause;
        emit LogGlobalPause(globalPause);
    }

    /// @notice if true, cannot make a new rental for a specific market
    function changePauseMarket(address _market) external override onlyOwner {
        require(isMarket[_market], "This isn't a market");
        marketPaused[_market] = !marketPaused[_market];
        emit LogMarketPaused(_market, marketPaused[_market]);
    }

    /*╔═════════════════════════════════╗
      ║      WHITELIST FUNCTIONS        ║
      ╚═════════════════════════════════╝*/

    /// @notice if true, users must be on the whitelist to deposit
    function toggleWhitelist() external override onlyOwner {
        whitelistEnabled = !whitelistEnabled;
    }

    /// @notice Add a user to the whitelist
    function addToWhitelist(address _user) public override {
        IRCFactory factory = IRCFactory(factoryAddress);
        require(factory.isGovernor(msgSender()), "Not authorised");
        isAllowed[_user] = !isAllowed[_user];
    }

    /// @notice Add multiple users to the whitelist
    function batchAddToWhitelist(address[] calldata _users) public override {
        for (uint256 index = 0; index < _users.length; index++) {
            addToWhitelist(_users[index]);
        }
    }

    /*╔═════════════════════════════════╗
      ║     GOVERNANCE - UBER OWNER     ║
      ╠═════════════════════════════════╣
      ║  ******** DANGER ZONE ********  ║
      ╚═════════════════════════════════╝*/
    /// @dev uber owner required for upgrades
    /// @dev deploying and setting a new factory is effectively an upgrade
    /// @dev this is seperated so owner so can be set to multisig, or burn address to relinquish upgrade ability
    /// @dev ... while maintaining governance over other governanace functions

    function setFactoryAddress(address _newFactory) external override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newFactory != address(0), "Must set an address");
        factoryAddress = _newFactory;
    }

    function setOrderbookAddress(address _newOrderbook) external {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newOrderbook != address(0), "Must set an address");
        orderbook = IRCOrderbook(_newOrderbook);
    }

    function setNftHubAddress(address _NFTHubAddress) external {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_NFTHubAddress != address(0), "Must set an address");
        nfthub = IRCNftHubL2(_NFTHubAddress);
    }

    function setTokenAddress(address _newToken) public override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newToken != address(0), "Must set an address");
        erc20 = IERC20(_newToken);
    }

    function setBridgeAddress(address _newBridge) public override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newBridge != address(0), "Must set an address");
        bridgeAddress = _newBridge;
        erc20.approve(_newBridge, type(uint256).max);
    }

    function changeUberOwner(address _newUberOwner) external override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newUberOwner != address(0), "Must set an address");
        uberOwner = _newUberOwner;
    }

    /*╔═════════════════════════════════╗
      ║ DEPOSIT AND WITHDRAW FUNCTIONS  ║
      ╚═════════════════════════════════╝*/

    /// @notice deposit tokens into RealityCards
    /// @dev it is passed the user instead of using msg.sender because might be called
    /// @dev ... via contract (newRental) or Layer1->Layer2 bot
    /// @param _user the user to credit the deposit to
    /// @param _amount the amount to deposit, must be approved
    function deposit(uint256 _amount, address _user)
        public
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
            require(isAllowed[msgSender()], "Not in whitelist");
        }
        erc20.transferFrom(msgSender(), address(this), _amount);

        // do some cleaning up, it might help cancel their foreclosure
        orderbook.removeOldBids(_user);

        user[_user].deposit += SafeCast.toUint128(_amount);
        totalDeposits += _amount;
        emit LogAdjustDeposit(_user, _amount, true);

        // this deposit could cancel the users foreclosure
        if (
            (user[_user].deposit + _amount) >
            (user[_user].bidRate / minRentalDayDivisor)
        ) {
            isForeclosed[_user] = false;
            emit LogUserForeclosed(_user, false);
        }
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

        // stpe 1: collect rent on owned cards
        collectRentUser(_msgSender, block.timestamp);

        // step 2: process withdrawal
        if (_amount > user[_msgSender].deposit) {
            _amount = user[_msgSender].deposit;
        }
        emit LogAdjustDeposit(_msgSender, _amount, false);
        user[_msgSender].deposit -= SafeCast.toUint128(_amount);
        totalDeposits -= _amount;
        if (_localWithdrawal) {
            erc20.transfer(_msgSender, _amount);
        } else {
            IRCBridge bridge = IRCBridge(bridgeAddress);
            bridge.withdrawToMainnet(_msgSender, _amount);
        }

        // step 3: remove bids if insufficient deposit
        if (
            user[_msgSender].bidRate != 0 &&
            user[_msgSender].bidRate / (minRentalDayDivisor) >
            user[_msgSender].deposit
        ) {
            isForeclosed[_msgSender] = true;
            isForeclosed[_msgSender] = orderbook.removeUserFromOrderbook(
                _msgSender
            );
            emit LogUserForeclosed(_msgSender, isForeclosed[_msgSender]);
        }
    }

    /// @notice to increase the market balance
    /// @dev not strictly required but prevents markets being shortchanged due to rounding issues
    function topupMarketBalance(uint256 _amount) external override {
        erc20.transferFrom(msgSender(), address(this), _amount);
        if (_amount > marketBalanceDiscrepancy) {
            marketBalanceDiscrepancy = 0;
        } else {
            marketBalanceDiscrepancy -= _amount;
        }
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
        onlyMarkets
        returns (bool)
    {
        require(!globalPause, "Rentals are disabled");
        if (marketBalance < _amount) {
            marketBalanceDiscrepancy += _amount - marketBalance;
            _amount -= (_amount - marketBalance);
        }
        address _market = msgSender();
        marketBalance -= _amount;
        marketPot[_market] += _amount;
        totalMarketPots += _amount;

        return true;
    }

    /// @notice a payout is equivalent to moving from market pot to user's deposit (the opposite of payRent)
    /// @param _user the user to query
    /// @param _amount amount to payout in wei
    function payout(address _user, uint256 _amount)
        external
        override
        balancedBooks
        onlyMarkets
        returns (bool)
    {
        require(!globalPause, "Payouts are disabled");
        assert(marketPot[msgSender()] >= _amount);
        user[_user].deposit += SafeCast.toUint128(_amount);
        marketPot[msgSender()] -= _amount;
        totalMarketPots -= _amount;
        totalDeposits += _amount;
        emit LogAdjustDeposit(_user, _amount, true);
        return true;
    }

    /// @dev called by _collectRentAction() in the market in situations where collectRentUser() collected too much rent
    function refundUser(address _user, uint256 _refund)
        external
        override
        onlyMarkets
    {
        marketBalance -= _refund;
        user[_user].deposit += SafeCast.toUint128(_refund);
        totalDeposits += _refund;
        emit LogAdjustDeposit(_user, _refund, true);
        if (
            isForeclosed[_user] &&
            user[_user].deposit > user[_user].bidRate / minRentalDayDivisor
        ) {
            isForeclosed[_user] = false;
            emit LogUserForeclosed(_user, false);
        }
    }

    /// @notice ability to add liqudity to the pot without being able to win (called by market sponsor function).
    function sponsor(address _sponsor, uint256 _amount)
        external
        override
        balancedBooks
        onlyMarkets
        returns (bool)
    {
        require(!globalPause, "Global Pause is Enabled");
        require(
            erc20.allowance(_sponsor, address(this)) >= _amount,
            "Not approved to send this amount"
        );
        erc20.transferFrom(_sponsor, address(this), _amount);
        marketPot[msgSender()] += _amount;
        totalMarketPots += _amount;
        return true;
    }

    /// @notice tracks when the user last rented- so they cannot rent and immediately withdraw,
    /// @notice ..thus bypassing minimum rental duration
    /// @param _user the user to query
    function updateLastRentalTime(address _user)
        external
        override
        onlyMarkets
        returns (bool)
    {
        user[_user].lastRentalTime = SafeCast.toUint64(block.timestamp);
        if (user[_user].lastRentCalc == 0) {
            user[_user].lastRentCalc = SafeCast.toUint64(block.timestamp);
        }
        return true;
    }

    /*╔═════════════════════════════════╗
      ║        MARKET HELPERS           ║
      ╚═════════════════════════════════╝*/

    /// @notice provides the sum total of a users bids accross all markets (whether active or not)
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
    ) external override onlyOrderbook {
        if (
            _timeOwnershipChanged != user[_newOwner].lastRentCalc &&
            !isMarket[_newOwner]
        ) {
            // The new owners rent must be collected before adjusting their rentalRate
            // See if the new owner has had a rent collection before or after this ownership change
            if (_timeOwnershipChanged < user[_newOwner].lastRentCalc) {
                // the new owner has a more recent rent collection

                uint256 _additionalRentOwed =
                    rentOwedBetweenTimestmaps(
                        block.timestamp,
                        _timeOwnershipChanged,
                        _newPrice
                    );
                collectRentUser(_newOwner, block.timestamp);

                // they have enough funds, just collect the extra
                _increaseMarketBalance(_additionalRentOwed, _newOwner);
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
        onlyOrderbook
    {
        user[_user].bidRate += SafeCast.toUint128(_price);
    }

    /// @dev decrease bidRate when bid removed
    function decreaseBidRate(address _user, uint256 _price)
        external
        override
        onlyOrderbook
    {
        user[_user].bidRate -= SafeCast.toUint128(_price);
    }

    /// @dev called when all a user's bids have been removed, disables foreclosure state
    function resetUser(address _user) external override onlyOrderbook {
        isForeclosed[_user] = false;
    }

    /*╔═════════════════════════════════╗
      ║      RENT CALC HELPERS          ║
      ╚═════════════════════════════════╝*/

    /// @notice returns the rent due between the users last rent calcualtion and
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

    /// @notice calcualtes the rent owed between the given timestamps
    /// @param _time1 one of the timestamps
    /// @param _time2 the second timestamp
    /// @param _price the rental rate for this time period
    /// @param _rent the rent due for this time period
    /// @dev the timestamps can be given in any order
    function rentOwedBetweenTimestmaps(
        uint256 _time1,
        uint256 _time2,
        uint256 _price
    ) internal pure returns (uint256 _rent) {
        if (_time1 < _time2) {
            (_time1, _time2) = (_time2, _time1);
        }
        _rent = (_price * (_time1 - _time2)) / (1 days);
    }

    /// @notice returns the amount of deposit a user is able to withdraw
    /// @notice ..after considering rent due to be paid
    /// @param _user the user to query
    function depositAbleToWithdraw(address _user)
        internal
        view
        returns (uint256)
    {
        uint256 collection = rentOwedUser(_user, block.timestamp);
        if (collection >= user[_user].deposit) {
            return 0;
        } else {
            return uint256(user[_user].deposit) - (collection);
        }
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
            // timeLeftOfDeposit = deposit / (totalUserDailyRent / 1 day)
            //                   = (deposit * 1day) / totalUserDailyRent
            uint256 timeLeftOfDeposit =
                (depositAbleToWithdraw(_user) * 1 days) / totalUserDailyRent;

            uint256 foreclosureTimeWithoutNewCard =
                user[_user].lastRentCalc + timeLeftOfDeposit;

            if (foreclosureTimeWithoutNewCard > _timeOfNewBid) {
                // calculate how long they can own the new card for
                uint256 _rentAlreadyOwed =
                    rentOwedBetweenTimestmaps(
                        user[_user].lastRentCalc,
                        _timeOfNewBid,
                        totalUserDailyRent
                    );
                uint256 _depositAtTimeOfNewBid =
                    user[_user].deposit - _rentAlreadyOwed;
                uint256 _timeLeftOfDepositWithNewBid =
                    (_depositAtTimeOfNewBid * 1 days) /
                        (totalUserDailyRent + _newBid);
                return _timeOfNewBid + _timeLeftOfDepositWithNewBid;
            } else {
                return user[_user].lastRentCalc + timeLeftOfDeposit;
            }
        } else {
            // if no rentals they'll foreclose after the heat death of the universe
            return type(uint256).max;
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
        assert(_timeToCollectTo != 0);
        if (user[_user].lastRentCalc < _timeToCollectTo) {
            uint256 rentOwedByUser = rentOwedUser(_user, _timeToCollectTo);

            if (rentOwedByUser > 0 && rentOwedByUser > user[_user].deposit) {
                // The User has run out of deposit already.
                uint256 previousCollectionTime = user[_user].lastRentCalc;

                /*
            timeTheirDepsitLasted = timeSinceLastUpdate * (usersDeposit/rentOwed)
                                  = (now - previousCollectionTime) * (usersDeposit/rentOwed)
            */
                uint256 timeUsersDepositLasts =
                    ((_timeToCollectTo - previousCollectionTime) *
                        uint256(user[_user].deposit)) / rentOwedByUser;
                /*
            Users last collection time = previousCollectionTime + timeTheirDepsitLasted
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

    /// moving from the user deposit to the markets availiable balance
    function _increaseMarketBalance(uint256 rentCollected, address _user)
        internal
    {
        marketBalance += rentCollected;
        user[_user].deposit -= SafeCast.toUint128(rentCollected);
        totalDeposits -= rentCollected;
    }
    /*
         ▲  
        ▲ ▲ 
              */
}
