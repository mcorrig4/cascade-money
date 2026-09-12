// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {CascadeVault} from "./CascadeVault.sol";
import {MockUSYC} from "./mocks/MockUSYC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Local price-backed demonstration. Issue/withdraw amounts are dollars, paid in USYC shares.
contract CascadeVaultUSYC is CascadeVault {
    using SafeERC20 for IERC20;
    MockUSYC public immutable asset;
    uint256 public immutable reserveFloor;
    uint256 public lastBacking;
    uint256 public depositsSince;
    uint256 public withdrawalsSince;
    uint256 public checkpointNotional;
    event AssetCheckpoint(uint256 day, uint256 shares, uint256 price, uint256 deficit);

    constructor(MockUSYC backingAsset, address checkpointOwner, uint256 floor)
        CascadeVault(address(backingAsset.usdc()), checkpointOwner)
    {
        asset = backingAsset;
        reserveFloor = floor;
    }

    function _backingValue() internal view override returns (uint256) {
        return Math.mulDiv(asset.balanceOf(address(this)), asset.price(), SCALE);
    }

    function _deposit(address from, uint256 amount) internal override {
        uint256 beforeValue = _backingValue();
        uint256 shares = Math.mulDiv(amount, SCALE, asset.price(), Math.Rounding.Ceil);
        IERC20(address(asset)).safeTransferFrom(from, address(this), shares);
        depositsSince += _backingValue() - beforeValue;
    }

    function _sendWithdrawal(address to, uint256 amount) internal override {
        uint256 beforeValue = _backingValue();
        uint256 shares = Math.mulDiv(amount, SCALE, asset.price());
        if (shares == 0) {
            revert InvalidAmount();
        }
        IERC20(address(asset)).safeTransfer(to, shares);
        withdrawalsSince += beforeValue - _backingValue();
    }

    function _assertBacked() internal view override {
        // Deficit is a monitored breach, not a payment/transfer/extension lock.
        (uint256 b, uint256 p, uint256 y,, uint256 deficit) = balanceSheet();
        if (b + deficit < p + y) {
            revert Underbacked();
        }
    }

    function _assertLiquid() internal view override {
        (uint256 b, uint256 p, uint256 y,, uint256 deficit) = balanceSheet();
        if (deficit != 0 || b < p + y || usdc.balanceOf(address(asset)) < p + y) {
            revert Underbacked();
        }
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        super._update(from, to, ids, values);
        if (lastCheckpoint == today()) {
            checkpointNotional = totalSupply;
        }
    }

    function checkpoint(uint256) external pure override {
        revert InvalidTerms(); // A caller-supplied delta is never accepted by this variant.
    }

    function checkpoint() external nonReentrant {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        uint256 day = lastCheckpoint + 1;
        // A current mock price cannot reconstruct missed historical daily prices.
        if (day != today()) {
            revert InvalidDate();
        }
        uint256 backing = _backingValue();
        uint256 adjusted = backing + withdrawalsSince;
        uint256 baseline = lastBacking + depositsSince;
        uint256 income = adjusted > baseline ? adjusted - baseline : 0;
        uint256 target = totalSupply + _ceil(accruedScaled) + reserveFloor;
        uint256 distributable = backing > target ? backing - target : 0;
        if (distributable > income) {
            distributable = income;
        }
        activeNotional = activeNotional + starts[day] - stops[day];
        uint256 notional = checkpointNotional > activeNotional ? checkpointNotional : activeNotional;
        uint256 delta = notional == 0 ? 0 : Math.mulDiv(distributable, SCALE, notional);
        accruedScaled += activeNotional * delta;
        dailyIndex[day] = indexAt(lastCheckpoint) + delta;
        lastCheckpoint = day;
        lastBacking = backing;
        depositsSince = 0;
        withdrawalsSince = 0;
        checkpointNotional = totalSupply;
        _emitCheckpoint(day, backing);
    }

    function _emitCheckpoint(uint256 day, uint256 backing) private {
        (, uint256 principal, uint256 accrued, uint256 reserve, uint256 deficit) = balanceSheet();
        emit Checkpoint(day, dailyIndex[day], 0, backing, principal, accrued, reserve);
        emit AssetCheckpoint(day, asset.balanceOf(address(this)), asset.price(), deficit);
    }
}
