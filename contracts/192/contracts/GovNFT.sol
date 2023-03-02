// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./utils/MetaContext.sol";
import "./interfaces/IGovNFT.sol";
import "./utils/ExcessivelySafeCall.sol";

contract GovNFT is ERC721Enumerable, ILayerZeroReceiver, MetaContext, IGovNFT {
    using ExcessivelySafeCall for address;
    
    uint256 private counter = 1;
    uint256 private constant MAX = 10000;
    uint256 public gas = 150000;
    string public baseURI;
    uint256 public maxBridge = 20;
    ILayerZeroEndpoint public endpoint;

    mapping(uint16 => mapping(address => bool)) public isTrustedAddress;
    mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedMessages;
    event MessageFailed(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _payload, bytes _reason);
    event RetryMessageSuccess(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes32 _payloadHash);
    event ReceiveNFT(
        uint16 _srcChainId,
        address _from,
        uint256[] _tokenId
    );

    constructor(
        address _endpoint,
        string memory _setBaseURI,
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {
        endpoint = ILayerZeroEndpoint(_endpoint);
        baseURI = _setBaseURI;
    }

    function _baseURI() internal override view returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string calldata _newBaseURI) external onlyOwner {
        baseURI = _newBaseURI;
    }

    function _mint(address to, uint256 tokenId) internal override {
        require(counter <= MAX, "Exceeds supply");
        counter += 1;
        for (uint i=0; i<assetsLength(); i++) {
            userPaid[to][assets[i]] += accRewardsPerNFT[assets[i]];
        }
        super._mint(to, tokenId);
    }

    /**
     * @dev should only be called by layer zero
     * @param to the address to receive the bridged NFTs
     * @param tokenId the NFT id
     */
    function _bridgeMint(address to, uint256 tokenId) public {
        require(msg.sender == address(this) || _msgSender() == owner(), "NotBridge");
        require(tokenId <= 10000, "BadID");
        for (uint i=0; i<assetsLength(); i++) {
            userPaid[to][assets[i]] += accRewardsPerNFT[assets[i]];
        }
        super._mint(to, tokenId);
    }

    /**
    * @notice updates userDebt 
    */
    function _burn(uint256 tokenId) internal override {
        address owner = ownerOf(tokenId);
        for (uint i=0; i<assetsLength(); i++) {
            userDebt[owner][assets[i]] += accRewardsPerNFT[assets[i]];
            userDebt[owner][assets[i]] -= userPaid[owner][assets[i]]/balanceOf(owner);
            userPaid[owner][assets[i]] -= userPaid[owner][assets[i]]/balanceOf(owner);            
        }
        super._burn(tokenId);
    }

    /**
    * @notice updates userDebt for both to and from
    */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        require(ownerOf(tokenId) == from, "!Owner");
        for (uint i=0; i<assetsLength(); i++) {
            userDebt[from][assets[i]] += accRewardsPerNFT[assets[i]];
            userDebt[from][assets[i]] -= userPaid[from][assets[i]]/balanceOf(from);
            userPaid[from][assets[i]] -= userPaid[from][assets[i]]/balanceOf(from);
            userPaid[to][assets[i]] += accRewardsPerNFT[assets[i]];
        }
        super._transfer(from, to, tokenId);
    }

    function mintMany(uint _amount) external onlyOwner {
        for (uint i=0; i<_amount; i++) {
            _mint(_msgSender(), counter);
        }
    }

    function mint() external onlyOwner {
        _mint(_msgSender(), counter);
    }

    function setTrustedAddress(uint16 _chainId, address _contract, bool _bool) external onlyOwner {
        isTrustedAddress[_chainId][_contract] = _bool;
    }

    /**
    * @notice used to bridge NFTs crosschain using layer zero
    * @param _dstChainId the layer zero id of the dest chain
    * @param _to receiving address on dest chain
    * @param tokenId array of the ids of the NFTs to be bridged
    */
    function crossChain(
        uint16 _dstChainId,
        bytes memory _destination,
        address _to,
        uint256[] memory tokenId
    ) public payable {
        require(tokenId.length > 0, "Not bridging");
        for (uint i=0; i<tokenId.length; i++) {
            require(_msgSender() == ownerOf(tokenId[i]), "Not the owner");
            // burn NFT
            _burn(tokenId[i]);
        }
        address targetAddress;
        assembly {
            targetAddress := mload(add(_destination, 20))
        }
        require(isTrustedAddress[_dstChainId][targetAddress], "!Trusted");
        bytes memory payload = abi.encode(_to, tokenId);
        // encode adapterParams to specify more gas for the destination
        uint16 version = 1;
        uint256 _gas = 500_000 + gas*tokenId.length;
        bytes memory adapterParams = abi.encodePacked(version, _gas);
        (uint256 messageFee, ) = endpoint.estimateFees(
            _dstChainId,
            address(this),
            payload,
            false,
            adapterParams
        );
        require(
            msg.value >= messageFee,
            "Must send enough value to cover messageFee"
        );
        endpoint.send{value: msg.value}(
            _dstChainId,
            _destination,
            payload,
            payable(_msgSender()),
            address(0x0),
            adapterParams
        );
    }


    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external override {
        require(_msgSender() == address(endpoint), "!Endpoint");
        (bool success, bytes memory reason) = address(this).excessivelySafeCall(gasleft()*4/5, 150, abi.encodeWithSelector(this.nonblockingLzReceive.selector, _srcChainId, _srcAddress, _nonce, _payload));
        // try-catch all errors/exceptions
        if (!success) {
            failedMessages[_srcChainId][_srcAddress][_nonce] = keccak256(_payload);
            emit MessageFailed(_srcChainId, _srcAddress, _nonce, _payload, reason);
        }
    }

    function nonblockingLzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) public {
        // only internal transaction
        require(msg.sender == address(this), "NonblockingLzApp: caller must be app");
        _nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64, bytes memory _payload) internal {
        address fromAddress;
        assembly {
            fromAddress := mload(add(_srcAddress, 20))
        }
        require(isTrustedAddress[_srcChainId][fromAddress], "!TrustedAddress");
        (address toAddress, uint256[] memory tokenId) = abi.decode(
            _payload,
            (address, uint256[])
        );
        // mint the tokens
        for (uint i=0; i<tokenId.length; i++) {
            _bridgeMint(toAddress, tokenId[i]);
        }
        emit ReceiveNFT(_srcChainId, toAddress, tokenId);
    }

    function retryMessage(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) public {
        // assert there is message to retry
        bytes32 payloadHash = failedMessages[_srcChainId][_srcAddress][_nonce];
        require(payloadHash != bytes32(0), "NonblockingLzApp: no stored message");
        require(keccak256(_payload) == payloadHash, "NonblockingLzApp: invalid payload");
        // clear the stored message
        failedMessages[_srcChainId][_srcAddress][_nonce] = bytes32(0);
        // execute the message. revert if it fails again
        _nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
        emit RetryMessageSuccess(_srcChainId, _srcAddress, _nonce, payloadHash);
    }

    // Endpoint.sol estimateFees() returns the fees for the message
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParams
    ) external view returns (uint256 nativeFee, uint256 zroFee) {
        return
            endpoint.estimateFees(
                _dstChainId,
                _userApplication,
                _payload,
                _payInZRO,
                _adapterParams
            );
    }

    function setGas(uint _gas) external onlyOwner {
        gas = _gas;
    }

    function setEndpoint(ILayerZeroEndpoint _endpoint) external onlyOwner {
        require(address(_endpoint) != address(0), "ZeroAddress");
        endpoint = _endpoint;
    }

    function safeTransferMany(address _to, uint[] calldata _ids) external {
        for (uint i=0; i<_ids.length; i++) {
            _transfer(_msgSender(), _to, _ids[i]);
        }
    }

    function safeTransferFromMany(address _from, address _to, uint[] calldata _ids) external {
        for (uint i=0; i<_ids.length; i++) {
            safeTransferFrom(_from, _to, _ids[i]);
        }
    }

    function approveMany(address _to, uint[] calldata _ids) external {
        for (uint i=0; i<_ids.length; i++) {
            approve(_to, _ids[i]);
        }
    }

    // Rewards
    address[] public assets;
    mapping(address => bool) private _allowedAsset;
    mapping(address => uint) private assetsIndex;
    mapping(address => mapping(address => uint256)) private userPaid;
    mapping(address => mapping(address => uint256)) private userDebt;
    mapping(address => uint256) private accRewardsPerNFT;

    /**
    * @notice claimable by anyone to claim pending rewards tokens
    * @param _tigAsset reward token address
    */
    function claim(address _tigAsset) external {
        address _msgsender = _msgSender();
        uint256 amount = pending(_msgsender, _tigAsset);
        userPaid[_msgsender][_tigAsset] += amount;
        IERC20(_tigAsset).transfer(_msgsender, amount);
    }

    /**
    * @notice add rewards for NFT holders
    * @param _tigAsset reward token address
    * @param _amount amount to be distributed
    */
    function distribute(address _tigAsset, uint _amount) external {
        if (assets.length == 0 || assets[assetsIndex[_tigAsset]] == address(0) || totalSupply() == 0 || !_allowedAsset[_tigAsset]) return;
        try IERC20(_tigAsset).transferFrom(_msgSender(), address(this), _amount) {
            accRewardsPerNFT[_tigAsset] += _amount/totalSupply();
        } catch {
            return;
        }
    }

    function pending(address user, address _tigAsset) public view returns (uint256) {
        return userDebt[user][_tigAsset] + balanceOf(user)*accRewardsPerNFT[_tigAsset] - userPaid[user][_tigAsset]; 
    }

    function addAsset(address _asset) external onlyOwner {
        require(assets.length == 0 || assets[assetsIndex[_asset]] != _asset, "Already added");
        assetsIndex[_asset] = assets.length;
        assets.push(_asset);
        _allowedAsset[_asset] = true;
    }

    function setAllowedAsset(address _asset, bool _bool) external onlyOwner {
        _allowedAsset[_asset] = _bool;
    }

    function setMaxBridge(uint256 _max) external onlyOwner {
        maxBridge = _max;
    }

    function assetsLength() public view returns (uint256) {
        return assets.length;
    }

    function allowedAsset(address _asset) external view returns (bool) {
        return _allowedAsset[_asset];
    }

    function balanceIds(address _user) external view returns (uint[] memory) {
        uint[] memory _ids = new uint[](balanceOf(_user));
        for (uint i=0; i<_ids.length; i++) {
            _ids[i] = tokenOfOwnerByIndex(_user, i);
        }
        return _ids;
    }

    // META-TX
    function _msgSender() internal view override(Context, MetaContext) returns (address sender) {
        return MetaContext._msgSender();
    }
    function _msgData() internal view override(Context, MetaContext) returns (bytes calldata) {
        return MetaContext._msgData();
    }
}