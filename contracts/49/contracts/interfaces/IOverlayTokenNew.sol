// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IOverlayTokenNew {

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(address indexed owner, address indexed spender, uint256 value);

    function decimals() external view returns (uint);

    function symbol () external view returns (string memory);
    
    function name () external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function balanceOf(
        address account
    ) external view returns (
        uint256
    );

    function allowance(
        address owner, 
        address spender
    ) external view returns (
        uint256
    );

    function approve(
        address spender, 
        uint256 amount
    ) external returns (
        bool
    );

    function transfer(
        address recipient, 
        uint256 amount
    ) external returns (
        bool
    );

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (
        bool
    );

    function burn(
        address account, 
        uint256 amount
    ) external;

    function mint(
        address account, 
        uint256 amount
    ) external;

    function transferBurn(
        address recipient,
        uint256 amount,
        uint256 burnt
    ) external returns (
        bool
    );

    function transferFromBurn(
        address sender,
        address recipient,
        uint256 amount,
        uint256 burnt
    ) external returns (
        bool
    );

    function transferMint(
        address recipient,
        uint256 amount,
        uint256 mint
    ) external returns (
        bool
    );

    function transferFromMint(
        address sender,
        address recipient,
        uint256 amount,
        uint256 mint
    ) external returns (
        bool
    );

}