pragma solidity 0.6.12;

import "../Utils/CloneFactory.sol";
import "./MISOAccessControls.sol";


contract MISOAccessFactory is CloneFactory {

    /// @notice Responsible for access rights to the contract.
    MISOAccessControls public accessControls;

    /// @notice Address of the template for access controls.
    address public accessControlTemplate;

    /// @notice Whether initialized or not.
    bool private initialised;

    /// @notice Minimum fee number.
    uint256 public minimumFee;

    /// @notice Devs address.
    address public devaddr;

    /// @notice AccessControls created using the factory.
    address[] public children;

    /// @notice Tracks if a contract is made by the factory.
    mapping(address => bool) public isChild;

    /// @notice Event emitted when first initializing Miso AccessControl Factory.
    event MisoInitAccessFactory(address sender);

    /// @notice Event emitted when a access is created using template id.
    event AccessControlCreated(address indexed owner,  address accessControls, address admin, address accessTemplate);

    /// @notice Event emitted when a access template is added.
    event AccessControlTemplateAdded(address oldAccessControl, address newAccessControl);

    /// @notice Event emitted when a access template is removed.
    event AccessControlTemplateRemoved(address access, uint256 templateId);

    /// @notice Event emitted when a access template is removed.
    event MinimumFeeUpdated(uint oldFee, uint newFee);

    /// @notice Event emitted when a access template is removed.
    event DevAddressUpdated(address oldDev, address newDev);


    constructor() public {
    }

    /**
     * @notice Single gateway to initialize the MISO AccessControl Factory with proper address and set minimum fee.
     * @dev Can only be initialized once.
     * @param _minimumFee Minimum fee number.
     * @param _accessControls Address of the access controls.
     */
    function initMISOAccessFactory(uint256 _minimumFee, address _accessControls) external {
        require(!initialised);
        initialised = true;
        minimumFee = _minimumFee;
        accessControls = MISOAccessControls(_accessControls);
        emit MisoInitAccessFactory(msg.sender);
    }

    /// @notice Get the total number of children in the factory.
    function numberOfChildren() external view returns (uint256) {
        return children.length;
    }

    /**
     * @notice Creates access corresponding to template id.
     * @dev Initializes access with parameters passed.
     * @param _admin Address of admin access.
     */
    function deployAccessControl(address _admin) external payable returns (address access) {
        require(msg.value >= minimumFee, "Minimum fee needs to be paid.");
        require(accessControlTemplate != address(0), "Access control template does not exist");
        access = createClone(accessControlTemplate);
        isChild[address(access)] = true;
        children.push(address(access));
        MISOAccessControls(access).initAccessControls(_admin);
        emit AccessControlCreated(msg.sender, address(access), _admin, accessControlTemplate);
        if (msg.value > 0) {
            payable(devaddr).transfer(msg.value);
        }
    }

    /**
     * @notice Function to add new contract templates for the factory.
     * @dev Should have operator access.
     * @param _template Template to create new access controls.
     */
    function updateAccessTemplate(address _template) external {
        require(
            accessControls.hasAdminRole(msg.sender),
            "MISOAccessFactory.updateAccessTemplate: Sender must be admin"
        );
        require(_template != address(0));
        emit AccessControlTemplateAdded(_template, accessControlTemplate);
        accessControlTemplate = _template;
    }

    /**
     * @notice Sets dev address.
     * @dev Should have operator access.
     * @param _devaddr Devs address.
     */
    function setDev(address _devaddr) external {
        require(
            accessControls.hasAdminRole(msg.sender),
            "MISOAccessFactory.setMinimumFee: Sender must be admin"
        );
        emit DevAddressUpdated(devaddr, _devaddr);
        devaddr = _devaddr;
    }

    /**
     * @notice Sets minimum fee.
     * @dev Should have operator access.
     * @param _minimumFee Minimum fee number.
     */
    function setMinimumFee(uint256 _minimumFee) external {
        require(
            accessControls.hasAdminRole(msg.sender),
            "MISOAccessFactory.setMinimumFee: Sender must be admin"
        );
        emit MinimumFeeUpdated(minimumFee, _minimumFee);
        minimumFee = _minimumFee;
    }
}
