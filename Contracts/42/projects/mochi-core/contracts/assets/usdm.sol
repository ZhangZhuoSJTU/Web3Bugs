// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IMochiEngine.sol";
import "../interfaces/IERC3156FlashLender.sol";

contract USDM is ERC20, IUSDM {
    IMochiEngine public immutable engine;

    uint256 private constant SCALE = 1e18;

    bytes32 public constant CALLBACK_SUCCESS =
        keccak256("ERC3156FlashBorrower.onFlashLoan");

    constructor(address _engine) ERC20("USDM", "USDM") {
        engine = IMochiEngine(_engine);
    }

    modifier onlyMinter() {
        require(msg.sender == address(engine.minter()), "!minter");
        _;
    }

    function mint(address _recipient, uint256 _amount)
        external
        override
        onlyMinter
    {
        _mint(_recipient, _amount);
    }

    function burn(uint256 _amount) external override {
        _burn(msg.sender, _amount);
    }

    function maxFlashLoan(address _token)
        external
        view
        override
        returns (uint256)
    {
        require(_token == address(this), "!this");
        return type(uint256).max - totalSupply();
    }

    function flashFee(address _token, uint256 _amount)
        public
        view
        override
        returns (uint256)
    {
        //should return 0.1337% * _amount;
        require(_token == address(this), "!supported");
        return (_amount * ((1337 * SCALE) / 1000000)) / SCALE;
    }

    function flashLoan(
        IERC3156FlashBorrower _receiver,
        address _token,
        uint256 _amount,
        bytes calldata _data
    ) external override returns (bool) {
        require(_token == address(this), "!supported");
        uint256 fee = flashFee(_token, _amount);
        _mint(address(_receiver), _amount);
        require(
            _receiver.onFlashLoan(msg.sender, _token, _amount, fee, _data) ==
                CALLBACK_SUCCESS,
            "!callback"
        );
        _burn(address(_receiver), _amount);
        _transfer(address(_receiver), engine.treasury(), fee);
        return true;
    }
}
