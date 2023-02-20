pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../Access/MISOAccessControls.sol";

//==================
//    Uniswap V2       
//==================

interface IUniswapFactory {
    function getPair(address token0, address token1) external view returns (address);
}

interface IUniswapPair {
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner) external view returns (uint);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() external view returns (uint);
    function price1CumulativeLast() external view returns (uint);
    function kLast() external view returns (uint);
}

//==================
//    Documents       
//==================

interface IDocument {
    function getDocument(string calldata _name) external view returns (string memory, uint256);
    function getDocumentCount() external view returns (uint256);
    function getDocumentName(uint256 index) external view returns (string memory);    
}

contract DocumentHepler {
    struct Document {
        string name;
        string data;
        uint256 lastModified;
    }

    function getDocuments(address _document) public view returns(Document[] memory) {
        IDocument document = IDocument(_document);
        uint256 documentCount = document.getDocumentCount();

        Document[] memory documents = new Document[](documentCount);

        for(uint256 i = 0; i < documentCount; i++) {
            string memory documentName = document.getDocumentName(i);
            (
                documents[i].data,
                documents[i].lastModified
            ) = document.getDocument(documentName);
            documents[i].name = documentName;
        }
        return documents;
    }
}


//==================
//     Tokens
//==================

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IMisoTokenFactory {
    function getTokens() external view returns (address[] memory);
    function tokens(uint256) external view returns (address);
    function numberOfTokens() external view returns (uint256);
} 

contract TokenHelper {
    struct TokenInfo {
        address addr;
        uint256 decimals;
        string name;
        string symbol;
    }

    function getTokensInfo(address[] memory addresses) public view returns (TokenInfo[] memory)
    {
        TokenInfo[] memory infos = new TokenInfo[](addresses.length);

        for (uint256 i = 0; i < addresses.length; i++) {
            infos[i] = getTokenInfo(addresses[i]);
        }

        return infos;
    }

    function getTokenInfo(address _address) public view returns (TokenInfo memory) {
        TokenInfo memory info;
        IERC20 token = IERC20(_address);

        info.addr = _address;
        info.name = token.name();
        info.symbol = token.symbol();
        info.decimals = token.decimals();

        return info;
    }

    function allowance(address _token, address _owner, address _spender) public view returns(uint256) {
        return IERC20(_token).allowance(_owner, _spender);
    }

}


//==================
//      Base
//==================

contract BaseHelper {
    IMisoMarketFactory public market;
    IMisoTokenFactory public tokenFactory;
    IMisoFarmFactory public farmFactory;
    address public launcher;

    /// @notice Responsible for access rights to the contract
    MISOAccessControls public accessControls;

    function setContracts(
        address _tokenFactory,
        address _market,
        address _launcher,
        address _farmFactory
    ) public {
        require(
            accessControls.hasAdminRole(msg.sender),
            "MISOHelper: Sender must be Admin"
        );
        if (_market != address(0)) {
            market = IMisoMarketFactory(_market);
        }
        if (_tokenFactory != address(0)) {
            tokenFactory = IMisoTokenFactory(_tokenFactory);
        }
        if (_launcher != address(0)) {
            launcher = _launcher;
        }
        if (_farmFactory != address(0)) {
            farmFactory = IMisoFarmFactory(_farmFactory);
        }
    }
}


//==================
//      Farms       
//==================

interface IMisoFarmFactory {
    function getTemplateId(address _farm) external view returns(uint256);
    function numberOfFarms() external view returns(uint256);
    function farms(uint256 _farmId) external view returns(address);
}

interface IFarm {
    function poolInfo(uint256 pid) external view returns(
        address lpToken,
        uint256 allocPoint,
        uint256 lastRewardBlock,
        uint256 accRewardsPerShare
    );
    function rewards() external view returns(address);
    function poolLength() external view returns (uint256);
    function rewardsPerBlock() external view returns (uint256);
    function bonusMultiplier() external view returns (uint256);
    function userInfo(uint256 pid, address _user) external view returns (uint256, uint256);
    function pendingRewards(uint256 _pid, address _user) external view returns (uint256);
}

