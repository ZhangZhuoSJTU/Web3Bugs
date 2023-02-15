// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./IUniversalMarket.sol";

interface IFactory {
    function approveTemplate(
        IUniversalMarket _template,
        bool _approval,
        bool _isOpen,
        bool _duplicate
    ) external;

    function approveReference(
        IUniversalMarket _template,
        uint256 _slot,
        address _target,
        bool _approval
    ) external;

    function setCondition(
        IUniversalMarket _template,
        uint256 _slot,
        uint256 _target
    ) external;

    function createMarket(
        IUniversalMarket _template,
        string memory _metaData,
        uint256[] memory _conditions,
        address[] memory _references
    ) external returns (address);
}