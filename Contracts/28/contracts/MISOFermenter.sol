pragma solidity 0.6.12;

//----------------------------------------------------------------------------------
//    I n s t a n t
//
//        .:mmm.         .:mmm:.       .ii.  .:SSSSSSSSSSSSS.     .oOOOOOOOOOOOo.  
//      .mMM'':Mm.     .:MM'':Mm:.     .II:  :SSs..........     .oOO'''''''''''OOo.
//    .:Mm'   ':Mm.   .:Mm'   'MM:.    .II:  'sSSSSSSSSSSSSS:.  :OO.           .OO:
//  .'mMm'     ':MM:.:MMm'     ':MM:.  .II:  .:...........:SS.  'OOo:.........:oOO'
//  'mMm'        ':MMmm'         'mMm:  II:  'sSSSSSSSSSSSSS'     'oOOOOOOOOOOOO'  
//
//----------------------------------------------------------------------------------
//
// Chef Gonpachi's MISO Fermenter
//
// A factory to conveniently deploy your own token vault contracts
//
// Inspired by Bokky's EtherVendingMachince.io
// https://github.com/bokkypoobah/FixedSupplyTokenFactory
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// The above copyright notice and this permission notice shall be included 
// in all copies or substantial portions of the Software.
//
// Made for Sushi.com 
// 
// Enjoy. (c) Chef Gonpachi 2021 
// <https://github.com/chefgonpachi/MISO/>
//
// ---------------------------------------------------------------------
// SPDX-License-Identifier: GPL-3.0                        
// ---------------------------------------------------------------------


import "./Utils/CloneFactory.sol";
import "./Access/MISOAccessControls.sol";

/// @notice  Token escrow, lock up tokens for a period of time

contract MISOFermenter is CloneFactory {

    /// @notice Responsible for access rights to the contract.
    MISOAccessControls public accessControls;
    bytes32 public constant VAULT_MINTER_ROLE = keccak256("VAULT_MINTER_ROLE");

    /// @notice Whether farm factory has been initialized or not.
    bool private initialised;
    /// @notice Contract locked status. If locked, only minters can deploy
    bool public locked;

    /// @notice Struct to track Fermenter template.
    struct Fermenter{
        bool exists;
        uint256 templateId;
        uint256 index;
    }

    /// @notice Escrows created using the factory.
    address[] public escrows;

    /// @notice Template id to track respective escrow template.
    uint256 public escrowTemplateId;

    /// @notice Mapping from template id to escrow template address.
    mapping(uint256 => address) private escrowTemplates;

    /// @notice mapping from escrow template address to escrow template id
    mapping(address => uint256) private escrowTemplateToId;

    /// @notice mapping from escrow address to struct Fermenter
    mapping(address => Fermenter) public isChildEscrow;

    /// @notice Event emitted when first initializing MISO fermenter.
    event MisoInitFermenter(address sender);

    /// @notice Event emitted when escrow template added.
    event EscrowTemplateAdded(address newTemplate, uint256 templateId);

    /// @notice Event emitted when escrow template is removed.
    event EscrowTemplateRemoved(address template, uint256 templateId);

    /// @notice Event emitted when escrow is created.
    event EscrowCreated(address indexed owner, address indexed addr,address escrowTemplate);

    /**
     * @notice Single gateway to initialize the MISO Market with proper address.
     * @dev Can only be initialized once.
     * @param _accessControls Sets address to get the access controls from.
     */
    function initMISOFermenter(address _accessControls) external {
        /// @dev Maybe missing require message?
        require(!initialised);
        initialised = true;
        locked = true;
        accessControls = MISOAccessControls(_accessControls);
        emit MisoInitFermenter(msg.sender);
    }

    /**
     * @notice Sets the factory to be locked or unlocked.
     * @param _locked bool.
     */
    function setLocked(bool _locked) external {
        require(
            accessControls.hasAdminRole(msg.sender),
            "MISOFermenter: Sender must be admin"
        );
        locked = _locked;
    }


    /**
     * @notice Used to check whether an address has the minter role
     * @param _address EOA or contract being checked
     * @return bool True if the account has the role or false if it does not
     */
    function hasVaultMinterRole(address _address) public view returns (bool) {
        return accessControls.hasRole(VAULT_MINTER_ROLE, _address);
    }



    /**
     * @notice Creates a new escrow corresponding to template Id.
     * @param _templateId Template id of the escrow to create.
     * @return newEscrow Escrow address.
     */
    function createEscrow(uint256 _templateId) external returns (address newEscrow) {

        /// @dev If the contract is locked, only admin and minters can deploy. 
        if (locked) {
            require(accessControls.hasAdminRole(msg.sender) 
                    || accessControls.hasMinterRole(msg.sender)
                    || hasVaultMinterRole(msg.sender),
                "MISOFermenter: Sender must be minter if locked"
            );
        }

        require(escrowTemplates[_templateId]!= address(0));
        newEscrow = createClone(escrowTemplates[_templateId]);
        isChildEscrow[address(newEscrow)] = Fermenter(true,_templateId,escrows.length-1);
        escrows.push(newEscrow);
        emit EscrowCreated(msg.sender,address(newEscrow),escrowTemplates[_templateId]);
    }

    /**
     * @notice Function to add a escrow template to create through factory.
     * @dev Should have operator access.
     * @param _escrowTemplate Escrow template to create a token.
     */
    function addEscrowTemplate(address _escrowTemplate) external {
         require(
            accessControls.hasOperatorRole(msg.sender),
            "MISOFermenter: Sender must be operator"
        );
        escrowTemplateId++;
        escrowTemplates[escrowTemplateId] = _escrowTemplate;
        escrowTemplateToId[_escrowTemplate] = escrowTemplateId;
        emit EscrowTemplateAdded(_escrowTemplate, escrowTemplateId);
    }

    /**
     * @notice Function to remove a escrow template.
     * @dev Should have operator access.
     * @param _templateId Refers to template that is to be deleted.
     */
    function removeEscrowTemplate(uint256 _templateId) external {
        require(
            accessControls.hasOperatorRole(msg.sender),
            "MISOFermenter: Sender must be operator"
        );
        require(escrowTemplates[_templateId] != address(0));
        address template = escrowTemplates[_templateId];
        escrowTemplates[_templateId] = address(0);
        delete escrowTemplateToId[template];
        emit EscrowTemplateRemoved(template, _templateId);
    }

    /**
     * @notice Get the address of the escrow template based on template ID.
     * @param _templateId Escrow template ID.
     * @return Address of the required template ID.
     */
    function getEscrowTemplate(uint256 _templateId) external view returns (address) {
        return escrowTemplates[_templateId];
    }

    /**
     * @notice Get the ID based on template address.
     * @param _escrowTemplate Escrow template address.
     * @return templateId ID of the required template address.
     */
    function getTemplateId(address _escrowTemplate) external view returns (uint256 templateId) {
        return escrowTemplateToId[_escrowTemplate];
    }

    /**
     * @notice Get the total number of escrows in the factory.
     * @return Escrow count.
     */
    function numberOfTokens() external view returns (uint256) {
        return escrows.length;
    }


}
