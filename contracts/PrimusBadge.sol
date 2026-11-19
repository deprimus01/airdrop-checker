// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMerkleAirdrop {
    function hasClaimed(address account) external view returns (bool);
}

// Soulbound badge: only wallets that claimed PRM from the airdrop contract can
// mint one, and it can never be transferred.
contract PrimusBadge is ERC721, Ownable {
    IMerkleAirdrop public immutable airdrop;

    uint256 public totalSupply;
    string private _badgeURI;
    mapping(address => bool) public hasBadge;

    event BadgeMinted(address indexed account, uint256 indexed tokenId);

    error AlreadyMinted();
    error NotClaimed();
    error Soulbound();

    constructor(address airdrop_, string memory badgeURI_)
        ERC721("Primus Airdrop Claimer", "PBADGE")
        Ownable(msg.sender)
    {
        airdrop = IMerkleAirdrop(airdrop_);
        _badgeURI = badgeURI_;
    }

    // The badge always goes to `account`, so submitting for someone else is harmless
    function mint(address account) external {
        if (hasBadge[account]) revert AlreadyMinted();
        if (!airdrop.hasClaimed(account)) revert NotClaimed();

        hasBadge[account] = true;
        uint256 tokenId = ++totalSupply;
        _safeMint(account, tokenId);

        emit BadgeMinted(account, tokenId);
    }

    // Every badge shares the same metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _badgeURI;
    }

    // Makes the token soulbound: minting (from == address(0)) is the only
    // movement allowed. Transfers and burns revert.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function setBadgeURI(string calldata uri) external onlyOwner {
        _badgeURI = uri;
    }
}
