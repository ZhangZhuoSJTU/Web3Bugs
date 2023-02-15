// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.10;

import "./ICollateral.sol";
import "./IIncentivizer.sol";
import "./IProduct.sol";
import "./IProductProvider.sol";
import "../utils/types/UFixed18.sol";

interface IFactory {
    /// @dev Controller of a one or many products
    struct Controller {
        /// @dev Owner of the product, allowed to update select parameters
        address owner;

        /// @dev Treasury of the product, collects fees
        address treasury;
    }

    event CollateralUpdated(ICollateral newCollateral);
    event IncentivizerUpdated(IIncentivizer newIncentivizer);
    event ProductBaseUpdated(IProduct newProductBase);
    event FeeUpdated(UFixed18 newFee);
    event MinFundingFeeUpdated(UFixed18 newMinFundingFee);
    event MinCollateralUpdated(UFixed18 newMinCollateral);
    event ControllerUpdated(uint256 indexed controllerId, address newOwner, address newTreasury);
    event AllowedUpdated(uint256 indexed controllerId, bool allowed);
    event PauserUpdated(address pauser);
    event IsPausedUpdated(bool isPaused);
    event ControllerCreated(uint256 indexed controllerId, address owner, address treasury);
    event ProductCreated(IProduct indexed product, IProductProvider provider);

    error FactoryAlreadyInitializedError();
    error FactoryNoZeroControllerError();
    error FactoryNotAllowedError();
    error FactoryNotPauserError(address sender);
    error FactoryNotOwnerError(uint256 controllerId);

    function initialized() external view returns (bool);
    function pauser() external view returns (address);
    function isPaused() external view returns (bool);
    function collateral() external view returns (ICollateral);
    function incentivizer() external view returns (IIncentivizer);
    function productBase() external view returns (IProduct);
    function controllers(uint256 collateralId) external view returns (Controller memory);
    function controllerFor(IProduct product) external view returns (uint256);
    function allowed(uint256 collateralId) external view returns (bool);
    function fee() external view returns (UFixed18);
    function minFundingFee() external view returns (UFixed18);
    function minCollateral() external view returns (UFixed18);
    function initialize(ICollateral collateral_, IIncentivizer incentivizer_, IProduct productBase_, address treasury_) external;
    function createController(address controllerTreasury) external returns (uint256);
    function updateController(uint256 controllerId, Controller memory newController) external;
    function createProduct(uint256 controllerId, IProductProvider provider) external returns (IProduct);
    function updateCollateral(ICollateral newCollateral) external;
    function updateIncentivizer(IIncentivizer newIncentivizer) external;
    function updateProductBase(IProduct newProductBase) external;
    function updateFee(UFixed18 newFee) external;
    function updateMinFundingFee(UFixed18 newMinFundingFee) external;
    function updateMinCollateral(UFixed18 newMinCollateral) external;
    function updatePauser(address newPauser) external;
    function updateIsPaused(bool newIsPaused) external;
    function updateAllowed(uint256 controllerId, bool newAllowed) external;
    function isProduct(IProduct product) external view returns (bool);
    function owner() external view returns (address);
    function owner(uint256 controllerId) external view returns (address);
    function owner(IProduct product) external view returns (address);
    function treasury() external view returns (address);
    function treasury(uint256 controllerId) external view returns (address);
    function treasury(IProduct product) external view returns (address);
}