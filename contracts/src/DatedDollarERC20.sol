// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IDatedLedger {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function supplyByDate(uint256 id) external view returns (uint256);
    function transferDate(uint256 id, address from, address to, uint256 amount) external;
}

/// @notice A date-specific view, not a second token balance or a deposit wrapper.
contract DatedDollarERC20 {
    IDatedLedger public immutable vault;
    uint256 public date;
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;
    bool private initialized;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(address ledger) {
        vault = IDatedLedger(ledger);
        initialized = true; // Only the CREATE2 clones can be initialized.
    }

    function initialize(uint256 id, string calldata tokenName, string calldata tokenSymbol) external {
        require(msg.sender == address(vault) && !initialized, "initialize");
        initialized = true;
        date = id;
        name = tokenName;
        symbol = tokenSymbol;
    }

    function totalSupply() external view returns (uint256) {
        return vault.supplyByDate(date);
    }

    function balanceOf(address account) external view returns (uint256) {
        return vault.balanceOf(account, date);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        vault.transferDate(date, msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowed - amount);
        }
        vault.transferDate(date, from, to, amount);
        return true;
    }

    function emitTransfer(address from, address to, uint256 amount) external {
        require(msg.sender == address(vault), "vault only");
        emit Transfer(from, to, amount);
    }
}
