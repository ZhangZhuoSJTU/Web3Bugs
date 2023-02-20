// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.0;

import "../interfaces/external/IERC20.sol";
import "./ERC20Mock.sol";

contract GemJoinMock {
    
    IERC20 public immutable gem;

    constructor(IERC20 gem_) {
        gem = gem_;
    }

    function pull(address from, uint256 amount) public {
        gem.transferFrom(from, address(this), amount);
    }
}

contract TLMMock  {

    bytes32 public constant FYDAI = "FYDAI";    // MakerDAO ilk

    IERC20 public immutable dai;
    IERC20 public immutable gem;
    
    struct Ilk {
        address gemJoin;
        uint256 yield;
    }
    mapping (bytes32 => Ilk) public ilks; // Registered maturing gems


    constructor(IERC20 dai_, IERC20 fyDai_) {
        dai = dai_;
        gem = fyDai_;
        ilks[FYDAI].gemJoin = address(new GemJoinMock(fyDai_));
    }

    function sellGem(bytes32 ilk, address usr, uint256 gemAmt)
        external returns(uint256)
    {
        require(ilk == FYDAI, "Mismatched ilk");
        uint256 daiAmt = gemAmt;

        GemJoinMock(ilks[FYDAI].gemJoin).pull(msg.sender, gemAmt);
        ERC20Mock(address(dai)).mint(usr, daiAmt);
        return daiAmt;
    }
}