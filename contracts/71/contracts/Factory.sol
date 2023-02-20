/**
 * @title Factory
 * @author @InsureDAO
 * @notice This contract is the functory contract that manages functions related to market creation activities.
 * SPDX-License-Identifier: GPL-3.0
 */

pragma solidity 0.8.7;

import "./interfaces/IOwnership.sol";
import "./interfaces/IUniversalMarket.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/IFactory.sol";
import "hardhat/console.sol";

contract Factory is IFactory {
    event MarketCreated(
        address indexed market,
        address indexed template,
        string _metaData,
        uint256[] conditions,
        address[] references
    );
    event TemplateApproval(
        IUniversalMarket indexed template,
        bool approval,
        bool isOpen,
        bool duplicate
    );
    event ReferenceApproval(
        IUniversalMarket indexed template,
        uint256 indexed slot,
        address target,
        bool approval
    );
    event ConditionApproval(
        IUniversalMarket indexed template,
        uint256 indexed slot,
        uint256 target
    );

    address[] public markets;

    struct Template {
        bool isOpen; //true if the market allows anyone to create a market
        bool approval; //true if the template exists
        bool allowDuplicate; //true if the market with same ID is allowed
    }
    mapping(address => Template) public templates;
    //mapping of authorized market template address

    mapping(address => mapping(uint256 => mapping(address => bool)))
        public reflist;
    //Authorized reference(address) list for market market template
    //Each template has different set of references
    //true if that address is authorized within the template
    // Example reference list for pool template v1
    // references[0] = target governance token address
    // references[1] = underlying token address
    // references[2] = registry
    // references[3] = parameter

    mapping(address => mapping(uint256 => uint256)) public conditionlist;
    //Authorized condition(uint256) list for market temaplate
    //Each template has different set of conditions
    //true if that address is authorized within the template
    // Example condition list for pool template v1
    // conditions[0] = minimim deposit amount

    address public registry;
    IOwnership public ownership;

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Restricted: caller is not allowed to operate"
        );
        _;
    }

    constructor(address _registry, address _ownership) {
        registry = _registry;
        ownership = IOwnership(_ownership);
    }

    /**
     * @notice A function to approve or disapprove templates.
     * Only owner of the contract can operate.
     * @param _template template address, which must be registered
     * @param _approval true if a market is allowed to create based on the template
     * @param _isOpen true if anyone can create a market based on the template
     * @param _duplicate true if a market with duplicate target id is allowed
     */
    function approveTemplate(
        IUniversalMarket _template,
        bool _approval,
        bool _isOpen,
        bool _duplicate
    ) external override onlyOwner {
        require(address(_template) != address(0));
        templates[address(_template)].approval = _approval;
        templates[address(_template)].isOpen = _isOpen;
        templates[address(_template)].allowDuplicate = _duplicate;
        emit TemplateApproval(_template, _approval, _isOpen, _duplicate);
    }

    /**
     * @notice A function to preset reference.
     * Only owner of the contract can operate.
     * @param _template template address, which must be registered
     * @param _slot the index within reference array
     * @param _target the reference  address
     * @param _approval true if the reference is approved
     */
    function approveReference(
        IUniversalMarket _template,
        uint256 _slot,
        address _target,
        bool _approval
    ) external override onlyOwner {
        require(
            templates[address(_template)].approval == true,
            "ERROR: UNAUTHORIZED_TEMPLATE"
        );
        reflist[address(_template)][_slot][_target] = _approval;
        emit ReferenceApproval(_template, _slot, _target, _approval);
    }

    /**
     * @notice A function to preset reference.
     * Only owner of the contract can operate.
     * @param _template template address, which must be registered
     * @param _slot the index within condition array
     * @param _target the condition uint
     */
    function setCondition(
        IUniversalMarket _template,
        uint256 _slot,
        uint256 _target
    ) external override onlyOwner {
        require(
            templates[address(_template)].approval == true,
            "ERROR: UNAUTHORIZED_TEMPLATE"
        );
        conditionlist[address(_template)][_slot] = _target;
        emit ConditionApproval(_template, _slot, _target);
    }

    /**
     * @notice A function to create markets.
     * This function is market model agnostic.
     * @param _template template address, which must be registered
     * @param _metaData arbitrary string to store market information
     * @param _conditions array of conditions
     * @param _references array of references
     * @return created market address
     */
    function createMarket(
        IUniversalMarket _template,
        string memory _metaData,
        uint256[] memory _conditions,
        address[] memory _references
    ) public override returns (address) {
        //check eligibility
        require(
            templates[address(_template)].approval == true,
            "ERROR: UNAUTHORIZED_TEMPLATE"
        );
        if (templates[address(_template)].isOpen == false) {
            require(
                ownership.owner() == msg.sender,
                "ERROR: UNAUTHORIZED_SENDER"
            );
        }
        if (_references.length > 0) {
            for (uint256 i = 0; i < _references.length; i++) {
                require(
                    reflist[address(_template)][i][_references[i]] == true ||
                        reflist[address(_template)][i][address(0)] == true,
                    "ERROR: UNAUTHORIZED_REFERENCE"
                );
            }
        }

        if (_conditions.length > 0) {
            for (uint256 i = 0; i < _conditions.length; i++) {
                if (conditionlist[address(_template)][i] > 0) {
                    _conditions[i] = conditionlist[address(_template)][i];
                }
            }
        }

        if (
            IRegistry(registry).confirmExistence(
                address(_template),
                _references[0]
            ) == false
        ) {
            IRegistry(registry).setExistence(
                address(_template),
                _references[0]
            );
        } else {
            if (templates[address(_template)].allowDuplicate == false) {
                revert("ERROR: DUPLICATE_MARKET");
            }
        }

        //create market
        IUniversalMarket market = IUniversalMarket(
            _createClone(address(_template))
        );

        IRegistry(registry).supportMarket(address(market));
        
        markets.push(address(market));


        //initialize
        market.initialize(_metaData, _conditions, _references);

        emit MarketCreated(
            address(market),
            address(_template),
            _metaData,
            _conditions,
            _references
        );

        return address(market);
    }

    /**
     * @notice Template Code for the create clone method:
     * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1167.md
     */
    function _createClone(address target) internal returns (address result) {
        // convert address to bytes20 for assembly use
        bytes20 targetBytes = bytes20(target);
        assembly {
            // allocate clone memory
            let clone := mload(0x40)
            // store initial portion of the delegation contract code in bytes form
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            // store the provided address
            mstore(add(clone, 0x14), targetBytes)
            // store the remaining delegation contract code
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            // create the actual delegate contract reference and return its address
            result := create(0, clone, 0x37)
        }
    }
}
