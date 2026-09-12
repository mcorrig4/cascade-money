// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Local test asset. Price changes do not manufacture USDC redemption liquidity.
contract MockUSYC is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 public constant SCALE = 1e18;
    IERC20 public immutable usdc;
    address public immutable owner;
    uint256 public price = SCALE;
    event PriceSet(uint256 price);

    constructor(address token, address priceOwner) ERC20("Mock USYC", "mUSYC") {
        require(token.code.length != 0 && priceOwner != address(0), "terms");
        usdc = IERC20(token);
        owner = priceOwner;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setPrice(uint256 value) external {
        require(msg.sender == owner, "owner");
        require(value != 0, "price");
        price = value;
        emit PriceSet(value);
    }

    function mint(address to, uint256 shares) external {
        require(msg.sender == owner, "owner");
        _mint(to, shares);
    }

    function buy(uint256 usdcAmount) external nonReentrant returns (uint256 shares) {
        shares = Math.mulDiv(usdcAmount, SCALE, price);
        require(shares != 0, "amount");
        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        require(usdc.balanceOf(address(this)) == beforeBalance + usdcAmount, "transfer amount");
        _mint(msg.sender, shares);
    }

    function sell(uint256 shares) external nonReentrant returns (uint256 usdcAmount) {
        require(shares != 0, "amount");
        usdcAmount = Math.mulDiv(shares, price, SCALE);
        require(usdcAmount != 0, "dust");
        _burn(msg.sender, shares);
        usdc.safeTransfer(msg.sender, usdcAmount);
    }
}