contract FarmHelper is BaseHelper, TokenHelper {
    struct FarmInfo {
        address addr;
        uint256 templateId;
        uint256 rewardsPerBlock;
        uint256 bonusMultiplier;
        TokenInfo rewardToken;
        PoolInfo[] pools;
    }

    struct PoolInfo {
        address lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accRewardsPerShare;
        uint256 totalStaked;
        TokenInfo stakingToken;
    }

    struct UserPoolInfo {
        address farm;
        uint256 pid;
        uint256 totalStaked;
        uint256 lpBalance;
        uint256 lpAllowance;
        uint256 rewardDebt;
        uint256 pendingRewards;
    }

    struct UserPoolsInfo {
        address farm;
        uint256[] pids;
        uint256[] totalStaked;
        uint256[] pendingRewards;
    }

    function getPools(address _farm) public view returns(PoolInfo[] memory) {
        IFarm farm = IFarm(_farm);
        uint256 poolLength = farm.poolLength();
        PoolInfo[] memory pools = new PoolInfo[](poolLength);
        
        for(uint256 i = 0; i < poolLength; i++) {
            (
                pools[i].lpToken,
                pools[i].allocPoint,
                pools[i].lastRewardBlock,
                pools[i].accRewardsPerShare
            ) = farm.poolInfo(i);
            pools[i].totalStaked = IERC20(pools[i].lpToken).balanceOf(_farm);
            pools[i].stakingToken = getTokenInfo(pools[i].lpToken);
        }
        return pools;
    }


    function getFarms() public view returns(FarmInfo[] memory) {
        uint256 numberOfFarms = farmFactory.numberOfFarms();

        FarmInfo[] memory infos = new FarmInfo[](numberOfFarms);

        for (uint256 i = 0; i < numberOfFarms; i++) {
            address farmAddr = farmFactory.farms(i);
            uint256 templateId = farmFactory.getTemplateId(farmAddr);
            infos[i] = _farmInfo(farmAddr);
        }

        return infos;
    }

    function getFarms(
        uint256 pageSize,
        uint256 pageNbr,
        uint256 offset
    ) public view returns(FarmInfo[] memory) {
        uint256 numberOfFarms = farmFactory.numberOfFarms();
        uint256 startIdx = (pageNbr * pageSize) + offset;
        uint256 endIdx = startIdx + pageSize;

        FarmInfo[] memory infos;

        if (endIdx > numberOfFarms) {
            endIdx = numberOfFarms;
        }
        if(endIdx < startIdx) {
            return infos;
        }
        infos = new FarmInfo[](endIdx - startIdx);

        for (uint256 farmIdx = 0; farmIdx + startIdx < endIdx; farmIdx++) {
            address farmAddr = farmFactory.farms(farmIdx + startIdx);
            infos[farmIdx] = _farmInfo(farmAddr);
        }

        return infos;
    }

    function getFarms(
        uint256 pageSize,
        uint256 pageNbr
    ) public view returns(FarmInfo[] memory) {
        return getFarms(pageSize, pageNbr, 0);
    }

    function _farmInfo(address _farmAddr) private view returns(FarmInfo memory farmInfo) {
            IFarm farm = IFarm(_farmAddr);

            farmInfo.addr = _farmAddr;
            farmInfo.templateId = farmFactory.getTemplateId(_farmAddr);
            farmInfo.rewardsPerBlock = farm.rewardsPerBlock();
            farmInfo.bonusMultiplier = farm.bonusMultiplier();
            farmInfo.rewardToken = getTokenInfo(farm.rewards());
            farmInfo.pools = getPools(_farmAddr);
    }

    function getFarmDetail(address _farm, address _user) 
        public
        view
        returns(FarmInfo memory farmInfo, UserPoolInfo[] memory userInfos) 
    {
        IFarm farm = IFarm(_farm);
        farmInfo.addr = _farm;
        farmInfo.templateId = farmFactory.getTemplateId(_farm);
        farmInfo.rewardsPerBlock = farm.rewardsPerBlock();
        farmInfo.bonusMultiplier = farm.bonusMultiplier();
        farmInfo.rewardToken = getTokenInfo(farm.rewards());
        farmInfo.pools = getPools(_farm);

        if(_user != address(0)) {
            PoolInfo[] memory pools = farmInfo.pools;
            userInfos = new UserPoolInfo[](pools.length);
            for(uint i = 0; i < pools.length; i++) {
                UserPoolInfo memory userInfo = userInfos[i];
                address stakingToken = pools[i].stakingToken.addr;
                (userInfo.totalStaked, userInfo.rewardDebt) = farm.userInfo(i, _user);
                userInfo.lpBalance = IERC20(stakingToken).balanceOf(_user);
                userInfo.lpAllowance = IERC20(stakingToken).allowance(_user, _farm);
                userInfo.pendingRewards = farm.pendingRewards(i, _user);
                (userInfo.totalStaked,) = farm.userInfo(i, _user);
                userInfo.farm = _farm;
                userInfo.pid = i;
                userInfos[i] = userInfo;
            }
        }
        return (farmInfo, userInfos);
    }

    function getUserPoolsInfos(address _user) public view returns(UserPoolsInfo[] memory) {
        uint256 numberOfFarms = farmFactory.numberOfFarms();

        UserPoolsInfo[] memory infos = new UserPoolsInfo[](numberOfFarms);

        for (uint256 i = 0; i < numberOfFarms; i++) {
            address farmAddr = farmFactory.farms(i);
            IFarm farm = IFarm(farmAddr);
            uint256 poolLength = farm.poolLength();
            uint256[] memory totalStaked = new uint256[](poolLength);
            uint256[] memory pendingRewards = new uint256[](poolLength);
            uint256[] memory pids = new uint256[](poolLength);

            for(uint256 j = 0; j < poolLength; j++) {
                (address stakingToken,,,) = farm.poolInfo(j);
                (totalStaked[j],) = farm.userInfo(j, _user);
                pendingRewards[j] = farm.pendingRewards(j, _user);
                pids[j] = j;
            }
            infos[i].totalStaked = totalStaked;
            infos[i].pendingRewards = pendingRewards;
            infos[i].pids = pids;
            infos[i].farm = farmAddr;
        }
        return infos;
    }
}

