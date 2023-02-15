// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.1;
import "./interfaces/vault/ICauldronGov.sol";
import "./interfaces/vault/ILadleGov.sol";
import "./interfaces/vault/IMultiOracleGov.sol";
import "./interfaces/vault/IJoinFactory.sol";
import "./interfaces/vault/IJoin.sol";
import "./interfaces/vault/IFYTokenFactory.sol";
import "./interfaces/vault/IFYToken.sol";
import "./interfaces/vault/DataTypes.sol";
import "./interfaces/yieldspace/IPoolFactory.sol";
import "./utils/access/AccessControl.sol";
import "./constants/Constants.sol";
import "./math/CastBytes32Bytes6.sol";


interface IOwnable {
    function transferOwnership(address) external;
}

/// @dev Ladle orchestrates contract calls throughout the Yield Protocol v2 into useful and efficient governance features.
contract Wand is AccessControl, Constants {
    using CastBytes32Bytes6 for bytes32;

    event Point(bytes32 indexed param, address value);

    bytes4 public constant JOIN = bytes4(keccak256("join(address,uint128)"));
    bytes4 public constant EXIT = bytes4(keccak256("exit(address,uint128)"));
    bytes4 public constant MINT = bytes4(keccak256("mint(address,uint256)"));
    bytes4 public constant BURN = bytes4(keccak256("burn(address,uint256)"));

    ICauldronGov public cauldron;
    ILadleGov public ladle;
    address public witch;
    IPoolFactory public poolFactory;
    IJoinFactory public joinFactory;
    IFYTokenFactory public fyTokenFactory;

    constructor (
        ICauldronGov cauldron_,
        ILadleGov ladle_,
        address witch_,
        IPoolFactory poolFactory_,
        IJoinFactory joinFactory_,
        IFYTokenFactory fyTokenFactory_
    ) {
        cauldron = cauldron_;
        ladle = ladle_;
        witch = witch_;
        poolFactory = poolFactory_;
        joinFactory = joinFactory_;
        fyTokenFactory = fyTokenFactory_;
    }

    /// @dev Point to a different cauldron, ladle, witch, poolFactory, joinFactory or fyTokenFactory
    function point(bytes32 param, address value) external auth {
        if (param == "cauldron") cauldron = ICauldronGov(value);
        else if (param == "ladle") ladle = ILadleGov(value);
        else if (param == "witch") witch = value;
        else if (param == "poolFactory") poolFactory = IPoolFactory(value);
        else if (param == "joinFactory") joinFactory = IJoinFactory(value);
        else if (param == "fyTokenFactory") fyTokenFactory = IFYTokenFactory(value);
        else revert("Unrecognized parameter");
        emit Point(param, value);
    }

    /// @dev Add an existing asset to the protocol, meaning:
    ///  - Add the asset to the cauldron
    ///  - Deploy a new Join, and integrate it with the Ladle
    ///  - If the asset is a base, integrate its rate source
    ///  - If the asset is a base, integrate a spot source and set a debt ceiling for any provided ilks
    function addAsset(
        bytes6 assetId,
        address asset
    ) external auth {
        // Add asset to cauldron, deploy new Join, and add it to the ladle
        require (address(asset) != address(0), "Asset required");
        cauldron.addAsset(assetId, asset);
        AccessControl join = AccessControl(joinFactory.createJoin(asset));  // We need the access control methods of Join
        bytes4[] memory sigs = new bytes4[](2);
        sigs[0] = JOIN;
        sigs[1] = EXIT;
        join.grantRoles(sigs, address(ladle));
        join.grantRole(join.ROOT(), msg.sender);
        // join.renounceRole(join.ROOT(), address(this));  // Wand requires ongoing rights to set up permissions to joins
        ladle.addJoin(assetId, address(join));
    }

    /// @dev Make a base asset out of a generic asset, by adding rate and chi oracles.
    /// This assumes CompoundMultiOracles, which deliver both rate and chi.
    function makeBase(bytes6 assetId, IMultiOracleGov oracle, address rateSource, address chiSource) external auth {
        require (address(oracle) != address(0), "Oracle required");
        require (rateSource != address(0), "Rate source required");
        require (chiSource != address(0), "Chi source required");

        oracle.setSource(assetId, RATE.b6(), rateSource);
        oracle.setSource(assetId, CHI.b6(), chiSource);
        cauldron.setRateOracle(assetId, IOracle(address(oracle)));
        
        AccessControl baseJoin = AccessControl(address(ladle.joins(assetId)));
        baseJoin.grantRole(JOIN, witch); // Give the Witch permission to join base
    }

    /// @dev Make an ilk asset out of a generic asset, by adding a spot oracle against a base asset, collateralization ratio, and debt ceiling.
    function makeIlk(bytes6 baseId, bytes6 ilkId, IMultiOracleGov oracle, address spotSource, uint32 ratio, uint96 max, uint24 min, uint8 dec) external auth {
        oracle.setSource(baseId, ilkId, spotSource);
        cauldron.setSpotOracle(baseId, ilkId, IOracle(address(oracle)), ratio);
        cauldron.setDebtLimits(baseId, ilkId, max, min, dec);

        AccessControl ilkJoin = AccessControl(address(ladle.joins(ilkId)));
        ilkJoin.grantRole(EXIT, witch); // Give the Witch permission to exit ilk
    }

    /// @dev Add an existing series to the protocol, by deploying a FYToken, and registering it in the cauldron with the approved ilks
    /// This must be followed by a call to addPool
    function addSeries(
        bytes6 seriesId,
        bytes6 baseId,
        uint32 maturity,
        bytes6[] memory ilkIds,
        string memory name,
        string memory symbol
    ) external auth {
        address base = cauldron.assets(baseId);
        require(base != address(0), "Base not found");

        IJoin baseJoin = ladle.joins(baseId);
        require(address(baseJoin) != address(0), "Join not found");

        IOracle oracle = cauldron.rateOracles(baseId);
        require(address(oracle) != address(0), "Chi oracle not found");

        AccessControl fyToken = AccessControl(fyTokenFactory.createFYToken(
            baseId,
            oracle,
            baseJoin,
            maturity,
            name,     // Derive from base and maturity, perhaps
            symbol    // Derive from base and maturity, perhaps
        ));

        // Allow the fyToken to pull from the base join for redemption
        bytes4[] memory sigs = new bytes4[](1);
        sigs[0] = EXIT;
        AccessControl(address(baseJoin)).grantRoles(sigs, address(fyToken));

        // Allow the ladle to issue and cancel fyToken
        sigs = new bytes4[](2);
        sigs[0] = MINT;
        sigs[1] = BURN;
        fyToken.grantRoles(sigs, address(ladle));

        // Pass ownership of the fyToken to msg.sender
        fyToken.grantRole(fyToken.ROOT(), msg.sender);
        fyToken.renounceRole(fyToken.ROOT(), address(this));

        // Add fyToken/series to the Cauldron and approve ilks for the series
        cauldron.addSeries(seriesId, baseId, IFYToken(address(fyToken)));
        cauldron.addIlks(seriesId, ilkIds);

        // Create the pool for the base and fyToken
        poolFactory.createPool(base, address(fyToken));
        IOwnable pool = IOwnable(poolFactory.calculatePoolAddress(base, address(fyToken)));
        

        // Pass ownership of pool to msg.sender
        pool.transferOwnership(msg.sender);

        // Register pool in Ladle
        ladle.addPool(seriesId, address(pool));
    }
}