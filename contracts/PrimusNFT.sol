// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Allowlist NFT: wallets on the Merkle allowlist can mint one token for free.
// Token IDs cycle through the 6 metadata files (1.json to 6.json).
contract PrimusNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant IMAGE_COUNT = 6;

    uint256 public immutable maxSupply;
    bytes32 public immutable merkleRoot;

    uint256 public totalSupply;
    string private _baseTokenURI;
    mapping(address => bool) public hasMinted;

    event Minted(address indexed account, uint256 indexed tokenId);

    error AlreadyMinted();
    error InvalidProof();
    error SoldOut();

    constructor(
        string memory baseURI_,
        bytes32 merkleRoot_,
        uint256 maxSupply_
    ) ERC721("Primus Genesis", "PGEN") Ownable(msg.sender) {
        _baseTokenURI = baseURI_;
        merkleRoot = merkleRoot_;
        maxSupply = maxSupply_;
    }

    // `account` is the wallet on the allowlist. Anyone (including a forwarding
    // contract) can submit the transaction, but the NFT always goes to `account`.
    function mint(address account, bytes32[] calldata proof) external {
        if (hasMinted[account]) revert AlreadyMinted();
        if (totalSupply >= maxSupply) revert SoldOut();

        // Must match how the Merkle tree script builds each leaf
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account))));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert InvalidProof();

        hasMinted[account] = true;
        uint256 tokenId = ++totalSupply;
        _safeMint(account, tokenId);

        emit Minted(account, tokenId);
    }

    // Token 1 -> 1.json, token 6 -> 6.json, token 7 -> 1.json, and so on
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 imageId = ((tokenId - 1) % IMAGE_COUNT) + 1;
        return string.concat(_baseTokenURI, imageId.toString(), ".json");
    }

    // Lets you fix the metadata location if you re-upload to IPFS
    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
    }
}