//==================
//     Markets       
//==================

interface IBaseAuction {
    function getBaseInformation() external view returns (
            address auctionToken,
            uint64 startTime,
            uint64 endTime,
            bool finalized
        );
}

interface IMisoMarketFactory {
    function getMarketTemplateId(address _auction) external view returns(uint64);
    function getMarkets() external view returns(address[] memory);
    function numberOfAuctions() external view returns(uint256);
    function auctions(uint256) external view returns(address);
}

interface IMisoMarket {
    function paymentCurrency() external view returns (address) ;
    function auctionToken() external view returns (address) ;
    function marketPrice() external view returns (uint128, uint128);
    function marketInfo()
        external
        view
        returns (
        uint64 startTime,
        uint64 endTime,
        uint128 totalTokens
        );
    function auctionSuccessful() external view returns (bool);
    function commitments(address user) external view returns (uint256);
    function claimed(address user) external view returns (uint256);
    function tokensClaimable(address user) external view returns (uint256);
    function hasAdminRole(address user) external view returns (bool);
}

interface ICrowdsale is IMisoMarket {
    function marketStatus() external view returns(
        uint128 commitmentsTotal,
        bool finalized,
        bool usePointList
    );
}

interface IDutchAuction is IMisoMarket {
    function marketStatus() external view returns(
        uint128 commitmentsTotal,
        bool finalized,
        bool usePointList
    );
    // function totalTokensCommitted() external view returns (uint256);
    // function clearingPrice() external view returns (uint256);
}

interface IBatchAuction is IMisoMarket {
    function marketStatus() external view returns(
        uint256 commitmentsTotal,
        uint256 minimumCommitmentAmount,
        bool finalized,
        bool usePointList
    );
}

