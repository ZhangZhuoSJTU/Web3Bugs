// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.6;

contract Ownable {
    event OwnerNominated(address newOwner);
    event OwnerChanged(address newOwner);

    address public owner;
    address public nominatedOwner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function nominateNewOwner(address _owner) external onlyOwner {
        nominatedOwner = _owner;
        emit OwnerNominated(_owner);
    }

    function acceptOwnership() external {
        require(msg.sender == nominatedOwner, "not nominated");

        owner = nominatedOwner;
        nominatedOwner = address(0);

        emit OwnerChanged(owner);
    }
}
