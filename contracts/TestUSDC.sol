// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Simple Test ERC20 Token for Base Sepolia
 *
 * This is a basic ERC20 token contract for testing purposes.
 * It includes a mint function so you can create tokens for testing.
 */
contract TestUSDC {
    string public name = "Test USDC";
    string public symbol = "tUSDC";
    uint8 public decimals = 6; // Same decimals as real USDC

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public totalSupply;

    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        owner = msg.sender;
        totalSupply = 0;
    }

    /**
     * Transfer tokens from msg.sender to another address
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * Approve another address to spend tokens on your behalf
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * Transfer tokens from one address to another (requires approval)
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;

        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * Mint new tokens (only owner can call this)
     * Use this to create test tokens for your wallet
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "Only owner can mint");

        balanceOf[to] += amount;
        totalSupply += amount;

        emit Transfer(address(0), to, amount);
    }

    /**
     * Mint tokens to multiple addresses at once
     */
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts) external {
        require(msg.sender == owner, "Only owner can mint");
        require(recipients.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            balanceOf[recipients[i]] += amounts[i];
            totalSupply += amounts[i];
            emit Transfer(address(0), recipients[i], amounts[i]);
        }
    }
}

