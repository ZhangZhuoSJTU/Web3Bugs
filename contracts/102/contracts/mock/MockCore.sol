// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./../core/Permissions.sol";
import "../vcon/Vcon.sol";
import "../volt/Volt.sol";

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/// @title Mock Source of truth for Fei Protocol
/// @author Fei Protocol
/// @notice maintains roles, access control, fei, tribe, genesisGroup, and the TRIBE treasury
contract MockCore is Permissions, Initializable {
    /// @notice the address of the FEI contract
    IVolt public volt;

    /// @notice the address of the TRIBE contract
    IERC20 public vcon;

    constructor() {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        require(chainId != 1, "MockCore: cannot deploy to mainnet");
    }

    function init(address recipient) external initializer {
        /// emulate the real core as much as possible
        _setupGovernor(msg.sender);

        Volt _volt = new Volt(address(this));
        volt = IVolt(_volt);

        /// give all VCON to the recipient
        /// grant timelock the minter role
        Vcon _vcon = new Vcon(recipient, msg.sender);
        vcon = IERC20(address(_vcon));

        _setupGovernor(msg.sender);
    }

    /// @notice checks if address is a minter
    /// @return true _address is a minter
    // only virtual for testing mock override
    function isMinter(address) external view virtual override returns (bool) {
        return true;
    }

    /// @notice checks if address is a burner
    /// @return true _address is a burner
    // only virtual for testing mock override
    function isBurner(address) external view virtual override returns (bool) {
        return true;
    }

    /// @notice checks if address is a controller
    /// @return true _address is a controller
    // only virtual for testing mock override
    function isPCVController(address)
        external
        view
        virtual
        override
        returns (bool)
    {
        return true;
    }

    /// @notice checks if address is a governor
    /// @return true _address is a governor
    // only virtual for testing mock override
    function isGovernor(address) public view virtual override returns (bool) {
        return true;
    }

    /// @notice checks if address is a guardian
    /// @return true _address is a guardian
    // only virtual for testing mock override
    function isGuardian(address) public view virtual override returns (bool) {
        return true;
    }
}
