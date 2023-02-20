pragma solidity 0.6.12;

import "../OpenZeppelin/math/SafeMath.sol";
import "../Utils/Owned.sol";
import "../Utils/CloneFactory.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IPointList.sol";
import "../Utils/SafeTransfer.sol";
import "./MISOAccessControls.sol";

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
// Chef Gonpachi's List Factory
//
// A factory for deploying all sorts of list based contracts
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


contract ListFactory is CloneFactory, SafeTransfer {
    using SafeMath for uint;

    /// @notice Responsible for access rights to the contract.
    MISOAccessControls public accessControls;

    /// @notice Whether market has been initialized or not.
    bool private initialised;

    /// @notice Address of the point list template.
    address public pointListTemplate;

    /// @notice New point list address.
    address public newAddress;

    /// @notice Minimum fee number.
    uint256 public minimumFee;

    /// @notice Tracks if list is made by the factory.
    mapping(address => bool) public isChild;

    /// @notice An array of list addresses.
    address[] public lists;

    /// @notice Any MISO dividends collected are sent here.
    address payable public misoDiv;

    /// @notice Event emitted when point list is deployed.
    event PointListDeployed(address indexed operator, address indexed addr, address pointList, address owner);

    /// @notice Event emitted when factory is deprecated.
    event FactoryDeprecated(address newAddress);

    /// @notice Event emitted when minimum fee is updated.
    event MinimumFeeUpdated(uint oldFee, uint newFee);

    /// @notice Event emitted when point list factory is initialised.
    event MisoInitListFactory();

    /**
     * @notice Initializes point list factory variables.
     * @param _accessControls Access control contract address.
     * @param _pointListTemplate Point list template address.
     * @param _minimumFee Minimum fee number.
     */
    function initListFactory(address _accessControls, address _pointListTemplate, uint256 _minimumFee) external  {
        require(!initialised);
        require(_accessControls != address(0), "Incorrect access controls");
        require(_pointListTemplate != address(0), "Incorrect list template");
        accessControls = MISOAccessControls(_accessControls);
        pointListTemplate = _pointListTemplate;
        minimumFee = _minimumFee;
        initialised = true;
        emit MisoInitListFactory();
    }

    /**
     * @notice Gets the number of point lists created by factory.
     * @return uint Number of point lists.
     */
    function numberOfChildren() external view returns (uint) {
        return lists.length;
    }

    /**
     * @notice Deprecates factory.
     * @param _newAddress Blank address.
     */
    function deprecateFactory(address _newAddress) external {
        require(accessControls.hasAdminRole(msg.sender), "ListFactory: Sender must be admin");
        require(newAddress == address(0));
        emit FactoryDeprecated(_newAddress);
        newAddress = _newAddress;
    }

    /**
     * @notice Sets minimum fee.
     * @param _minimumFee Minimum fee number.
     */
    function setMinimumFee(uint256 _minimumFee) external {
        require(accessControls.hasAdminRole(msg.sender), "ListFactory: Sender must be admin");
        emit MinimumFeeUpdated(minimumFee, _minimumFee);
        minimumFee = _minimumFee;
    }

    /**
     * @notice Sets dividend address.
     * @param _divaddr Dividend address.
     */
    function setDividends(address payable _divaddr) external  {
        require(accessControls.hasAdminRole(msg.sender), "MISOTokenFactory: Sender must be Admin");
        misoDiv = _divaddr;
    }

    /**
     * @notice Deploys new point list.
     * @param _listOwner List owner address.
     * @param _accounts An array of account addresses.
     * @param _amounts An array of corresponding point amounts.
     * @return pointList Point list address.
     */
    function deployPointList(
        address _listOwner,
        address[] memory _accounts,
        uint256[] memory _amounts
    )
        external payable returns (address pointList)
    {
        require(msg.value >= minimumFee);
        pointList = createClone(pointListTemplate);
        if (_accounts.length > 0) {
            IPointList(pointList).initPointList(address(this));
            IPointList(pointList).setPoints(_accounts, _amounts);
            MISOAccessControls(pointList).addAdminRole(_listOwner);
            MISOAccessControls(pointList).removeAdminRole(address(this));
        } else {
            IPointList(pointList).initPointList(_listOwner);
        }
        isChild[address(pointList)] = true;
        lists.push(address(pointList));
        emit PointListDeployed(msg.sender, address(pointList), pointListTemplate, _listOwner);
        if (msg.value > 0) {
            misoDiv.transfer(msg.value);
        }
    }

    /**
     * @notice Funtion for transfering any ERC20 token.
     * @param _tokenAddress Address to send from.
     * @param _tokens Number of tokens.
     * @return success True.
     */
    function transferAnyERC20Token(address _tokenAddress, uint256 _tokens) external returns (bool success) {
        require(accessControls.hasAdminRole(msg.sender), "ListFactory: Sender must be operator");
        _safeTransfer(_tokenAddress, misoDiv, _tokens);
        return true;
    }

    receive () external payable {
        revert();
    }
}
