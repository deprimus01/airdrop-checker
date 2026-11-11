// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MerkleAirdrop is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed account, uint256 amount);

    error AlreadyClaimed();
    error InvalidProof();

    constructor(address token_, bytes32 merkleRoot_) Ownable(msg.sender) {
        token = IERC20(token_);
        merkleRoot = merkleRoot_;
    }

    // `account` is the wallet the proof was made for. Anyone (including a
    // forwarding contract) can call this, but the tokens always go to
    // `account`, so nobody can redirect or steal an allocation.
    function claim(
        address account,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        if (hasClaimed[account]) revert AlreadyClaimed();

        // Must match how the Merkle tree script built each leaf
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(account, amount)))
        );
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert InvalidProof();

        hasClaimed[account] = true;
        token.safeTransfer(account, amount);

        emit Claimed(account, amount);
    }

    // Lets you recover unclaimed tokens later
    function withdrawRemaining() external onlyOwner {
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }
}
