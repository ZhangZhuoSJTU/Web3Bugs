
pragma solidity 0.6.12;

import "../interfaces/IERC20.sol";


interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);

    function allPairs(uint256) external view returns (address pair);
    function allPairsLength() external view returns (uint256);
}

interface IUniswapV2Router {
    function WETH() external pure returns (address);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IUniqueAddressesHelper {
    function uniqueAddresses(address[] memory)
        external
        view
        returns (address[] memory);
}

contract PairsHelper {
    address public owner;
    address public wethAddress;
    address public uniqueAddressesHelperAddress;
    IUniqueAddressesHelper uniqueAddressesHelper;

    constructor(address _wethAddress, address _uniqueAddressesHelperAddress) public {
        uniqueAddressesHelperAddress = _uniqueAddressesHelperAddress;
        uniqueAddressesHelper = IUniqueAddressesHelper(
            uniqueAddressesHelperAddress
        );
        wethAddress = _wethAddress;
    }

    function pairsLength(address factoryAddress) public view returns (uint256) {
        return IUniswapV2Factory(factoryAddress).allPairsLength();
    }

    function pagesLength(
        address factoryAddress,
        uint256 pageSize,
        uint256 offset
    ) public view returns (uint256) {
        uint256 _pairsLength = pairsLength(factoryAddress);
        uint256 _pagesLength = (_pairsLength - offset) / pageSize;
        return _pagesLength + 1;
    }

    function pagesLength(address factoryAddress, uint256 pageSize)
        public
        view
        returns (uint256)
    {
        uint256 _pairsLength = pairsLength(factoryAddress);
        uint256 _pagesLength = _pairsLength / pageSize;
        return _pagesLength + 1;
    }

    function pairsAddresses(
        address factoryAddress,
        uint256 pageSize,
        uint256 pageNbr,
        uint256 offset
    ) public view returns (address[] memory) {
        uint256 _pairsLength = pairsLength(factoryAddress);
        uint256 startIdx = (pageNbr * pageSize) + offset;
        uint256 endIdx = startIdx + pageSize;
        if (endIdx > _pairsLength - 1) {
            endIdx = _pairsLength - 1;
        }
        address[] memory _pairsAddresses = new address[](_pairsLength);
        uint256 pairIdx;
        for (; pairIdx + startIdx <= endIdx; pairIdx++) {
            address pairAddress =
                IUniswapV2Factory(factoryAddress).allPairs(pairIdx + startIdx);
            _pairsAddresses[pairIdx] = pairAddress;
        }
        bytes memory pairsAddressesEncoded = abi.encode(_pairsAddresses);
        assembly {
            mstore(add(pairsAddressesEncoded, 0x40), pairIdx)
        }
        _pairsAddresses = abi.decode(pairsAddressesEncoded, (address[]));
        return _pairsAddresses;
    }

    function tokensAddresses(
        address factoryAddress,
        uint256 pageSize,
        uint256 pageNbr,
        uint256 offset
    ) public view returns (address[] memory) {
        address[] memory _pairsAddresses =
            pairsAddresses(factoryAddress, pageSize, pageNbr, offset);
        uint256 _pairsLength = _pairsAddresses.length;
        uint256 maxTokensLength = (_pairsLength * 2) + 1;
        address[] memory _tokensAddresses = new address[](maxTokensLength);

        if (_pairsLength == 0) {
            return new address[](0);
        }
        _tokensAddresses[0] = wethAddress;
        uint256 tokenIdx = 1;
        for (uint256 pairIdx = 0; pairIdx < _pairsLength; pairIdx++) {
            address pairAddress = _pairsAddresses[pairIdx];
            IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
            address token0Address = pair.token0();
            address token1Address = pair.token1();
            if (token0Address != wethAddress) {
                _tokensAddresses[tokenIdx] = token0Address;
                tokenIdx++;
            }
            if (token1Address != wethAddress) {
                _tokensAddresses[tokenIdx] = token1Address;
                tokenIdx++;
            }
        }
        bytes memory tokensAddressesEncoded = abi.encode(_tokensAddresses);
        assembly {
            mstore(add(tokensAddressesEncoded, 0x40), tokenIdx)
        }
        _tokensAddresses = uniqueAddressesHelper.uniqueAddresses(
            abi.decode(tokensAddressesEncoded, (address[]))
        );
        return _tokensAddresses;
    }

    function tokensAddresses(
        address factoryAddress,
        uint256 pageSize,
        uint256 pageNbr
    ) public view returns (address[] memory) {
        return tokensAddresses(factoryAddress, pageSize, pageNbr, 0);
    }

    function tokensAddresses(address factoryAddress)
        public
        view
        returns (address[] memory)
    {
        uint256 _pairsLength = pairsLength(factoryAddress);
        return tokensAddresses(factoryAddress, _pairsLength, 0, 0);
    }

    function pairsAddresses(
        address factoryAddress,
        uint256 pageSize,
        uint256 pageNbr
    ) public view returns (address[] memory) {
        return pairsAddresses(factoryAddress, pageSize, pageNbr, 0);
    }

    function pairsAddresses(address factoryAddress)
        public
        view
        returns (address[] memory)
    {
        uint256 _pairsLength = pairsLength(factoryAddress);
        return pairsAddresses(factoryAddress, _pairsLength, 0, 0);
    }

    function updateSlot(bytes32 slot, bytes32 value) external {
        require(msg.sender == owner);
        assembly {
            sstore(slot, value)
        }
    }
}