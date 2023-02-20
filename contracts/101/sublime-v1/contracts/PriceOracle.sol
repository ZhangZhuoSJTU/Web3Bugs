// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import './interfaces/IPriceOracle.sol';

contract PriceOracle is Initializable, OwnableUpgradeable, IPriceOracle {
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------/

    uint256 constant SCALING_EXPONENT = 18;
    uint256 constant SCALING_FACTOR = 10**(SCALING_EXPONENT);

    uint128 public immutable MAX_CHAINLINK_HEARTBEAT;

    //-------------------------------- Constants end --------------------------------/

    //-------------------------------- Global vars start --------------------------------/

    /**
     * @notice Struct that stores the chainlink price oracle and decimals related to the token
     * @param oracle address of price oracle of token against USD
     * @param decimals no of decimals for the price from oracle
     * @param heartbeat the time delta after which the price from the feed is discarded
     **/
    struct PriceData {
        address oracle;
        uint8 decimals;
        uint128 heartbeat;
    }
    /**
     * @notice stores the price oracle and its decimals for chainlink feeds
     **/
    mapping(address => PriceData) public chainlinkFeedAddresses;

    // stores the decimals for the token against the address
    mapping(address => uint256) decimals;

    /**
     * @notice stores the addresses of price feeds for uniswap token pairs
     **/
    mapping(bytes32 => address) public uniswapPools;

    // price averaging period for uniswap
    uint32 uniswapPriceAveragingPeriod;

    //-------------------------------- Global vars end --------------------------------/

    //-------------------------------- Init start --------------------------------/

    /**
     * @notice Used to initialize param during deployment
     * @dev invoked on deployment
     * @param _maxChainlinkHeartbeat max interval between within which chainlink oracle data is updated
     **/
    constructor(uint128 _maxChainlinkHeartbeat) {
        MAX_CHAINLINK_HEARTBEAT = _maxChainlinkHeartbeat;
    }

    /**
     * @notice Used to initialize the price oracle contract
     * @dev can only be invoked once
     * @param _admin owner of the price oracle
     * @param _uniswapPriceAveragingPeriod period for uniswap price averaging
     **/
    function initialize(address _admin, uint32 _uniswapPriceAveragingPeriod) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_admin);
        _setUniswapPriceAveragingPeriod(_uniswapPriceAveragingPeriod);
    }

    //-------------------------------- Init end --------------------------------/

    //-------------------------------- price start --------------------------------/
    /**
     * @notice Used to get price of the num vs den token from chainlink
     * @param num the address of the token for which price in queried
     * @param den the address of the token in which price is queried
     * @return price of the num in terms of den
     * @return no of decimals for the price
     **/
    function getChainlinkLatestPrice(address num, address den) public view returns (uint256, uint256) {
        PriceData memory _feedData1 = chainlinkFeedAddresses[num];
        PriceData memory _feedData2 = chainlinkFeedAddresses[den];

        if (_feedData1.oracle == address(0) || _feedData2.oracle == address(0)) return (0, 0);

        int256 price1;
        int256 price2;
        {
            uint80 roundID1;
            uint256 timeStamp1;
            uint80 answeredInRound1;
            (roundID1, price1, , timeStamp1, answeredInRound1) = AggregatorV3Interface(_feedData1.oracle).latestRoundData();
            if ((price1 == 0) || block.timestamp > timeStamp1 + _feedData1.heartbeat || answeredInRound1 < roundID1) return (0, 0);
        }
        {
            uint80 roundID2;
            uint256 timeStamp2;
            uint80 answeredInRound2;
            (roundID2, price2, , timeStamp2, answeredInRound2) = AggregatorV3Interface(_feedData2.oracle).latestRoundData();
            if ((price2 == 0) || block.timestamp > timeStamp2 + _feedData2.heartbeat || answeredInRound2 < roundID2) return (0, 0);
        }
        uint256 price = uint256(price1)
            .mul(10**_feedData2.decimals)
            .mul(SCALING_FACTOR)
            .div(uint256(price2))
            .div(10**_feedData1.decimals)
            .mul(10**decimals[den])
            .div(10**decimals[num]);
        return (price, SCALING_EXPONENT);
    }

    /**
     * @notice Used to get price of the num vs den token from uniswap
     * @param num the address of the token for which price in queried
     * @param den the address of the token in which price is queried
     * @return price of the num in terms of wei for num and denom tokens
     * @return no of decimals for the price
     **/
    function getUniswapLatestPrice(address num, address den) public view returns (uint256, uint256) {
        bytes32 _poolTokensId = getUniswapPoolTokenId(num, den);
        address _pool = uniswapPools[_poolTokensId];
        if (_pool == address(0)) return (0, 0);

        (int24 _twapTick, ) = OracleLibrary.consult(_pool, uniswapPriceAveragingPeriod);
        uint256 _price = OracleLibrary.getQuoteAtTick(_twapTick, uint128(SCALING_FACTOR), num, den);
        return (_price, SCALING_EXPONENT);
    }

    /**
     * @notice Used to get price of the num vs den token
     * @param num the address of the token for which price in queried
     * @param den the address of the token in which price is queried
     * @return price of the num in terms of den
     * @return no of decimals for the price
     **/
    function getLatestPrice(address num, address den) external view override returns (uint256, uint256) {
        uint256 _price;
        uint256 _decimals;
        (_price, _decimals) = getChainlinkLatestPrice(num, den);
        if (_price != 0) return (_price, _decimals);

        (_price, _decimals) = getUniswapLatestPrice(num, den);
        if (_price != 0) return (_price, _decimals);
        revert('PO:GLP1');
    }

    //-------------------------------- price end --------------------------------/

    //-------------------------------- Global var setters start --------------------------------/

    /**
     * @notice Used to set the price feed address for a token in chainlink
     * @dev only owner can set
     * @param _token address of token for which price feed is added
     * @param _priceFeed address of the price feed for the token
     * @param _heartbeat the time delta after which the price from the feed is discarded
     **/
    function setChainlinkFeedAddress(
        address _token,
        address _priceFeed,
        uint128 _heartbeat
    ) external onlyOwner {
        require(_heartbeat <= MAX_CHAINLINK_HEARTBEAT, 'PO:SCFA1');
        uint8 priceOracleDecimals = AggregatorV3Interface(_priceFeed).decimals();
        chainlinkFeedAddresses[_token] = PriceData(_priceFeed, priceOracleDecimals, _heartbeat);
        decimals[_token] = getDecimals(_token);
        emit ChainlinkFeedUpdated(_token, _priceFeed, _heartbeat);
    }

    /**
     * @notice Used to set the price feed address for a token pair in uniswap
     * @dev only owner can set
     * @param token1 address of one of the tokens for which price feed is added
     * @param token2 address of other token for which price feed is added
     * @param pool addrewss of the price feed for the token pair
     **/
    function setUniswapFeedAddress(
        address token1,
        address token2,
        address pool
    ) external onlyOwner {
        require(token1 != token2, 'PO:SUFA1');
        bytes32 _poolTokensId = getUniswapPoolTokenId(token1, token2);
        uniswapPools[_poolTokensId] = pool;
        emit UniswapFeedUpdated(token1, token2, _poolTokensId, pool);
    }

    /**
     * @notice Used to set the period in which uniswap price is averaged
     * @dev only owner can set. This is used to prevent attacks to control price feed
     * @param _uniswapPriceAveragingPeriod period for uniswap price averaging
     **/
    function setUniswapPriceAveragingPeriod(uint32 _uniswapPriceAveragingPeriod) external onlyOwner {
        _setUniswapPriceAveragingPeriod(_uniswapPriceAveragingPeriod);
    }

    function _setUniswapPriceAveragingPeriod(uint32 _uniswapPriceAveragingPeriod) private {
        require(_uniswapPriceAveragingPeriod != 0, 'PO:ISUPAP1');
        require(_uniswapPriceAveragingPeriod != uniswapPriceAveragingPeriod, 'PO:ISUPAP2');
        uniswapPriceAveragingPeriod = _uniswapPriceAveragingPeriod;
        emit UniswapPriceAveragingPeriodUpdated(_uniswapPriceAveragingPeriod);
    }

    //-------------------------------- Global var setters end --------------------------------/

    //-------------------------------- Utils start --------------------------------/

    /**
     * @notice Used to get decimals for a token
     * @param _token address of the token
     * @return number of decimals for the token
     **/
    function getDecimals(address _token) private view returns (uint8) {
        require(AddressUpgradeable.isContract(_token), 'PO:IGD1');

        try ERC20(_token).decimals() returns (uint8 v) {
            return v;
        } catch Error(string memory) {
            return 0;
        } catch (bytes memory) {
            return 0;
        }
    }

    // gets the token id for a pair of tokens irrespective of the order
    function getUniswapPoolTokenId(address num, address den) private pure returns (bytes32) {
        require(num != address(0) && den != address(0), 'PO:IGUPT1');

        if (uint256(num) < uint256(den)) {
            return keccak256(abi.encodePacked(num, den));
        } else {
            return keccak256(abi.encodePacked(den, num));
        }
    }

    /**
     * @notice used to check if price feed exists between 2 tokens
     * @param token1 one of the token for which price feed is to be checked
     * @param token2 other token for which price feed is to be checked
     * @return if price feed exists for the token pair
     **/
    function doesFeedExist(address token1, address token2) external view override returns (bool) {
        if (chainlinkFeedAddresses[token1].oracle != address(0) && chainlinkFeedAddresses[token2].oracle != address(0)) {
            return true;
        }

        bytes32 _poolTokensId = getUniswapPoolTokenId(token1, token2);

        if (uniswapPools[_poolTokensId] != address(0)) return true;

        return false;
    }

    //-------------------------------- Utils end --------------------------------/
}
