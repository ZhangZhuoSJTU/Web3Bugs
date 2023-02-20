// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ICurveMetaPool } from "./external/CurveInterfaces.sol";

contract USDMPegRecovery is Ownable {

    using SafeERC20 for IERC20; 

    IERC20 public immutable usdm;

    IERC20 public immutable pool3;

    ICurveMetaPool public immutable usdm3crv;

    address public immutable kpiOracle;

    uint256 public step;

    uint256 public startLiquidity;

    struct Liquidity {
        uint128 usdm;
        uint128 pool3;
    }

    event Deposit(address indexed depositor, Liquidity deposits);

    event Withdraw(address indexed withdrawer, Liquidity withdrawals);

    Liquidity public totalLiquidity;

    mapping(address => Liquidity) public userLiquidity;

    mapping(address => bool) public isGuardian;

    bool public unlockable;

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "!guardian");
        _;
    }

    constructor(
        uint256 _startLiquidity,
        address _kpiOracle
    ) Ownable() {
        startLiquidity = _startLiquidity;
        usdm = IERC20(0x31d4Eb09a216e181eC8a43ce79226A487D6F0BA9);
        pool3 = IERC20(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
        usdm3crv = ICurveMetaPool(0x5B3b5DF2BF2B6543f78e053bD91C4Bdd820929f1);
        step = 250000e18;
        kpiOracle = _kpiOracle;
    }

    function addGuardian(address _guardian) external onlyOwner {
        isGuardian[_guardian] = true;
    }

    function removeGuardian(address _guardian) external onlyOwner {
        isGuardian[_guardian] = false;
    }

    function enableUnlock() external {
        require(msg.sender == kpiOracle, "!oracle");
        unlockable = true;
    }

    function provide(uint256 _minimumLP) external onlyGuardian {
        require(usdm.balanceOf(address(this)) >= totalLiquidity.usdm, "<liquidity");
        // truncate amounts under step
        uint256 addingLiquidity = (usdm.balanceOf(address(this)) / step) * step;
        // match usdm : pool3 = 1 : 1
        uint256[2] memory amounts = [addingLiquidity, addingLiquidity];
        usdm.approve(address(usdm3crv), addingLiquidity);
        pool3.approve(address(usdm3crv), addingLiquidity);
        usdm3crv.add_liquidity(amounts, _minimumLP);
    }

    function removeLiquidity(uint256 _steps, uint256 _burningLPs) external onlyGuardian {
        uint256 removingLiquidity = _steps * step;
        uint256[2] memory amounts = [removingLiquidity, removingLiquidity];
        usdm3crv.remove_liquidity(_burningLPs, amounts);
    }

    function deposit(Liquidity calldata _deposits) external {
        Liquidity memory total = totalLiquidity;
        Liquidity memory user = userLiquidity[msg.sender];
        if(_deposits.usdm > 0) {
            usdm.safeTransferFrom(msg.sender, address(this), uint256(_deposits.usdm));
            total.usdm += _deposits.usdm;
            user.usdm += _deposits.usdm;
        }

        if(_deposits.pool3 > 0) {
            require(totalLiquidity.usdm > 4000000e18, "usdm low");
            pool3.safeTransferFrom(msg.sender, address(this), uint256(_deposits.pool3));
            total.pool3 += _deposits.pool3;
            user.pool3 += _deposits.pool3;
        }
        totalLiquidity = total;
        userLiquidity[msg.sender] = user;
        emit Deposit(msg.sender, _deposits);
    }

    function withdraw(Liquidity calldata _withdrawal) external {
        Liquidity memory total = totalLiquidity;
        Liquidity memory user = userLiquidity[msg.sender];
        if(_withdrawal.usdm > 0) {
            require(unlockable, "!unlock usdm");
            usdm.safeTransfer(msg.sender, uint256(_withdrawal.usdm));
            total.usdm -= _withdrawal.usdm;
            user.usdm -= _withdrawal.usdm;
        }

        if(_withdrawal.pool3 > 0) {
            pool3.safeTransfer(msg.sender, uint256(_withdrawal.pool3));
            total.pool3 -= _withdrawal.pool3;
            user.pool3 -= _withdrawal.pool3;
        }
        totalLiquidity = total;
        userLiquidity[msg.sender] = user;
        emit Withdraw(msg.sender, _withdrawal);
    }
}
