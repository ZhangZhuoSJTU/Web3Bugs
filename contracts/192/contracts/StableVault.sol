// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./utils/MetaContext.sol";
import "./interfaces/IStableVault.sol";

interface IERC20Mintable is IERC20 {
    function mintFor(address, uint256) external;
    function burnFrom(address, uint256) external;
    function decimals() external view returns (uint);
}

interface ERC20Permit is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract StableVault is MetaContext, IStableVault {

    mapping(address => bool) public allowed;
    mapping(address => uint) private tokenIndex;
    address[] public tokens;

    address public immutable stable;

    constructor(address _stable) {
        stable = _stable;
    }

    /**
    * @notice deposit an allowed token and receive tigAsset
    * @param _token address of the allowed token
    * @param _amount amount of _token
    */
    function deposit(address _token, uint256 _amount) public {
        require(allowed[_token], "Token not listed");
        IERC20(_token).transferFrom(_msgSender(), address(this), _amount);
        IERC20Mintable(stable).mintFor(
            _msgSender(),
            _amount*(10**(18-IERC20Mintable(_token).decimals()))
        );
    }

    function depositWithPermit(address _token, uint256 _amount, uint256 _deadline, bool _permitMax, uint8 v, bytes32 r, bytes32 s) external {
        uint _toAllow = _amount;
        if (_permitMax) _toAllow = type(uint).max;
        ERC20Permit(_token).permit(_msgSender(), address(this), _toAllow, _deadline, v, r, s);
        deposit(_token, _amount);
    }

    /**
    * @notice swap tigAsset to _token
    * @param _token address of the token to receive
    * @param _amount amount of _token
    */
    function withdraw(address _token, uint256 _amount) external returns (uint256 _output) {
        IERC20Mintable(stable).burnFrom(_msgSender(), _amount);
        _output = _amount/10**(18-IERC20Mintable(_token).decimals());
        IERC20(_token).transfer(
            _msgSender(),
            _output
        );
    }

    /**
    * @notice allow a token to be used in vault
    * @param _token address of the token
    */
    function listToken(address _token) external onlyOwner {
        require(!allowed[_token], "Already added");
        tokenIndex[_token] = tokens.length;
        tokens.push(_token);
        allowed[_token] = true;
    }

    /**
    * @notice stop a token from being allowed in vault
    * @param _token address of the token
    */
    function delistToken(address _token) external onlyOwner {
        require(allowed[_token], "Not added");
        tokenIndex[tokens[tokens.length-1]] = tokenIndex[_token];
        tokens[tokenIndex[_token]] = tokens[tokens.length-1];
        delete tokenIndex[_token];
        tokens.pop();
        allowed[_token] = false;
    }
}