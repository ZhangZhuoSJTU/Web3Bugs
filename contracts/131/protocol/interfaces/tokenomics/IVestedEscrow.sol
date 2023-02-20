// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IVestedEscrow {
    struct FundingAmount {
        address recipient;
        uint256 amount;
    }

    function setAdmin(address _admin) external;

    function setFundAdmin(address _fundadmin) external;

    function initializeUnallocatedSupply() external returns (bool);

    function fund(FundingAmount[] calldata amounts) external returns (bool);

    function claim() external;

    function claim(address _recipient) external;

    function vestedSupply() external view returns (uint256);

    function lockedSupply() external view returns (uint256);

    function vestedOf(address _recipient) external view returns (uint256);

    function balanceOf(address _recipient) external view returns (uint256);

    function lockedOf(address _recipient) external view returns (uint256);
}
