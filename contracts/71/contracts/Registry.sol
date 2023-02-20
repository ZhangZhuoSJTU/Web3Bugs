// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "./interfaces/IOwnership.sol";
import "./interfaces/IRegistry.sol";

contract Registry is IRegistry {
    event ExistenceSet(address indexed template, address indexed target);
    event NewMarketRegistered(address market);
    event FactorySet(address factory);
    event CDSSet(address indexed target, address cds);

    address public factory;

    mapping(address => address) cds; //index => cds
    mapping(address => bool) markets; //true if the market is registered
    mapping(address => mapping(address => bool)) existence; //true if the certain id is already registered in market
    address[] allMarkets;

    IOwnership public ownership;

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Restricted: caller is not allowed to operate"
        );
        _;
    }

    constructor(address _ownership) {
        ownership = IOwnership(_ownership);
    }

    /**
     * @notice Set the factory address and allow it to regiser a new market
     * @param _factory factory address
     */
    function setFactory(address _factory) external override onlyOwner {
        require(_factory != address(0), "ERROR: ZERO_ADDRESS");

        factory = _factory;
        emit FactorySet(_factory);
    }

    /**
     * @notice Register a new market.
     * @param _market market address to register
     */
    function supportMarket(address _market) external override {
        require(!markets[_market], "ERROR: ALREADY_REGISTERED");
        require(
            msg.sender == factory || msg.sender == ownership.owner(),
            "ERROR: UNAUTHORIZED_CALLER"
        );
        require(_market != address(0), "ERROR: ZERO_ADDRESS");

        allMarkets.push(_market);
        markets[_market] = true;
        emit NewMarketRegistered(_market);
    }

    /**
     * @notice Register a new target address id and template address set.
     * @param _template template address
     * @param _target target address
     */
    function setExistence(address _template, address _target)
        external
        override
    {
        require(
            msg.sender == factory || msg.sender == ownership.owner(),
            "ERROR: UNAUTHORIZED_CALLER"
        );

        existence[_template][_target] = true;
        emit ExistenceSet(_template, _target);
    }

    /**
     * @notice Register the cds address for a particular address
     * @param _address address to set CDS
     * @param _cds CDS contract address
     */
    function setCDS(address _address, address _cds)
        external
        override
        onlyOwner
    {
        require(_cds != address(0), "ERROR: ZERO_ADDRESS");

        cds[_address] = _cds;
        emit CDSSet(_address, _cds);
    }

    /**
     * @notice Get the cds address for a particular address
     * @param _address address covered by CDS
     * @return true if the id within the market already exists
     */
    function getCDS(address _address) external view override returns (address) {
        if (cds[_address] == address(0)) {
            return cds[address(0)];
        } else {
            return cds[_address];
        }
    }

    /**
     * @notice Get whether the target address and id set exists
     * @param _template template address
     * @param _target target address
     * @return true if the id within the market already exists
     */
    function confirmExistence(address _template, address _target)
        external
        view
        override
        returns (bool)
    {
        return existence[_template][_target];
    }

    /**
     * @notice Get whether market is registered
     * @param _market market address to inquire
     * @return true if listed
     */
    function isListed(address _market) external view override returns (bool) {
        return markets[_market];
    }

    /**
     * @notice Get all market
     * @return all markets
     */
    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }
}
