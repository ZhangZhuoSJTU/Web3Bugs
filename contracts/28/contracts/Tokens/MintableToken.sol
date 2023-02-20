pragma solidity 0.6.12;

import "../OpenZeppelin/access/AccessControl.sol";
import "./ERC20/ERC20Burnable.sol";
import "./ERC20/ERC20Pausable.sol";
import "../interfaces/IMisoToken.sol";

// ---------------------------------------------------------------------
//
// From the MISO Token Factory
//
// Made for Sushi.com 
// 
// Enjoy. (c) Chef Gonpachi 2021 
// <https://github.com/chefgonpachi/MISO/>
//
// ---------------------------------------------------------------------
// SPDX-License-Identifier: GPL-3.0                        
// ---------------------------------------------------------------------

contract MintableToken is AccessControl, ERC20Burnable, ERC20Pausable, IMisoToken {
    
    /// @notice Miso template id for the token factory.
    /// @dev For different token types, this must be incremented.
    uint256 public constant override tokenTemplate = 2;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function initToken(string memory _name, string memory _symbol, address _owner, uint256 _initialSupply) public {
        _initERC20(_name, _symbol);
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _setupRole(MINTER_ROLE, _owner);
        _setupRole(PAUSER_ROLE, _owner);
        _mint(msg.sender, _initialSupply);
    }

    function init(bytes calldata _data) external override payable {}

   function initToken(
        bytes calldata _data
    ) public override {
        (string memory _name,
        string memory _symbol,
        address _owner,
        uint256 _initialSupply) = abi.decode(_data, (string, string, address, uint256));

        initToken(_name,_symbol,_owner,_initialSupply);
    }

   /** 
     * @dev Generates init data for Token Factory
     * @param _name - Token name
     * @param _symbol - Token symbol
     * @param _owner - Contract owner
     * @param _initialSupply Amount of tokens minted on creation
  */
    function getInitData(
        string calldata _name,
        string calldata _symbol,
        address _owner,
        uint256 _initialSupply
    )
        external
        pure
        returns (bytes memory _data)
    {
        return abi.encode(_name, _symbol, _owner, _initialSupply);
    }



    /**
     * @dev Creates `amount` new tokens for `to`.
     *
     * See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) public virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "MintableToken: must have minter role to mint");
        _mint(to, amount);
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {ERC20Pausable} and {Pausable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "MintableToken: must have pauser role to pause");
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC20Pausable} and {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "MintableToken: must have pauser role to unpause");
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
