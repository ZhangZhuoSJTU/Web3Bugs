// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";
import "./MockWalletChecker.sol";

contract MockCurveVoteEscrow is ERC20("MockVE", "MockVE") {
    address public smart_wallet_checker;

    address public token;

    mapping(address => uint256) public lockAmounts;

    mapping(address => uint256) public lockTimes;

    uint256 public constant MAX_LEN = 365 days;

    constructor(address _smart_wallet_checker, address _token) {
        smart_wallet_checker = _smart_wallet_checker;
        token = _token;
    }

    function transfer(
        address, /* recipient */
        uint256 /* amount */
    ) public virtual override returns (bool) {
        revert("Not transferrable");
    }

    function transferFrom(
        address, /* sender */
        address, /* recipient */
        uint256 /* amount */
    ) public virtual override returns (bool) {
        revert("Not transferrable");
    }

    function create_lock(uint256 amount, uint256 unlockTime) external {
        require(MockWalletChecker(smart_wallet_checker).check(msg.sender), "!contracts");
        require(lockAmounts[msg.sender] == 0, "Withdraw old tokens first");
        require(unlockTime < block.timestamp + MAX_LEN, "Lock too long");
        require(amount > 0, "!amount");

        lockAmounts[msg.sender] = amount;
        lockTimes[msg.sender] = unlockTime;

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
    }

    function increase_amount(uint256 amount) external {
        require(lockAmounts[msg.sender] > 0, "Must have a lock");
        require(lockTimes[msg.sender] > block.timestamp, "Current lock expired");
        require(amount > 0, "!amount");
        lockAmounts[msg.sender] += amount;

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
    }

    function increase_unlock_time(uint256 time) external {
        require(lockAmounts[msg.sender] > 0, "Must have a lock");
        require(lockTimes[msg.sender] > block.timestamp, "Current lock expired");
        require(time > lockTimes[msg.sender], "Future time must be greater");
        require(time < block.timestamp + MAX_LEN, "Lock too long");
        lockTimes[msg.sender] = time;
    }

    function withdraw() external {
        require(lockTimes[msg.sender] < block.timestamp, "!unlocked");

        uint256 amount = balanceOf(msg.sender);

        lockAmounts[msg.sender] = 0;
        lockTimes[msg.sender] = 0;

        IERC20(token).transfer(msg.sender, amount);
        _burn(msg.sender, amount);
    }
}
