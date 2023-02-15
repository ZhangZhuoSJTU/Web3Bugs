// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "hardhat/console.sol";
import "./lib/NativeMetaTransaction.sol";
import "./interfaces/IRCTreasury.sol";
import "./interfaces/IRCMarket.sol";
import "./interfaces/IRCOrderbook.sol";

/// @title Reality Cards Orderbook
/// @author Daniel Chilvers
/// @notice If you have found a bug, please contact andrew@realitycards.io- no hack pls!!
contract RCOrderbook is Ownable, NativeMetaTransaction, IRCOrderbook {
    /*╔═════════════════════════════════╗
      ║            VARIABLES            ║
      ╚═════════════════════════════════╝*/

    /// @dev a record of a users single bid
    struct Bid {
        address market;
        address next;
        address prev;
        uint64 token;
        uint128 price;
        uint64 timeHeldLimit;
    }
    /// @dev maps a user address to an array of their bids
    mapping(address => Bid[]) public user;
    /// @dev index of a bid record in the user array, User|Market|Token->Index
    mapping(address => mapping(address => mapping(uint256 => uint256)))
        public index;

    /// @dev record of market specific variables
    struct Market {
        uint64 mode;
        uint64 tokenCount;
        uint64 minimumPriceIncreasePercent;
        uint64 minimumRentalDuration;
    }
    /// @dev map a market address to a market record
    mapping(address => Market) public market;
    /// @dev true if the address is a market
    mapping(address => bool) public isMarket;
    /// @dev find the current owner of a token in a given market. Market -> Token -> Owner
    mapping(address => mapping(uint256 => address)) public ownerOf;

    /// @dev an array of closed markets, used to reduce user bid rates
    address[] public closedMarkets;
    /// @dev how far through the array a given user is, saves iterating the whole array every time.
    mapping(address => uint256) public userClosedMarketIndex;

    ///// GOVERNANCE VARIABLES /////
    /// @dev only allow the uberOwner to call certain functions
    address public uberOwner;
    /// @dev the current factory address
    address public factoryAddress;
    /// @dev the current treasury address
    address public treasuryAddress;
    IRCTreasury public treasury;
    /// @dev max number of searches to place an order in the book
    /// @dev current estimates place limit around 2000
    uint256 public maxSearchIterations = 1000;
    /// @dev max number of records to delete in one transaction
    uint256 public maxDeletions = 70;
    /// @dev number of bids a user should clean when placing a new bid
    uint256 public cleaningLoops = 2;
    /// @dev nonce emitted with orderbook insertions, for frontend sorting
    uint256 public nonce;

    /*╔═════════════════════════════════╗
      ║          MODIFIERS              ║
      ╚═════════════════════════════════╝*/

    /// @notice only allow markets to call certain functions
    modifier onlyMarkets {
        require(isMarket[msgSender()], "Not authorised");
        _;
    }

    /*╔═════════════════════════════════╗
      ║            EVENTS               ║
      ╚═════════════════════════════════╝*/

    /// @dev emitted every time an order is added to the orderbook
    event LogAddToOrderbook(
        address indexed newOwner,
        uint256 indexed newPrice,
        uint256 timeHeldLimit,
        uint256 nonce,
        uint256 indexed tokenId,
        address market
    );
    /// @dev emitted when an order is removed from an active market
    event LogRemoveFromOrderbook(
        address indexed owner,
        address indexed market,
        uint256 indexed tokenId
    );

    /*╔═════════════════════════════════╗
      ║         CONSTRUCTOR             ║
      ╚═════════════════════════════════╝*/

    constructor(address _factoryAddress, address _treasuryAddress) {
        factoryAddress = _factoryAddress;
        treasuryAddress = _treasuryAddress;
        treasury = IRCTreasury(treasuryAddress);
        uberOwner = msgSender();
    }

    /*╔═════════════════════════════════╗
      ║         GOVERNANCE              ║
      ╚═════════════════════════════════╝*/

    function changeUberOwner(address _newUberOwner) external override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newUberOwner != address(0));
        uberOwner = _newUberOwner;
    }

    function setFactoryAddress(address _newFactory) external override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newFactory != address(0));
        factoryAddress = _newFactory;
    }

    function setLimits(
        uint256 _deletionLimit,
        uint256 _cleaningLimit,
        uint256 _searchLimit
    ) external override {
        require(msgSender() == uberOwner, "Extremely Verboten");
        if (_deletionLimit != 0) {
            maxDeletions = _deletionLimit;
        }
        if (_cleaningLimit != 0) {
            cleaningLoops = _cleaningLimit;
        }
        if (_searchLimit != 0) {
            maxSearchIterations = _searchLimit;
        }
    }

    /*╔═════════════════════════════════════╗
      ║             INSERTIONS              ║
      ║ functions that add to the orderbook ║
      ╚═════════════════════════════════════╝*/

    /// @notice adds a new market to the orderbook
    function addMarket(
        address _market,
        uint256 _cardCount,
        uint256 _minIncrease
    ) external override {
        require(msgSender() == factoryAddress);
        isMarket[_market] = true;
        market[_market].tokenCount = SafeCast.toUint64(_cardCount);
        market[_market].minimumPriceIncreasePercent = SafeCast.toUint64(
            _minIncrease
        );
        market[_market].minimumRentalDuration = SafeCast.toUint64(
            1 days / treasury.minRentalDayDivisor()
        );
        for (uint64 i; i < _cardCount; i++) {
            // create new record for each card that becomes the head&tail of the linked list
            Bid memory _newBid;
            _newBid.market = _market;
            _newBid.token = i;
            _newBid.prev = _market;
            _newBid.next = _market;
            _newBid.price = 0;
            _newBid.timeHeldLimit = type(uint64).max;
            index[_market][_market][i] = user[_market].length;
            user[_market].push(_newBid);
        }
    }

    /// @notice adds or updates a bid in the orderbook
    /// @param _user the user placing the bid
    /// @param _card the token to place the bid on
    /// @param _price the price of the new bid
    /// @param _timeHeldLimit an optional time limit for the bid
    /// @param _prevUserAddress to help find where to insert the bid
    function addBidToOrderbook(
        address _user,
        uint256 _card,
        uint256 _price,
        uint256 _timeHeldLimit,
        address _prevUserAddress
    ) external override onlyMarkets {
        // each new bid can help clean up some junk
        cleanWastePile();

        if (user[_user].length == 0 && closedMarkets.length > 0) {
            //users first bid, skip already closed markets
            userClosedMarketIndex[_user] = closedMarkets.length - 1;
        }

        address _market = msgSender();
        if (_prevUserAddress == address(0)) {
            _prevUserAddress = _market;
        } else {
            require(
                user[_prevUserAddress][index[_prevUserAddress][_market][_card]]
                    .price >= _price,
                "Location too low"
            );
        }
        Bid storage _prevUser =
            user[_prevUserAddress][index[_prevUserAddress][_market][_card]];

        if (bidExists(_user, _market, _card)) {
            // old bid exists, update it
            _updateBidInOrderbook(
                _user,
                _market,
                _card,
                _price,
                _timeHeldLimit,
                _prevUser
            );
        } else {
            // new bid, add it
            _newBidInOrderbook(
                _user,
                _market,
                _card,
                _price,
                _timeHeldLimit,
                _prevUser
            );
        }
    }

    /// @dev finds the correct location in the orderbook for a given bid
    /// @dev returns an adjusted (lowered) bid price if necessary.
    function _searchOrderbook(
        Bid storage _prevUser,
        address _market,
        uint256 _card,
        uint256 _price
    ) internal view returns (Bid storage, uint256) {
        uint256 _minIncrease = market[_market].minimumPriceIncreasePercent;
        Bid storage _nextUser =
            user[_prevUser.next][index[_prevUser.next][_market][_card]];
        uint256 _requiredPrice =
            (_nextUser.price * (_minIncrease + (100))) / (100);

        uint256 i = 0;
        while (
            // break loop if match price above AND above price below (so if either is false, continue, hence OR )
            // if match previous then must be greater than next to continue
            (_price != _prevUser.price || _price <= _nextUser.price) &&
            // break loop if price x% above below
            _price < _requiredPrice &&
            // break loop if hits max iterations
            i < maxSearchIterations
        ) {
            _prevUser = _nextUser;
            _nextUser = user[_prevUser.next][
                index[_prevUser.next][_market][_card]
            ];
            _requiredPrice = (_nextUser.price * (_minIncrease + (100))) / (100);
            i++;
        }
        require(i < maxSearchIterations, "Position in orderbook not found");

        // if previous price is zero it must be the market and this is a new owner
        // .. then don't reduce their price, we already checked they are 10% higher
        // .. than the previous owner.
        if (_prevUser.price != 0 && _prevUser.price < _price) {
            _price = _prevUser.price;
        }
        return (_prevUser, _price);
    }

    /// @dev add a new bid to the orderbook
    function _newBidInOrderbook(
        address _user,
        address _market,
        uint256 _card,
        uint256 _price,
        uint256 _timeHeldLimit,
        Bid storage _prevUser
    ) internal {
        if (ownerOf[_market][_card] != _market) {
            (_prevUser, _price) = _searchOrderbook(
                _prevUser,
                _market,
                _card,
                _price
            );
        }

        Bid storage _nextUser =
            user[_prevUser.next][index[_prevUser.next][_market][_card]];

        // create new record
        Bid memory _newBid;
        _newBid.market = _market;
        _newBid.token = SafeCast.toUint64(_card);
        _newBid.prev = _nextUser.prev;
        _newBid.next = _prevUser.next;
        _newBid.price = SafeCast.toUint128(_price);
        _newBid.timeHeldLimit = SafeCast.toUint64(_timeHeldLimit);

        // insert in linked list
        _nextUser.prev = _user; // next record update prev link
        _prevUser.next = _user; // prev record update next link
        user[_user].push(_newBid);

        // update the index to help find the record later
        index[_user][_market][_card] = user[_user].length - (1);

        emit LogAddToOrderbook(
            _user,
            _price,
            _timeHeldLimit,
            nonce,
            _card,
            _market
        );
        nonce++;

        // update treasury values and transfer ownership if required
        treasury.increaseBidRate(_user, _price);
        if (user[_user][index[_user][_market][_card]].prev == _market) {
            address _oldOwner = user[_user][index[_user][_market][_card]].next;
            transferCard(_market, _card, _oldOwner, _user, _price);
            treasury.updateRentalRate(
                _oldOwner,
                _user,
                user[_oldOwner][index[_oldOwner][_market][_card]].price,
                _price,
                block.timestamp
            );
        }
    }

    /// @dev updates a bid that is already in the orderbook
    function _updateBidInOrderbook(
        address _user,
        address _market,
        uint256 _card,
        uint256 _price,
        uint256 _timeHeldLimit,
        Bid storage _prevUser
    ) internal {
        // TODO no need to unlink and relink if bid doesn't change position in orderbook
        // unlink current bid
        Bid storage _currUser = user[_user][index[_user][_market][_card]];
        user[_currUser.next][index[_currUser.next][_market][_card]]
            .prev = _currUser.prev;
        user[_currUser.prev][index[_currUser.prev][_market][_card]]
            .next = _currUser.next;
        bool _owner = _currUser.prev == _market;

        // find new position
        (_prevUser, _price) = _searchOrderbook(
            _prevUser,
            _market,
            _card,
            _price
        );
        Bid storage _nextUser =
            user[_prevUser.next][index[_prevUser.next][_market][_card]];

        // update price, save old price for rental rate adjustment later
        (_currUser.price, _price) = (
            SafeCast.toUint128(_price),
            uint256(_currUser.price)
        );
        _currUser.timeHeldLimit = SafeCast.toUint64(_timeHeldLimit);

        // relink bid
        _currUser.next = _prevUser.next;
        _currUser.prev = _nextUser.prev;
        _nextUser.prev = _user; // next record update prev link
        _prevUser.next = _user; // prev record update next link

        emit LogAddToOrderbook(
            _user,
            _currUser.price,
            _timeHeldLimit,
            nonce,
            _card,
            _market
        );
        nonce++;

        // update treasury values and transfer ownership if required
        treasury.increaseBidRate(_user, _currUser.price);
        treasury.decreaseBidRate(_user, _price);
        if (_owner && _currUser.prev == _market) {
            // if owner before and after, update the price difference
            transferCard(_market, _card, _user, _user, _currUser.price);
            treasury.updateRentalRate(
                _user,
                _user,
                _price,
                _currUser.price,
                block.timestamp
            );
        } else if (_owner && _currUser.prev != _market) {
            // if owner before and not after, remove the old price
            address _newOwner =
                user[_market][index[_market][_market][_card]].next;
            uint256 _newPrice =
                user[_newOwner][index[_newOwner][_market][_card]].price;
            treasury.updateRentalRate(
                _user,
                _newOwner,
                _price,
                _newPrice,
                block.timestamp
            );
            transferCard(_market, _card, _user, _newOwner, _newPrice);
        } else if (!_owner && _currUser.prev == _market) {
            // if not owner before but is owner after, add new price
            address _oldOwner = _currUser.next;
            uint256 _oldPrice =
                user[_oldOwner][index[_oldOwner][_market][_card]].price;
            treasury.updateRentalRate(
                _oldOwner,
                _user,
                _oldPrice,
                _currUser.price,
                block.timestamp
            );
            transferCard(_market, _card, _oldOwner, _user, _currUser.price);
        }
    }

    /*╔══════════════════════════════════════════╗
      ║                DELETIONS                 ║      
      ║ functions that remove from the orderbook ║
      ╚══════════════════════════════════════════╝*/

    /// @notice removes a single bid from the orderbook - onlyMarkets
    function removeBidFromOrderbook(address _user, uint256 _card)
        public
        override
        onlyMarkets
    {
        address _market = msgSender();
        // update rates
        Bid storage _currUser = user[_user][index[_user][_market][_card]];
        treasury.decreaseBidRate(_user, _currUser.price);
        if (_currUser.prev == _market) {
            // user is owner, deal with it
            uint256 _price =
                user[_currUser.next][index[_currUser.next][_market][_card]]
                    .price;
            transferCard(_market, _card, _user, _currUser.next, _price);
            treasury.updateRentalRate(
                _user,
                _currUser.next,
                _currUser.price,
                _price,
                block.timestamp
            );
        }
        // extract from linked list
        address _tempNext = _currUser.next;
        address _tempPrev = _currUser.prev;
        user[_tempNext][index[_tempNext][_market][_card]].prev = _tempPrev;
        user[_tempPrev][index[_tempPrev][_market][_card]].next = _tempNext;

        // overwrite array element
        uint256 _index = index[_user][_market][_card];
        uint256 _lastRecord = user[_user].length - (1);

        // no point overwriting itself
        if (_index != _lastRecord) {
            user[_user][_index] = user[_user][_lastRecord];
        }
        user[_user].pop();

        // update the index to help find the record later
        index[_user][_market][_card] = 0;
        if (user[_user].length != 0 && _index != _lastRecord) {
            index[_user][user[_user][_index].market][
                user[_user][_index].token
            ] = _index;
        }
        emit LogRemoveFromOrderbook(_user, _market, _card);
    }

    /// @dev removes a single bid from the orderbook, doesn't update ownership
    function _removeBidFromOrderbookIgnoreOwner(address _user, uint256 _card)
        internal
        returns (uint256 _newPrice)
    {
        address _market = msgSender();
        // update rates
        Bid storage _currUser = user[_user][index[_user][_market][_card]];
        treasury.decreaseBidRate(_user, _currUser.price);

        // extract from linked list
        address _tempNext = _currUser.next;
        address _tempPrev = _currUser.prev;
        user[_tempNext][index[_tempNext][_market][_card]].prev = _tempPrev;
        user[_tempPrev][index[_tempPrev][_market][_card]].next = _tempNext;

        // return next users price to check they're eligable later
        _newPrice = user[_tempNext][index[_tempNext][_market][_card]].price;

        // overwrite array element
        uint256 _index = index[_user][_market][_card];
        uint256 _lastRecord = user[_user].length - 1;
        // no point overwriting itself
        if (_index != _lastRecord) {
            user[_user][_index] = user[_user][_lastRecord];
        }
        user[_user].pop();

        // update the index to help find the record later
        index[_user][_market][_card] = 0;
        if (user[_user].length != 0 && _index != _lastRecord) {
            index[_user][user[_user][_index].market][
                user[_user][_index].token
            ] = _index;
        }
        emit LogRemoveFromOrderbook(_user, _market, _card);
    }

    /// @notice find the next valid owner of a given card - onlyMarkets
    /// @param _card the token to remove
    /// @param _timeOwnershipChanged the timestamp, used to backdate ownership changes
    function findNewOwner(uint256 _card, uint256 _timeOwnershipChanged)
        external
        override
        onlyMarkets
        returns (address _newOwner)
    {
        address _market = msgSender();
        // the market is the head of the list, the next bid is therefore the owner
        Bid storage _head = user[_market][index[_market][_market][_card]];
        address _oldOwner = _head.next;
        uint256 _oldPrice =
            user[_oldOwner][index[_oldOwner][_market][_card]].price;
        uint256 minimumTimeToOwnTo =
            _timeOwnershipChanged + market[_market].minimumRentalDuration;
        uint256 _newPrice;

        // delete current owner
        do {
            _newPrice = _removeBidFromOrderbookIgnoreOwner(_head.next, _card);
            // delete next bid if foreclosed
        } while (
            treasury.foreclosureTimeUser(
                _head.next,
                _newPrice,
                _timeOwnershipChanged
            ) < minimumTimeToOwnTo
        );

        // the old owner is dead, long live the new owner
        _newOwner = user[_market][index[_market][_market][_card]].next;
        treasury.updateRentalRate(
            _oldOwner,
            _newOwner,
            _oldPrice,
            _newPrice,
            _timeOwnershipChanged
        );
        transferCard(_market, _card, _oldOwner, _newOwner, _newPrice);
    }

    /// @notice when a user has foreclosed we can freely delete their bids
    /// @param _user the user whose bids to start deleting
    /// @return _userForeclosed if the user doesn't have bids left they are considered not foreclosed anymore
    function removeUserFromOrderbook(address _user)
        external
        override
        returns (bool _userForeclosed)
    {
        require(treasury.isForeclosed(_user), "User must be foreclosed");
        uint256 i = user[_user].length;
        uint256 _limit = 0;
        if (i > maxDeletions) {
            _limit = i - maxDeletions;
        }
        address _market = user[_user][i - 1].market;
        uint256 _card = user[_user][i - 1].token;

        do {
            i--;
            index[_user][user[_user][i].market][user[_user][i].token] = 0;
            address _tempPrev = user[_user][i].prev;
            address _tempNext = user[_user][i].next;

            // reduce the rentalRate if they are owner
            if (_tempPrev == user[_user][i].market) {
                _market = user[_user][i].market;
                _card = user[_user][i].token;
                uint256 _price =
                    user[_tempNext][index[_tempNext][_market][_card]].price;
                treasury.updateRentalRate(
                    _user,
                    _tempNext,
                    user[_user][i].price,
                    _price,
                    block.timestamp
                );
                transferCard(_market, _card, _user, _tempNext, _price);
            }

            treasury.decreaseBidRate(_user, user[_user][i].price);

            user[_tempNext][
                index[_tempNext][user[_user][i].market][user[_user][i].token]
            ]
                .prev = _tempPrev;
            user[_tempPrev][
                index[_tempPrev][user[_user][i].market][user[_user][i].token]
            ]
                .next = _tempNext;
            user[_user].pop();
        } while (user[_user].length > _limit);
        if (user[_user].length == 0) {
            treasury.resetUser(_user);
            _userForeclosed = false;
        } else {
            _userForeclosed = true;
        }
    }

    /// @notice reduces the rentalRates of the card owners when a market closes
    /// @dev too many bidders to reduce all bid rates also
    function closeMarket() external override onlyMarkets {
        address _market = msgSender();
        closedMarkets.push(_market);

        for (uint64 i = 0; i < market[_market].tokenCount; i++) {
            // reduce owners rental rate
            address _owner = user[_market][index[_market][_market][i]].next;
            uint256 _price = user[_owner][index[_owner][_market][i]].price;
            treasury.updateRentalRate(
                _owner,
                _market,
                _price,
                0,
                block.timestamp
            );

            // store first and last bids for later
            address _firstBid = _owner;
            address _lastBid = user[_market][index[_market][_market][i]].prev;

            // detach market from rest of list
            user[_market][index[_market][_market][i]].prev = _market;
            user[_market][index[_market][_market][i]].next = _market;
            user[_firstBid][index[_market][_firstBid][i]].prev = address(this);
            user[_lastBid][index[_market][_lastBid][i]].next = address(this);

            // insert bids in the waste pile
            Bid memory _newBid;
            _newBid.market = _market;
            _newBid.token = i;
            _newBid.prev = _lastBid;
            _newBid.next = _firstBid;
            _newBid.price = 0;
            _newBid.timeHeldLimit = 0;
            user[address(this)].push(_newBid);
        }
    }

    /// @notice Remove bids in closed markets for a given user
    /// @notice this can reduce the users bidRate and chance to foreclose
    /// @param _user the address of the users bids to remove
    function removeOldBids(address _user) external override {
        address _market;
        uint256 _cardCount;
        uint256 _loopCounter;
        while (
            userClosedMarketIndex[_user] < closedMarkets.length &&
            _loopCounter + _cardCount < maxDeletions
        ) {
            _market = closedMarkets[userClosedMarketIndex[_user]];
            _cardCount = market[_market].tokenCount;
            for (uint256 i = market[_market].tokenCount; i != 0; ) {
                i--;
                if (bidExists(_user, _market, i)) {
                    // reduce bidRate
                    uint256 _price =
                        user[_user][index[_user][_market][i]].price;
                    treasury.decreaseBidRate(_user, _price);

                    // preserve linked list
                    address _tempPrev =
                        user[_user][index[_user][_market][i]].prev;
                    address _tempNext =
                        user[_user][index[_user][_market][i]].next;

                    user[_tempNext][index[_tempNext][_market][i]]
                        .prev = _tempPrev;
                    user[_tempPrev][index[_tempPrev][_market][i]]
                        .next = _tempNext;

                    // delete bid
                    user[_user].pop();
                    index[_user][_market][i] = 0;

                    // count deletions
                    _loopCounter++;
                }
            }
            userClosedMarketIndex[_user]++;
        }
    }

    /// @dev remove bids in closed markets, not user specific
    function cleanWastePile() internal {
        uint256 i;
        while (i < cleaningLoops && user[address(this)].length > 0) {
            uint256 _pileHeight = user[address(this)].length - 1;

            if (user[address(this)][_pileHeight].next == address(this)) {
                user[address(this)].pop();
            } else {
                address _market = user[address(this)][_pileHeight].market;
                uint256 _card = user[address(this)][_pileHeight].token;
                address _user =
                    user[address(this)][index[address(this)][_market][_card]]
                        .next;

                Bid storage _currUser =
                    user[_user][index[_user][_market][_card]];
                // extract from linked list
                address _tempNext = _currUser.next;
                address _tempPrev = _currUser.prev;
                user[_tempNext][index[_tempNext][_market][_card]]
                    .prev = _tempPrev;
                user[_tempPrev][index[_tempPrev][_market][_card]]
                    .next = _tempNext;

                // overwrite array element
                uint256 _index = index[_user][_market][_card];
                uint256 _lastRecord = user[_user].length - (1);
                // no point overwriting itself
                if (_index != _lastRecord) {
                    user[_user][_index] = user[_user][_lastRecord];
                }
                user[_user].pop();

                // update the index to help find the record later
                index[_user][_market][_card] = 0;
                if (user[_user].length != 0 && _index != _lastRecord) {
                    index[_user][user[_user][_index].market][
                        user[_user][_index].token
                    ] = _index;
                }
            }
            i++;
        }
    }

    /*╔═════════════════════════════════╗
      ║        HELPER FUNCTIONS         ║
      ╚═════════════════════════════════╝*/

    /// @notice check if a bid exists
    /// @param _user the address of the user
    /// @param _market the address of the market
    /// @param _card the card index
    /// @return if the bid exists or not
    function bidExists(
        address _user,
        address _market,
        uint256 _card
    ) public view override returns (bool) {
        if (user[_user].length != 0) {
            //some bids exist
            if (index[_user][_market][_card] != 0) {
                // this bid exists
                return true;
            } else {
                // check bid isn't index 0
                if (
                    user[_user][0].market == _market &&
                    user[_user][0].token == _card
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    function getBidValue(address _user, uint256 _card)
        external
        view
        override
        returns (uint256)
    {
        address _market = msgSender();
        if (bidExists(_user, _market, _card)) {
            return user[_user][index[_user][_market][_card]].price;
        } else {
            return 0;
        }
    }

    /// @dev just to pass old tests, not needed otherwise
    /// @dev to be deleted once tests updated
    function getBid(
        address _market,
        address _user,
        uint256 _card
    ) external view returns (Bid memory) {
        if (bidExists(_user, _market, _card)) {
            Bid memory _bid = user[_user][index[_user][_market][_card]];
            return _bid;
        } else {
            Bid memory _newBid;
            _newBid.market = address(0);
            _newBid.token = SafeCast.toUint64(_card);
            _newBid.prev = address(0);
            _newBid.next = address(0);
            _newBid.price = 0;
            _newBid.timeHeldLimit = 0;
            return _newBid;
        }
    }

    function getTimeHeldlimit(address _user, uint256 _card)
        external
        view
        override
        onlyMarkets
        returns (uint256)
    {
        return user[_user][index[_user][msgSender()][_card]].timeHeldLimit;
    }

    function setTimeHeldlimit(
        address _user,
        uint256 _card,
        uint256 _timeHeldLimit
    ) external override onlyMarkets {
        address _market = msgSender();
        require(bidExists(_user, _market, _card), "Bid doesn't exist");
        user[_user][index[_user][_market][_card]].timeHeldLimit = SafeCast
            .toUint64(_timeHeldLimit);
    }

    function reduceTimeHeldLimit(
        address _user,
        uint256 _card,
        uint256 _timeToReduce
    ) external override onlyMarkets {
        user[_user][index[_user][msgSender()][_card]].timeHeldLimit -= SafeCast
            .toUint64(_timeToReduce);
    }

    function transferCard(
        address _market,
        uint256 _card,
        address _oldOwner,
        address _newOwner,
        uint256 _price
    ) internal {
        ownerOf[_market][_card] = _newOwner;
        uint256 _timeLimit =
            user[_newOwner][index[_newOwner][_market][_card]].timeHeldLimit;
        IRCMarket _rcmarket = IRCMarket(_market);
        _rcmarket.transferCard(_oldOwner, _newOwner, _card, _price, _timeLimit);
    }
    /*
         ▲  
        ▲ ▲ 
              */
}
