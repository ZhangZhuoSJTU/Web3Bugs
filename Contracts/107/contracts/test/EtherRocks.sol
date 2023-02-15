// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8;

contract EtherRock {
    struct Rock {
        address owner;
        bool currentlyForSale;
        uint256 price;
        uint256 timesSold;
    }

    mapping(uint256 => Rock) public rocks;

    mapping(address => uint256[]) public rockOwners;

    uint256 public latestNewRockForSale;

    address owner;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor() {
        rocks[0].currentlyForSale = true;
    }

    function getRockInfo(uint256 rockNumber)
        external
        view
        returns (
            address,
            bool,
            uint256,
            uint256
        )
    {
        return (
            rocks[rockNumber].owner,
            rocks[rockNumber].currentlyForSale,
            rocks[rockNumber].price,
            rocks[rockNumber].timesSold
        );
    }

    function rockOwningHistory(address _address)
        external
        view
        returns (uint256[] memory)
    {
        return rockOwners[_address];
    }

    function buyRock(uint256 rockNumber) external payable {
        require(rocks[rockNumber].currentlyForSale == true, "Not for sale");
        require(msg.value == rocks[rockNumber].price);
        rocks[rockNumber].currentlyForSale = false;
        rocks[rockNumber].timesSold++;
        if (rockNumber != latestNewRockForSale) {
            payable(rocks[rockNumber].owner).transfer(rocks[rockNumber].price);
        }
        rocks[rockNumber].owner = msg.sender;
        rockOwners[msg.sender].push(rockNumber);
        if (rockNumber == latestNewRockForSale) {
            if (rockNumber != 99) {
                latestNewRockForSale++;
                rocks[latestNewRockForSale].price = 0;
                rocks[latestNewRockForSale].currentlyForSale = true;
            }
        }
    }

    function sellRock(uint256 rockNumber, uint256 price) external {
        require(msg.sender == rocks[rockNumber].owner);
        require(price > 0);
        rocks[rockNumber].price = price;
        rocks[rockNumber].currentlyForSale = true;
    }

    function dontSellRock(uint256 rockNumber) external {
        require(msg.sender == rocks[rockNumber].owner);
        rocks[rockNumber].currentlyForSale = false;
    }

    function giftRock(uint256 rockNumber, address receiver) external {
        require(msg.sender == rocks[rockNumber].owner);
        rocks[rockNumber].owner = receiver;
        rockOwners[receiver].push(rockNumber);
    }

    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
