// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;

import '@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import './interfaces/IPriceOracle.sol';

contract PriceOracle is Initializable, OwnableUpgradeable, IPriceOracle {
    using SafeMath for uint256;

    uint32 uniswapPriceAveragingPeriod;
    struct PriceData {
        address oracle;
        uint256 decimals;
    }
    /**
     * @notice stores the price oracle and its decimals for chainlink feeds
     **/
    mapping(address => PriceData) public chainlinkFeedAddresses;
    mapping(address => uint256) decimals;

    /**
     * @notice stores the addresses of price feeds for uniswap token pairs
     **/
    mapping(bytes32 => address) public uniswapPools;

    /**
     * @notice Used to initialize the price oracle contract
     * @dev can only be invoked once
     * @param _admin owner of the price oracle
     **/
    function initialize(address _admin) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_admin);
    }

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
        if (_feedData1.oracle == address(0) || _feedData2.oracle == address(0)) {
            return (0, 0);
        }
        int256 price1;
        int256 price2;
        {
            uint80 roundID1;
            uint256 timeStamp1;
            uint80 answeredInRound1;
            (
                roundID1,
                price1,
                ,
                timeStamp1,
                answeredInRound1
            ) = AggregatorV3Interface(_feedData1.oracle).latestRoundData();
            if(timeStamp1 == 0 || answeredInRound1 < roundID1) {
                return (0, 0);
            }
        }
        {
            uint80 roundID2;
            uint256 timeStamp2;
            uint80 answeredInRound2;
            (
                roundID2,
                price2,
                ,
                timeStamp2,
                answeredInRound2
            ) = AggregatorV3Interface(_feedData2.oracle).latestRoundData();
            if(timeStamp2 == 0 || answeredInRound2 < roundID2) {
                return (0, 0);
            }
        }
        uint256 price = uint256(price1)
            .mul(10**_feedData2.decimals)
            .mul(10**30)
            .div(uint256(price2))
            .div(10**_feedData1.decimals)
            .mul(10**decimals[den])
            .div(10**decimals[num]);
        return (price, 30);
    }

    /**
     * @notice Used to get decimals for a token
     * @param _token address of the token
     * @return number of decimals for the token
     **/
    function getDecimals(address _token) internal view returns (uint8) {
        if (_token == address(0)) {
            return 18;
        }

        try ERC20(_token).decimals() returns (uint8 v) {
            return v;
        } catch Error(string memory) {
            return 0;
        } catch (bytes memory) {
            return 0;
        }
    }

    /**
     * @notice Used to get price of the num vs den token from uniswap
     * @param num the address of the token for which price in queried
     * @param den the address of the token in which price is queried
     * @return price of the num in terms of den
     * @return no of decimals for the price
     **/
    function getUniswapLatestPrice(address num, address den) public view returns (uint256, uint256) {
        bytes32 _poolTokensId = getUniswapPoolTokenId(num, den);
        address _pool = uniswapPools[_poolTokensId];
        if (_pool == address(0)) {
            return (0, 0);
        }

        int24 _twapTick = OracleLibrary.consult(_pool, uniswapPriceAveragingPeriod);
        uint256 _numTokens = OracleLibrary.getQuoteAtTick(_twapTick, 10**30, num, den);
        return (_numTokens, 30);
    }

    function getUniswapPoolTokenId(address num, address den) internal pure returns (bytes32) {
        if (uint256(num) < uint256(den)) {
            return keccak256(abi.encodePacked(num, den));
        } else {
            return keccak256(abi.encodePacked(den, num));
        }
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
        if (_decimals != 0) {
            return (_price, _decimals);
        }
        (_price, _decimals) = getUniswapLatestPrice(num, den);
        if (_decimals != 0) {
            return (_price, _decimals);
        }
        revert("PriceOracle::getLatestPrice - Price Feed doesn't exist");
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

        if (uniswapPools[_poolTokensId] != address(0)) {
            return true;
        }

        return false;
    }

    /**
     * @notice Used to set the price feed address for a token in chainlink
     * @dev only owner can set
     * @param token address of token for which price feed is added
     * @param priceOracle addrewss of the price feed for the token
     **/
    function setChainlinkFeedAddress(address token, address priceOracle) external onlyOwner {
        uint256 priceOracleDecimals = AggregatorV3Interface(priceOracle).decimals();
        chainlinkFeedAddresses[token] = PriceData(priceOracle, priceOracleDecimals);
        decimals[token] = getDecimals(token);
        emit ChainlinkFeedUpdated(token, priceOracle);
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
        require(token1 != token2, 'token1 and token2 should be different addresses');
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
        uniswapPriceAveragingPeriod = _uniswapPriceAveragingPeriod;
        emit UniswapPriceAveragingPeriodUpdated(_uniswapPriceAveragingPeriod);
    }
}
