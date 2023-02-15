// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IbyvWbtc} from "../interfaces/IbyvWbtc.sol";

contract byvWbtc is ERC20, IbyvWbtc {

    constructor() public ERC20("byvWbtc", "byvWbtc") {
        _setupDecimals(8);
    }

    function mint(address account, uint amount) public {
        _mint(account, amount);
    }

    function pricePerShare() override external view returns (uint) {
        return 1e8;
    }

    function deposit(bytes32[] calldata merkleProof) override external {}

    function withdraw() override external returns (uint) {}
}
