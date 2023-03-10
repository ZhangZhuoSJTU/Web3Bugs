// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;
pragma experimental ABIEncoderV2;

import "@pie-dao/diamond/contracts/Diamond.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@pie-dao/proxy/contracts/PProxy.sol";

import "../interfaces/IExperiPie.sol";

contract PieFactoryContract is Ownable {
    using SafeERC20 for IERC20;

    address[] public pies;
    mapping(address => bool) public isPie;
    address public defaultController;
    address public diamondImplementation;

    IDiamondCut.FacetCut[] public defaultCut;

    event PieCreated(
        address indexed pieAddress,
        address indexed deployer,
        uint256 indexed index
    );

    event DefaultControllerSet(address indexed controller);
    event FacetAdded(IDiamondCut.FacetCut);
    event FacetRemoved(IDiamondCut.FacetCut);

    constructor() {
        defaultController = msg.sender;
    }

    function setDefaultController(address _controller) external onlyOwner {
        defaultController = _controller;
        emit DefaultControllerSet(_controller);
    }

    function removeFacet(uint256 _index) external onlyOwner {
        require(_index < defaultCut.length, "INVALID_INDEX");
        emit FacetRemoved(defaultCut[_index]);
        defaultCut[_index] = defaultCut[defaultCut.length - 1];
        defaultCut.pop();
    }

    function addFacet(IDiamondCut.FacetCut memory _facet) external onlyOwner {
        defaultCut.push(_facet);
        emit FacetAdded(_facet);
    }

    // Diamond should be Initialized to prevent it from being selfdestructed
    function setDiamondImplementation(address _diamondImplementation)
        external
        onlyOwner
    {
        diamondImplementation = _diamondImplementation;
    }

    function bakePie(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _initialSupply,
        string memory _symbol,
        string memory _name
    ) external {
        PProxy proxy = new PProxy();
        Diamond d = Diamond(address(proxy));

        proxy.setImplementation(diamondImplementation);

        d.initialize(defaultCut, address(this));

        pies.push(address(d));
        isPie[address(d)] = true;

        // emit DiamondCreated(address(d));
        require(_tokens.length != 0, "CANNOT_CREATE_ZERO_TOKEN_LENGTH_PIE");
        require(_tokens.length == _amounts.length, "ARRAY_LENGTH_MISMATCH");

        IExperiPie pie = IExperiPie(address(d));

        // Init erc20 facet
        pie.initialize(_initialSupply, _name, _symbol);

        // Transfer and add tokens
        for (uint256 i = 0; i < _tokens.length; i++) {
            IERC20 token = IERC20(_tokens[i]);
            token.safeTransferFrom(msg.sender, address(pie), _amounts[i]);
            pie.addToken(_tokens[i]);
        }

        // Unlock pool
        pie.setLock(1);

        // Uncap pool
        pie.setCap(uint256(-1));

        // Send minted pie to msg.sender
        pie.transfer(msg.sender, _initialSupply);
        pie.transferOwnership(defaultController);
        proxy.setProxyOwner(defaultController);

        emit PieCreated(address(d), msg.sender, pies.length - 1);
    }

    function getDefaultCut()
        external
        view
        returns (IDiamondCut.FacetCut[] memory)
    {
        return defaultCut;
    }

    function getDefaultCutCount() external view returns (uint256) {
        return defaultCut.length;
    }
}