interface IHyperbolicAuction is IMisoMarket {
    function marketStatus() external view returns(
        uint128 commitmentsTotal,
        bool finalized,
        bool usePointList
    );
}

contract MarketHelper is BaseHelper, TokenHelper, DocumentHepler {

    address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    struct CrowdsaleInfo {
        address addr;
        address paymentCurrency;
        uint128 commitmentsTotal;
        uint128 totalTokens;
        uint128 rate;
        uint128 goal;
        uint64 startTime;
        uint64 endTime;
        bool finalized;
        bool usePointList;
        bool auctionSuccessful;
        TokenInfo tokenInfo;
        TokenInfo paymentCurrencyInfo;
        Document[] documents;
    }

    struct DutchAuctionInfo {
        address addr;
        address paymentCurrency;
        uint64 startTime;
        uint64 endTime;
        uint128 totalTokens;
        uint128 startPrice;
        uint128 minimumPrice;
        uint128 commitmentsTotal;
        // uint256 totalTokensCommitted;
        bool finalized;
        bool usePointList;
        bool auctionSuccessful;
        TokenInfo tokenInfo;
        TokenInfo paymentCurrencyInfo;
        Document[] documents;
    }

    struct BatchAuctionInfo {
        address addr;
        address paymentCurrency;
        uint64 startTime;
        uint64 endTime;
        uint128 totalTokens;
        uint256 commitmentsTotal;
        uint256 minimumCommitmentAmount;
        bool finalized;
        bool usePointList;
        bool auctionSuccessful;
        TokenInfo tokenInfo;
        TokenInfo paymentCurrencyInfo;
        Document[] documents;
    }

    struct HyperbolicAuctionInfo {
        address addr;
        address paymentCurrency;
        uint64 startTime;
        uint64 endTime;
        uint128 totalTokens;
        uint128 minimumPrice;
        uint128 alpha;
        uint128 commitmentsTotal;
        bool finalized;
        bool usePointList;
        bool auctionSuccessful;
        TokenInfo tokenInfo;
        TokenInfo paymentCurrencyInfo;
        Document[] documents;
    }

    struct MarketBaseInfo {
        address addr;
        uint64 templateId;
        uint64 startTime;
        uint64 endTime;
        bool finalized;
        TokenInfo tokenInfo;
    }

    struct PLInfo {
        TokenInfo token0;
        TokenInfo token1;
        address pairToken;
        address operator;
        uint256 locktime;
        uint256 unlock;
        uint256 deadline;
        uint256 launchwindow;
        uint256 expiry;
        uint256 liquidityAdded;
        uint256 launched;
    }

    struct UserMarketInfo {
        uint256 commitments;
        uint256 tokensClaimable;
        uint256 claimed;
        bool isAdmin;
    }

    function getMarkets(
        uint256 pageSize,
        uint256 pageNbr,
        uint256 offset
    ) public view returns (MarketBaseInfo[] memory) {
        uint256 marketsLength = market.numberOfAuctions();
        uint256 startIdx = (pageNbr * pageSize) + offset;
        uint256 endIdx = startIdx + pageSize;
        MarketBaseInfo[] memory infos;
        if (endIdx > marketsLength) {
            endIdx = marketsLength;
        }
        if(endIdx < startIdx) {
            return infos;
        }
        infos = new MarketBaseInfo[](endIdx - startIdx);

        for (uint256 marketIdx = 0; marketIdx + startIdx < endIdx; marketIdx++) {
            address marketAddress = market.auctions(marketIdx + startIdx);
            infos[marketIdx] = _getMarketInfo(marketAddress);
        }

        return infos;
    }

    function getMarkets(
        uint256 pageSize,
        uint256 pageNbr
    ) public view returns (MarketBaseInfo[] memory) {
        return getMarkets(pageSize, pageNbr, 0);
    }

    function getMarkets() public view returns (MarketBaseInfo[] memory) {
        address[] memory markets = market.getMarkets();
        MarketBaseInfo[] memory infos = new MarketBaseInfo[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            MarketBaseInfo memory marketInfo = _getMarketInfo(markets[i]);
            infos[i] = marketInfo;
        }

        return infos;
    }

    function _getMarketInfo(address _marketAddress) private view returns (MarketBaseInfo memory marketInfo) {
            uint64 templateId = market.getMarketTemplateId(_marketAddress);
            address auctionToken;
            uint64 startTime;
            uint64 endTime;
            bool finalized;
            (auctionToken, startTime, endTime, finalized) = IBaseAuction(_marketAddress)
                .getBaseInformation();
            TokenInfo memory tokenInfo = getTokenInfo(auctionToken);

            marketInfo.addr = _marketAddress;
            marketInfo.templateId = templateId;
            marketInfo.startTime = startTime;
            marketInfo.endTime = endTime;
            marketInfo.finalized = finalized;
            marketInfo.tokenInfo = tokenInfo;  
    }

    function getCrowdsaleInfo(address _crowdsale) public view returns (CrowdsaleInfo memory) {
        ICrowdsale crowdsale = ICrowdsale(_crowdsale);
        CrowdsaleInfo memory info;

        info.addr = address(crowdsale);
        (info.commitmentsTotal, info.finalized, info.usePointList) = crowdsale.marketStatus();
        (info.startTime, info.endTime, info.totalTokens) = crowdsale.marketInfo();
        (info.rate, info.goal) = crowdsale.marketPrice();
        (info.auctionSuccessful) = crowdsale.auctionSuccessful();
        info.tokenInfo = getTokenInfo(crowdsale.auctionToken());

        address paymentCurrency = crowdsale.paymentCurrency();
        TokenInfo memory paymentCurrencyInfo;
        if(paymentCurrency == ETH_ADDRESS) {
            paymentCurrencyInfo = _getETHInfo();
        } else {
            paymentCurrencyInfo = getTokenInfo(paymentCurrency);
        }
        info.paymentCurrencyInfo = paymentCurrencyInfo;

        info.documents = getDocuments(_crowdsale);

        return info;
    }

    function getDutchAuctionInfo(address payable _dutchAuction) public view returns (DutchAuctionInfo memory)
    {
        IDutchAuction dutchAuction = IDutchAuction(_dutchAuction);
        DutchAuctionInfo memory info;

        info.addr = address(dutchAuction);
        (info.startTime, info.endTime, info.totalTokens) = dutchAuction.marketInfo();
        (info.startPrice, info.minimumPrice) = dutchAuction.marketPrice();
        (info.auctionSuccessful) = dutchAuction.auctionSuccessful();
        (
            info.commitmentsTotal,
            info.finalized,
            info.usePointList
        ) = dutchAuction.marketStatus();
        info.tokenInfo = getTokenInfo(dutchAuction.auctionToken());

        address paymentCurrency = dutchAuction.paymentCurrency();
        TokenInfo memory paymentCurrencyInfo;
        if(paymentCurrency == ETH_ADDRESS) {
            paymentCurrencyInfo = _getETHInfo();
        } else {
            paymentCurrencyInfo = getTokenInfo(paymentCurrency);
        }
        info.paymentCurrencyInfo = paymentCurrencyInfo;
        info.documents = getDocuments(_dutchAuction);

        return info;
    }

    function getBatchAuctionInfo(address payable _batchAuction) public view returns (BatchAuctionInfo memory) 
    {
        IBatchAuction batchAuction = IBatchAuction(_batchAuction);
        BatchAuctionInfo memory info;
        
        info.addr = address(batchAuction);
        (info.startTime, info.endTime, info.totalTokens) = batchAuction.marketInfo();
        (info.auctionSuccessful) = batchAuction.auctionSuccessful();
        (
            info.commitmentsTotal,
            info.minimumCommitmentAmount,
            info.finalized,
            info.usePointList
        ) = batchAuction.marketStatus();
        info.tokenInfo = getTokenInfo(batchAuction.auctionToken());
        address paymentCurrency = batchAuction.paymentCurrency();
        TokenInfo memory paymentCurrencyInfo;
        if(paymentCurrency == ETH_ADDRESS) {
            paymentCurrencyInfo = _getETHInfo();
        } else {
            paymentCurrencyInfo = getTokenInfo(paymentCurrency);
        }
        info.paymentCurrencyInfo = paymentCurrencyInfo;
        info.documents = getDocuments(_batchAuction);

        return info;
    }

    function getHyperbolicAuctionInfo(address payable _hyperbolicAuction) public view returns (HyperbolicAuctionInfo memory)
    {
        IHyperbolicAuction hyperbolicAuction = IHyperbolicAuction(_hyperbolicAuction);
        HyperbolicAuctionInfo memory info;

        info.addr = address(hyperbolicAuction);
        (info.startTime, info.endTime, info.totalTokens) = hyperbolicAuction.marketInfo();
        (info.minimumPrice, info.alpha) = hyperbolicAuction.marketPrice();
        (info.auctionSuccessful) = hyperbolicAuction.auctionSuccessful();
        (
            info.commitmentsTotal,
            info.finalized,
            info.usePointList
        ) = hyperbolicAuction.marketStatus();
        info.tokenInfo = getTokenInfo(hyperbolicAuction.auctionToken());
        
        address paymentCurrency = hyperbolicAuction.paymentCurrency();
        TokenInfo memory paymentCurrencyInfo;
        if(paymentCurrency == ETH_ADDRESS) {
            paymentCurrencyInfo = _getETHInfo();
        } else {
            paymentCurrencyInfo = getTokenInfo(paymentCurrency);
        }
        info.paymentCurrencyInfo = paymentCurrencyInfo;
        info.documents = getDocuments(_hyperbolicAuction);

        return info;
    }

    function getUserMarketInfo(address _action, address _user) public view returns(UserMarketInfo memory userInfo) {
        IMisoMarket market = IMisoMarket(_action);
        userInfo.commitments = market.commitments(_user);
        userInfo.tokensClaimable = market.tokensClaimable(_user);
        userInfo.claimed = market.claimed(_user);
        userInfo.isAdmin = market.hasAdminRole(_user);
    }

    function _getETHInfo() private pure returns(TokenInfo memory token) {
            token.addr = ETH_ADDRESS;
            token.name = "ETHEREUM";
            token.symbol = "ETH";
            token.decimals = 18;
    }

}

