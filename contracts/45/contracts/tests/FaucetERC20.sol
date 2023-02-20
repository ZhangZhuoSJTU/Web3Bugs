//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract FaucetERC20 is Initializable, ERC20Upgradeable {
    string public constant version = "1";

    // --- EIP712 niceties ---
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant PERMIT_TYPEHASH = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;

    mapping(address => uint256) public nonces;

    function __FaucetERC20_init(string memory name, string memory symbol) public initializer {
        ERC20Upgradeable.__ERC20_init(name, symbol);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                getChainId(),
                address(this)
            )
        );
    }

    receive() external payable {
        mint(msg.sender, 1 ether);
    }

    function mint(address to, uint256 value) public returns (bool) {
        // require(value <= 10000000 ether, "dont be greedy");
        _mint(to, value);
        return true;
    }

    function burn(address to, uint256 value) public returns (bool) {
        // require(value <= 10000000 ether, "dont be greedy");
        _burn(to, value);
        return true;
    }

    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, holder, spender, nonce, expiry, allowed))
            )
        );

        require(holder != address(0), "invalid-address-0");
        require(holder == ecrecover(digest, v, r, s), "invalid-permit");
        require(expiry == 0 || block.timestamp <= expiry, "permit-expired");
        require(nonce == nonces[holder]++, "invalid-nonce");
        uint256 wad = allowed ? type(uint256).max : 0;
        _approve(holder, spender, wad);
    }

    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
