// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/ICollateral.sol";
import "../interfaces/IIncentivizer.sol";
import "../interfaces/IProduct.sol";

/**
 * @title Factory
 * @notice Manages creating new products and global protocol parameters.
 */
contract Factory is IFactory {

    /// @dev Whether the factory has been initialized
    bool public initialized;

    /// @dev Secondary pauser address (not owner, but has permission to update isPaused)
    address public pauser;

    /// @dev Whether the protocol is currently paused
    bool public isPaused;

    /// @dev Collateral contract address for the protocol
    ICollateral public collateral;

    /// @dev Incentivizer contract address for the protocol
    IIncentivizer public incentivizer;

    /// @dev Base Product implementation contract address for the protocol
    IProduct public productBase;

    /// @dev List of product controllers
    Controller[] private _controllers;

    /// @dev Mapping of the controller for each  product
    mapping(IProduct => uint256) public controllerFor;

    /// @dev Whether a specific controller is allowed to create a new product
    mapping(uint256 => bool) public allowed;

    /// @dev Percent of the fee that goes to the protocol treasury vs the product treasury
    UFixed18 public fee;

    /// @dev Minimum allowable funding fee for a product
    UFixed18 public minFundingFee;

    /// @dev Minimum allowable collateral amount per user account
    UFixed18 public minCollateral;

    /**
     * @notice Initializes the contract state
     * @param collateral_ Collateral contract address
     * @param incentivizer_ Incentivizer contract address
     * @param productBase_ Base Product implementation contract address
     * @param treasury_ Protocol treasury address
     */
    function initialize(
        ICollateral collateral_,
        IIncentivizer incentivizer_,
        IProduct productBase_,
        address treasury_
    ) external {
        if (initialized) revert FactoryAlreadyInitializedError();

        createController(treasury_);

        updatePauser(msg.sender);
        updateCollateral(collateral_);
        updateIncentivizer(incentivizer_);
        updateProductBase(productBase_);
        updateFee(UFixed18Lib.ratio(50, 100));
        updateMinFundingFee(UFixed18Lib.ratio(10, 100));

        initialized = true;
    }

    /**
     * @notice Creates a new controller with `msg.sender` as the owner
     * @param controllerTreasury Treasury address for the controller
     * @return New controller ID
     */
    function createController(address controllerTreasury) public returns (uint256) {
        uint256 controllerId = _controllers.length;

        _controllers.push(Controller({
            owner: msg.sender,
            treasury: controllerTreasury
        }));

        emit ControllerCreated(controllerId, msg.sender, controllerTreasury);

        return controllerId;
    }

    /**
     * @notice Updates the owner and treasury of an existing controller
     * @dev Must be called by the controller's current owner
     * @param controllerId Controller to update
     * @param newController New controller owner and treasury
     */
    function updateController(uint256 controllerId, Controller memory newController) onlyOwner(controllerId) external {
        _controllers[controllerId] = newController;
        emit ControllerUpdated(controllerId, newController.owner, newController.treasury);
    }

    /**
     * @notice Creates a new product market with `provider`
     * @dev Controller caller must be allowed
     * @param controllerId Controller that will own the product
     * @param provider Provider that will service the market
     * @return New product contract address
     */
    function createProduct(uint256 controllerId, IProductProvider provider) onlyOwner(controllerId) external returns (IProduct) {
        if (controllerId == 0) revert FactoryNoZeroControllerError();
        if (!allowed[0] && !allowed[controllerId]) revert FactoryNotAllowedError();

        IProduct newProduct = IProduct(Clones.clone(address(productBase)));
        newProduct.initialize(provider);
        controllerFor[newProduct] = controllerId;
        emit ProductCreated(newProduct, provider);

        return newProduct;
    }

    /**
     * @notice Updates the Collateral contract address
     * @param newCollateral New Collateral contract address
     */
    function updateCollateral(ICollateral newCollateral) onlyOwner(0) public {
        collateral = newCollateral;
        emit CollateralUpdated(newCollateral);
    }

    /**
     * @notice Updates the Incentivizer contract address
     * @param newIncentivizer New Incentivizer contract address
     */
    function updateIncentivizer(IIncentivizer newIncentivizer) onlyOwner(0) public {
        incentivizer = newIncentivizer;
        emit IncentivizerUpdated(newIncentivizer);
    }

    /**
     * @notice Updates the base Product contract address
     * @param newProductBase New base Product contract address
     */
    function updateProductBase(IProduct newProductBase) onlyOwner(0) public {
        productBase = newProductBase;
        emit ProductBaseUpdated(newProductBase);
    }

    /**
     * @notice Updates the protocol-product fee split
     * @param newFee New protocol-product fee split
     */
    function updateFee(UFixed18 newFee) onlyOwner(0) public {
        fee = newFee;
        emit FeeUpdated(newFee);
    }

    /**
     * @notice Updates the minimum allowed funding fee
     * @param newMinFundingFee New minimum allowed funding fee
     */
    function updateMinFundingFee(UFixed18 newMinFundingFee) onlyOwner(0) public {
        minFundingFee = newMinFundingFee;
        emit MinFundingFeeUpdated(newMinFundingFee);
    }

    /**
     * @notice Updates the minimum allowed collateral amount per user account
     * @param newMinCollateral New minimum allowed collateral amount
     */
    function updateMinCollateral(UFixed18 newMinCollateral) onlyOwner(0) public {
        minCollateral = newMinCollateral;
        emit MinCollateralUpdated(newMinCollateral);
    }

    /**
     * @notice Updates the secondary pauser address
     * @param newPauser New secondary pauser address
     */
    function updatePauser(address newPauser) onlyOwner(0) public {
        pauser = newPauser;
        emit PauserUpdated(newPauser);
    }

    /**
     * @notice Updates the protocol pause status
     * @param newIsPaused New protocol pause status
     */
    function updateIsPaused(bool newIsPaused) public {
        if (msg.sender != owner() && msg.sender != pauser) revert FactoryNotPauserError(msg.sender);

        isPaused = newIsPaused;
        emit IsPausedUpdated(newIsPaused);
    }

    /**
     * @notice Updates whether `controllerId` is allowed to create new products
     * @param controllerId Controller to update
     * @param newAllowed New allowed status for `controllerId`
     */
    function updateAllowed(uint256 controllerId, bool newAllowed) onlyOwner(0) external {
        allowed[controllerId] = newAllowed;
        emit AllowedUpdated(controllerId, newAllowed);
    }

    /**
     * @notice Returns whether a contract is a product
     * @param product Contract address to check
     * @return Whether a contract is a product
     */
    function isProduct(IProduct product) public view returns (bool) {
        return controllerFor[product] != 0;
    }

    /**
     * @notice Returns controller state for controller `controllerId`
     * @param controllerId Controller to return for
     * @return Controller state
     */
    function controllers(uint256 controllerId) external view returns (Controller memory) {
        return _controllers[controllerId];
    }

    /**
     * @notice Returns the owner of the protocol
     * @return Owner of the protocol
     */
    function owner() public view returns (address) {
        return owner(0);
    }

    /**
     * @notice Returns the owner of the controller `controllerId`
     * @param controllerId Controller to return for
     * @return Owner of the controller
     */
    function owner(uint256 controllerId) public view returns (address) {
        return _controllers[controllerId].owner;
    }

    /**
     * @notice Returns the owner of the product `product`
     * @param product Product to return for
     * @return Owner of the product
     */
    function owner(IProduct product) public view returns (address) {
        return owner(controllerFor[product]);
    }

    /**
     * @notice Returns the treasury of the protocol
     * @return Treasury of the protocol
     */
    function treasury() public view returns (address) {
        return treasury(0);
    }

    /**
     * @notice Returns the treasury of the controller `controllerId`
     * @param controllerId Controller to return for
     * @return Treasury of the controller
     */
    function treasury(uint256 controllerId) public view returns (address) {
        return _controllers[controllerId].treasury;
    }

    /**
     * @notice Returns the treasury of the product `product`
     * @param product Product to return for
     * @return Treasury of the product
     */
    function treasury(IProduct product) public view returns (address) {
        return treasury(controllerFor[product]);
    }

    // @dev Only allow owner of `controllerId` to call
    modifier onlyOwner(uint256 controllerId) {
        if (msg.sender != owner(controllerId)) revert FactoryNotOwnerError(controllerId);

        _;
    }
}