contract MISOHelper is MarketHelper, FarmHelper {

    constructor(
        address _accessControls,
        address _tokenFactory,
        address _market,
        address _launcher,
        address _farmFactory
    ) public { 
        require(_accessControls != address(0));
        accessControls = MISOAccessControls(_accessControls);
        tokenFactory = IMisoTokenFactory(_tokenFactory);
        market = IMisoMarketFactory(_market);
        launcher = _launcher;
        farmFactory = IMisoFarmFactory(_farmFactory);
    }

    function getTokens() public view returns(TokenInfo[] memory) {
        address[] memory tokens = tokenFactory.getTokens();
        TokenInfo[] memory infos = getTokensInfo(tokens);

        infos = getTokensInfo(tokens);

        return infos;
    }

    function getTokens(
        uint256 pageSize,
        uint256 pageNbr,
        uint256 offset
    ) public view returns(TokenInfo[] memory) {
        uint256 tokensLength = tokenFactory.numberOfTokens();

        uint256 startIdx = (pageNbr * pageSize) + offset;
        uint256 endIdx = startIdx + pageSize;
        TokenInfo[] memory infos;
        if (endIdx > tokensLength) {
            endIdx = tokensLength;
        }
        if(endIdx < startIdx) {
            return infos;
        }
        infos = new TokenInfo[](endIdx - startIdx);

        for (uint256 tokenIdx = 0; tokenIdx + startIdx < endIdx; tokenIdx++) {
            address tokenAddress = tokenFactory.tokens(tokenIdx + startIdx);
            infos[tokenIdx] = getTokenInfo(tokenAddress);
        }

        return infos;
    }

    function getTokens(
        uint256 pageSize,
        uint256 pageNbr
    ) public view returns(TokenInfo[] memory) {
        return getTokens(pageSize, pageNbr, 0);
    }

}
