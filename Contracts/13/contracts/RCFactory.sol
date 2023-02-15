// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "hardhat/console.sol";
import "./interfaces/IRCFactory.sol";
import "./interfaces/IRCTreasury.sol";
import "./interfaces/IRCMarket.sol";
import "./interfaces/IRCNftHubL2.sol";
import "./interfaces/IRCOrderbook.sol";
import "./lib/NativeMetaTransaction.sol";
import "./interfaces/IRealitio.sol";

/// @title Reality Cards Factory
/// @author Andrew Stanger & Daniel Chilvers
/// @notice If you have found a bug, please contact andrew@realitycards.io- no hack pls!!
contract RCFactory is Ownable, NativeMetaTransaction, IRCFactory {
    /*╔═════════════════════════════════╗
      ║           VARIABLES             ║
      ╚═════════════════════════════════╝*/

    //≡≡≡≡≡≡≡ CONTRACT VARIABLES ≡≡≡≡≡≡≡//
    IRCTreasury public override treasury;
    IRCNftHubL2 public override nfthub;
    IRCOrderbook public override orderbook;
    IRealitio public realitio;

    ///// CONTRACT ADDRESSES /////
    /// @dev reference contract
    address public referenceContractAddress;
    /// @dev increments each time a new reference contract is added
    uint256 public referenceContractVersion;
    /// @dev market addresses, mode // address
    /// @dev these are not used for anything, just an easy way to get markets
    mapping(uint256 => address[]) public marketAddresses;
    mapping(address => bool) public mappingOfMarkets;

    ///// GOVERNANCE VARIABLES- OWNER /////
    /// @dev artist / winner / market creator / affiliate / card affiliate
    uint256[5] public potDistribution;
    /// @dev minimum tokens that must be sent when creating market which forms iniital pot
    uint256 public sponsorshipRequired;
    /// @dev adjust required price increase (in %)
    uint256 public override minimumPriceIncreasePercent;
    /// @dev market opening time must be at least this many seconds in the future
    uint32 public advancedWarning;
    /// @dev market closing time must be no more than this many seconds in the future
    uint32 public maximumDuration;
    /// @dev list of governors
    mapping(address => bool) public governors;
    /// @dev if false, anyone can create markets
    bool public marketCreationGovernorsOnly = true;
    /// @dev if false, anyone can be an affiliate
    bool public approvedAffilliatesOnly = true;
    /// @dev if false, anyone can be an artist
    bool public approvedArtistsOnly = true;
    /// @dev if true, cards are burnt at the end of events for hidden markets to enforce scarcity
    bool public override trapIfUnapproved = true;
    /// @dev high level owner who can change the factory address
    address public uberOwner;
    /// @dev the maximum number of rent collections to perform in a single transaction
    uint256 public override maxRentIterations;
    /// @dev the address of the arbitrator
    address public arbitrator;
    /// @dev the time allowed to dispute the oracle answer
    uint32 public timeout;

    ///// GOVERNANCE VARIABLES- GOVERNORS /////
    /// @dev unapproved markets hidden from the interface
    mapping(address => bool) public override isMarketApproved;
    /// @dev allows artist to receive cut of total rent
    mapping(address => bool) public isArtistApproved;
    /// @dev allows affiliate to receive cut of total rent
    mapping(address => bool) public isAffiliateApproved;
    /// @dev allows card affiliate to receive cut of total rent
    mapping(address => bool) public isCardAffiliateApproved;
    /// @dev a limit to the number of NFTs to mint per market
    uint256 public nftMintingLimit;

    ///// OTHER /////
    /// @dev counts the total NFTs minted across all events
    /// @dev ... so the appropriate token id is used when upgrading to mainnet
    uint256 public totalNftMintCount;

    /*╔═════════════════════════════════╗
      ║            EVENTS               ║
      ╚═════════════════════════════════╝*/

    event LogMarketCreated1(
        address contractAddress,
        address treasuryAddress,
        address nftHubAddress,
        uint256 referenceContractVersion
    );
    event LogMarketCreated2(
        address contractAddress,
        uint32 mode,
        string[] tokenURIs,
        string ipfsHash,
        uint32[] timestamps,
        uint256 totalNftMintCount
    );
    event LogMarketApproved(address market, bool hidden);
    event LogAdvancedWarning(uint256 _newAdvancedWarning);
    event LogMaximumDuration(uint256 _newMaximumDuration);

    /*╔═════════════════════════════════╗
      ║          CONSTRUCTOR            ║
      ╚═════════════════════════════════╝*/

    /// @dev Treasury must be deployed before Factory
    constructor(
        IRCTreasury _treasuryAddress,
        address _realitioAddress,
        address _arbitratorAddress
    ) {
        require(address(_treasuryAddress) != address(0));
        // initialise MetaTransactions
        _initializeEIP712("RealityCardsFactory", "1");

        // at initiation, uberOwner and owner will be the same
        uberOwner = msgSender();

        // initialise contract variable
        treasury = _treasuryAddress;

        // initialise adjustable parameters
        // artist // winner // creator // affiliate // card affiliates
        setPotDistribution(20, 0, 0, 20, 100); // 2% artist, 2% affiliate, 10% card affiliate
        setminimumPriceIncreasePercent(10); // 10%
        setNFTMintingLimit(60); // current gas limit (12.5m) allows for 60 NFTs to be minted
        setMaxRentIterations(35); // limit appears to be 41, set safe at 35 for now.
        // oracle
        setArbitrator(_arbitratorAddress);
        setRealitioAddress(_realitioAddress);
        setTimeout(86400); // 24 hours
    }

    /*╔═════════════════════════════════╗
      ║          VIEW FUNCTIONS         ║
      ╚═════════════════════════════════╝*/

    /// @notice Fetch the address of the most recently created market
    /// @param _mode Filter by market mode, 0=Classic 1=Winner Takes All 2=SafeMode
    /// @return the address of the most recent market in the given mode
    function getMostRecentMarket(uint256 _mode)
        external
        view
        returns (address)
    {
        return marketAddresses[_mode][marketAddresses[_mode].length - (1)];
    }

    /// @notice Fetch all the market addresses for a given mode
    /// @param _mode Filter by market mode, 0=Classic 1=Winner Takes All 2=SafeMode
    /// @return an array of all markets in a given mode
    function getAllMarkets(uint256 _mode)
        external
        view
        returns (address[] memory)
    {
        return marketAddresses[_mode];
    }

    /// @notice Returns the currently set pot distribution
    /// @return the pot distribution array: artist, winner, creator, affiliate, card affiliates
    function getPotDistribution()
        external
        view
        override
        returns (uint256[5] memory)
    {
        return potDistribution;
    }

    /*╔═════════════════════════════════╗
      ║           MODIFIERS             ║
      ╚═════════════════════════════════╝*/

    /// @dev include the owner as a governor
    modifier onlyGovernors() {
        require(
            governors[msgSender()] || owner() == msgSender(),
            "Not approved"
        );
        _;
    }

    /*╔═════════════════════════════════╗
      ║     GOVERNANCE - OWNER (SETUP)  ║
      ╚═════════════════════════════════╝*/
    /// @dev all functions should have onlyOwner modifier

    /// @notice where the NFTs live
    /// @dev nftMintCount will probably need to be reset to zero if new nft contract, but
    /// @dev ... keeping flexible in case returning to previous contract
    /// @param _newAddress the address to set
    /// @param _newNftMintCount the number of NFTs this contract has minted, in order to keep them unique
    function setNftHubAddress(IRCNftHubL2 _newAddress, uint256 _newNftMintCount)
        external
        onlyOwner
    {
        require(address(_newAddress) != address(0));
        nfthub = _newAddress;
        totalNftMintCount = _newNftMintCount;
    }

    /// @notice set the address of the orderbook contract
    /// @param _newAddress the address to set
    function setOrderbookAddress(IRCOrderbook _newAddress) external onlyOwner {
        require(address(_newAddress) != address(0));
        orderbook = _newAddress;
    }

    /*╔═════════════════════════════════╗
      ║       GOVERNANCE - OWNER        ║
      ╚═════════════════════════════════╝*/
    /// @dev all functions should have onlyOwner modifier
    // Min price increase & pot distribution emitted by Market.
    // Advanced Warning and Maximum Duration events emitted here. Nothing else need be emitted.

    /*┌────────────────────────────────────┐
      │ CALLED WITHIN CONSTRUTOR - PUBLIC  │
      └────────────────────────────────────┘*/

    /// @notice update stakeholder payouts
    /// @dev in basis points (so 1000 = 100%)
    /// @param _artistCut The artist that designed the card
    /// @param _winnerCut Extra cut for the longest owner
    /// @param _creatorCut The creator of the market
    /// @param _affiliateCut An affiliate for the market that doesn't fit into the other cuts
    /// @param _cardAffiliateCut An affiliate cur for specific cards
    function setPotDistribution(
        uint256 _artistCut,
        uint256 _winnerCut,
        uint256 _creatorCut,
        uint256 _affiliateCut,
        uint256 _cardAffiliateCut
    ) public onlyOwner {
        require(
            _artistCut +
                _winnerCut +
                _creatorCut +
                _affiliateCut +
                _cardAffiliateCut <=
                1000,
            "Cuts too big"
        );
        potDistribution[0] = _artistCut;
        potDistribution[1] = _winnerCut;
        potDistribution[2] = _creatorCut;
        potDistribution[3] = _affiliateCut;
        potDistribution[4] = _cardAffiliateCut;
    }

    /// @notice how much above the current price a user must bid, in %
    /// @param _percentIncrease the percentage to set, e.g. 10 = 10%
    function setminimumPriceIncreasePercent(uint256 _percentIncrease)
        public
        override
        onlyOwner
    {
        minimumPriceIncreasePercent = _percentIncrease;
    }

    /// @notice A limit to the number of NFTs to mint per market
    /// @dev to avoid gas limits
    /// @param _mintLimit the limit to set
    function setNFTMintingLimit(uint256 _mintLimit) public override onlyOwner {
        nftMintingLimit = _mintLimit;
    }

    /// @notice A limit to the number of rent collections per transaction
    /// @dev to avoid gas limits
    /// @param _rentLimit the limit to set
    function setMaxRentIterations(uint256 _rentLimit)
        public
        override
        onlyOwner
    {
        maxRentIterations = _rentLimit;
    }

    /// @notice set the address of the reality.eth contracts
    /// @param _newAddress the address to set
    function setRealitioAddress(address _newAddress) public onlyOwner {
        require(_newAddress != address(0), "Must set an address");
        realitio = IRealitio(_newAddress);
    }

    /// @notice address of the arbitrator, in case of continued disputes on reality.eth
    /// @param _newAddress the address to set
    function setArbitrator(address _newAddress) public onlyOwner {
        require(_newAddress != address(0), "Must set an address");
        arbitrator = _newAddress;
    }

    /// @notice set how long reality.eth waits for disputes before finalising
    /// @param _newTimeout the timeout to set in seconds, 86400 = 24hrs
    function setTimeout(uint32 _newTimeout) public onlyOwner {
        timeout = _newTimeout;
    }

    /*┌──────────────────────────────────────────┐
      │ NOT CALLED WITHIN CONSTRUTOR - EXTERNAL  │
      └──────────────────────────────────────────┘*/

    /// @notice whether or not only governors can create the market
    function changeMarketCreationGovernorsOnly() external onlyOwner {
        marketCreationGovernorsOnly = !marketCreationGovernorsOnly;
    }

    /// @notice whether or not anyone can be an artist
    function changeApprovedArtistsOnly() external onlyOwner {
        approvedArtistsOnly = !approvedArtistsOnly;
    }

    /// @notice whether or not anyone can be an affiliate
    function changeApprovedAffilliatesOnly() external onlyOwner {
        approvedAffilliatesOnly = !approvedAffilliatesOnly;
    }

    /// @notice how many tokens must be sent in the createMarket tx which forms the initial pot
    /// @param _amount the sponsorship required in wei
    function setSponsorshipRequired(uint256 _amount) external onlyOwner {
        sponsorshipRequired = _amount;
    }

    /// @notice if true, Cards in unapproved markets can't be upgraded
    function changeTrapCardsIfUnapproved() external onlyOwner {
        trapIfUnapproved = !trapIfUnapproved;
    }

    /// @notice market opening time must be at least this many seconds in the future
    /// @param _newAdvancedWarning the warning time to set in seconds
    function setAdvancedWarning(uint32 _newAdvancedWarning) external onlyOwner {
        advancedWarning = _newAdvancedWarning;
        emit LogAdvancedWarning(_newAdvancedWarning);
    }

    /// @notice market closing time must be no more than this many seconds in the future
    /// @param _newMaximumDuration the duration limit to set in seconds
    function setMaximumDuration(uint32 _newMaximumDuration) external onlyOwner {
        maximumDuration = _newMaximumDuration;
        emit LogMaximumDuration(_newMaximumDuration);
    }

    /// @notice to fetch the owner of the contract
    /// @dev used to specifiy the Ownable contract instead of the interface
    function owner()
        public
        view
        override(IRCFactory, Ownable)
        returns (address)
    {
        return Ownable.owner();
    }

    /// @notice check if an address is a governor
    /// @param _user the address to query
    /// @return boolean return if true or false
    function isGovernor(address _user) external view override returns (bool) {
        return governors[_user];
    }

    // EDIT GOVERNORS

    /// @notice add or remove an address from market creator whitelist
    /// @param _governor the address to change approval for
    /// @dev recommended to check isGovernor() afterwards to confirm the desired outcome
    function changeGovernorApproval(address _governor) external onlyOwner {
        require(_governor != address(0));
        governors[_governor] = !governors[_governor];
    }

    /*╔═════════════════════════════════╗
      ║     GOVERNANCE - GOVERNORS      ║
      ╚═════════════════════════════════╝*/
    /// @dev all functions should have onlyGovernors modifier

    /// @notice markets are default hidden from the interface, this reveals them
    /// @param _market the market address to change approval for
    function changeMarketApproval(address _market) external onlyGovernors {
        require(_market != address(0));
        // check it's an RC contract
        IRCMarket _marketToApprove = IRCMarket(_market);
        assert(_marketToApprove.isMarket());
        isMarketApproved[_market] = !isMarketApproved[_market];
        emit LogMarketApproved(_market, isMarketApproved[_market]);
    }

    /// @notice artistAddress, passed in createMarket, must be approved
    /// @param _artist the artist address to change approval for
    function changeArtistApproval(address _artist) external onlyGovernors {
        require(_artist != address(0));
        isArtistApproved[_artist] = !isArtistApproved[_artist];
    }

    /// @notice affiliateAddress, passed in createMarket, must be approved
    /// @param _affiliate the affiliate address to change approval for
    function changeAffiliateApproval(address _affiliate)
        external
        onlyGovernors
    {
        require(_affiliate != address(0));
        isAffiliateApproved[_affiliate] = !isAffiliateApproved[_affiliate];
    }

    /// @notice cardAffiliateAddress, passed in createMarket, must be approved
    /// @param _affiliate the card affiliate address to change approval for
    function changeCardAffiliateApproval(address _affiliate)
        external
        onlyGovernors
    {
        require(_affiliate != address(0));
        isCardAffiliateApproved[_affiliate] = !isCardAffiliateApproved[
            _affiliate
        ];
    }

    /*╔═════════════════════════════════╗
      ║     GOVERNANCE - UBER OWNER     ║
      ╠═════════════════════════════════╣
      ║  ******** DANGER ZONE ********  ║
      ╚═════════════════════════════════╝*/
    /// @dev uber owner required for upgrades
    /// @dev this is seperated so owner so can be set to multisig, or burn address to relinquish upgrade ability
    /// @dev ... while maintaining governance over other governanace functions

    /// @notice change the reference contract for the contract logic
    function setReferenceContractAddress(address _newAddress) external {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newAddress != address(0));
        // check it's an RC contract
        IRCMarket newContractVariable = IRCMarket(_newAddress);
        assert(newContractVariable.isMarket());
        // set
        referenceContractAddress = _newAddress;
        // increment version
        referenceContractVersion += 1;
    }

    /// @notice to change or renounce ownership of the uberOwner role
    function changeUberOwner(address _newUberOwner) external {
        require(msgSender() == uberOwner, "Extremely Verboten");
        require(_newUberOwner != address(0));
        uberOwner = _newUberOwner;
    }

    /*╔═════════════════════════════════╗
      ║         MARKET CREATION         ║
      ╚═════════════════════════════════╝*/

    /// @notice Creates a new market with the given parameters
    /// @param _mode 0 = normal, 1 = winner takes all, 2 = hot potato
    /// @param _timestamps for market opening, locking, and oracle resolution
    /// @param _tokenURIs location of NFT metadata
    /// @param _artistAddress where to send artist's cut, if any
    /// @param _affiliateAddress where to send affiliate's cut, if any
    /// @param _cardAffiliateAddresses where to send card specific affiliate's cut, if any
    /// @param _realitioQuestion the details of the event to send to the oracle
    /// @param _sponsorship amount of sponsorship to create the market with
    /// @return The address of the new market
    function createMarket(
        uint32 _mode,
        string memory _ipfsHash,
        uint32[] memory _timestamps,
        string[] memory _tokenURIs,
        address _artistAddress,
        address _affiliateAddress,
        address[] memory _cardAffiliateAddresses,
        string calldata _realitioQuestion,
        uint256 _sponsorship
    ) external returns (address) {
        address _creator = msgSender();

        // check sponsorship
        require(
            _sponsorship >= sponsorshipRequired,
            "Insufficient sponsorship"
        );
        treasury.checkSponsorship(_creator, _sponsorship);

        // check stakeholder addresses
        // artist
        if (approvedArtistsOnly) {
            require(
                isArtistApproved[_artistAddress] ||
                    _artistAddress == address(0),
                "Artist not approved"
            );
        }
        // affiliate
        if (approvedAffilliatesOnly) {
            require(
                isAffiliateApproved[_affiliateAddress] ||
                    _affiliateAddress == address(0),
                "Affiliate not approved"
            );
            // card affiliates
            for (uint256 i = 0; i < _cardAffiliateAddresses.length; i++) {
                require(
                    isCardAffiliateApproved[_cardAffiliateAddresses[i]] ||
                        _cardAffiliateAddresses[i] == address(0),
                    "Card affiliate not approved"
                );
            }
        }

        // check market creator is approved
        if (marketCreationGovernorsOnly) {
            require(governors[_creator] || owner() == _creator, "Not approved");
        }

        // check timestamps
        require(_timestamps.length == 3, "Incorrect number of array elements");
        // check market opening time
        if (advancedWarning != 0) {
            require(
                _timestamps[0] >= block.timestamp,
                "Market opening time not set"
            );
            require(
                _timestamps[0] - advancedWarning > block.timestamp,
                "Market opens too soon"
            );
        }
        // check market locking time
        if (maximumDuration != 0) {
            require(
                _timestamps[1] < block.timestamp + maximumDuration,
                "Market locks too late"
            );
        }
        // check oracle resolution time (no more than 1 week after market locking to get result)
        require(
            _timestamps[1] + (1 weeks) > _timestamps[2] &&
                _timestamps[1] <= _timestamps[2],
            "Oracle resolution time error"
        );

        // check the number of NFTs to mint is within limits
        require(
            _tokenURIs.length <= nftMintingLimit,
            "Too many tokens to mint"
        );

        // create the market and emit the appropriate events
        // two events to avoid stack too deep error
        address _newAddress = Clones.clone(referenceContractAddress);
        emit LogMarketCreated1(
            _newAddress,
            address(treasury),
            address(nfthub),
            referenceContractVersion
        );
        emit LogMarketCreated2(
            _newAddress,
            _mode,
            _tokenURIs,
            _ipfsHash,
            _timestamps,
            totalNftMintCount
        );

        // tell Treasury, Orderbook, and NFT hub about new market
        // before initialize as during initialize the market may call the treasury
        treasury.addMarket(_newAddress);
        nfthub.addMarket(_newAddress);
        orderbook.addMarket(
            _newAddress,
            _tokenURIs.length,
            minimumPriceIncreasePercent
        );

        // update internals
        marketAddresses[_mode].push(_newAddress);
        mappingOfMarkets[_newAddress] = true;

        // initialize the market
        IRCMarket(_newAddress).initialize({
            _mode: _mode,
            _timestamps: _timestamps,
            _numberOfTokens: _tokenURIs.length,
            _totalNftMintCount: totalNftMintCount,
            _artistAddress: _artistAddress,
            _affiliateAddress: _affiliateAddress,
            _cardAffiliateAddresses: _cardAffiliateAddresses,
            _marketCreatorAddress: _creator,
            _realitioQuestion: _realitioQuestion
        });

        // create the NFTs
        require(address(nfthub) != address(0), "Nfthub not set");
        for (uint256 i = 0; i < _tokenURIs.length; i++) {
            uint256 _tokenId = i + totalNftMintCount;
            require(
                nfthub.mint(_newAddress, _tokenId, _tokenURIs[i]),
                "Nft Minting Failed"
            );
        }

        // increment totalNftMintCount
        totalNftMintCount = totalNftMintCount + _tokenURIs.length;

        // pay sponsorship, if applicable
        if (_sponsorship > 0) {
            IRCMarket(_newAddress).sponsor(_creator, _sponsorship);
        }

        return _newAddress;
    }

    /// @dev called by the market upon initialise
    /// @dev not passed to initialise to avoid stack too deep error
    function getOracleSettings()
        external
        view
        override
        returns (
            IRealitio,
            address,
            uint32
        )
    {
        return (realitio, arbitrator, timeout);
    }
    /*
         ▲  
        ▲ ▲ 
              */
}
