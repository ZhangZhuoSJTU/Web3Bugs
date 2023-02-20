pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IERC20Burnable {
    function burnFrom(address _from, uint256 _value) external returns (bool);
}

contract KyberNetworkTokenV2 is OwnableUpgradeable, ERC20BurnableUpgradeable {
    using SafeERC20 for IERC20;

    address public oldKNC;
    address public minter;

    event Minted(address indexed account, uint256 indexed amount, address indexed minter);
    event Migrated(address indexed account, uint256 indexed amount);
    event MinterChanged(address indexed oldMinter, address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == minter, "only minter");
        _;
    }

    function initialize(address _oldKNC, address _minter)
        external
        initializer
    {
        __ERC20_init("Kyber Network Crystal v2", "KNC");
        __Ownable_init();
        require(_oldKNC != address(0), "invalid old knc");
        require(_minter != address(0), "invalid minter");
        oldKNC = _oldKNC;
        minter = _minter;
    }

    function mint(address account, uint256 amount) external onlyMinter {
        super._mint(account, amount);
        emit Minted(account, amount, minter);
    }

    /// @dev burn old knc and mint new knc for msg.sender, ratio 1:1
    function mintWithOldKnc(uint256 amount) external {
        IERC20Burnable(oldKNC).burnFrom(msg.sender, amount);

        super._mint(msg.sender, amount);
        emit Migrated(msg.sender, amount);
    }

    function changeMinter(address newMinter) external onlyMinter {
        require(newMinter != address(0), "invalid minter");
        if (minter != newMinter) {
            emit MinterChanged(minter, newMinter);
            minter = newMinter;
        }
    }

    /// @dev emergency withdraw ERC20, can only call by the owner
    /// to withdraw tokens that have been sent to this address
    function emergencyERC20Drain(IERC20 token, uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
    }
}