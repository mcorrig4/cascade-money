// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {AccountDates} from "../src/libraries/AccountDates.sol";

contract AccountDatesTest is Test {
    using AccountDates for AccountDates.Heap;
    AccountDates.Heap heap;

    function testFuzzArbitraryAddRemovePreservesIndex(bytes memory operations) public {
        bool[64] memory present;
        uint256 length = operations.length > 256 ? 256 : operations.length;
        for (uint256 i; i < length; ++i) {
            uint256 value = uint8(operations[i]) % 64;
            if (uint8(operations[i]) < 128) {
                heap.add(value);
                present[value] = true;
            } else {
                heap.remove(value);
                present[value] = false;
            }
            uint256 minimum = type(uint256).max;
            uint256 count;
            for (uint256 j; j < 64; ++j) {
                if (present[j]) {
                    if (j < minimum) {
                        minimum = j;
                    }
                    ++count;
                    assertGt(heap.position[j], 0);
                } else {
                    assertEq(heap.position[j], 0);
                }
            }
            assertEq(heap.dates.length, count);
            assertEq(heap.first(), minimum);
            for (uint256 j; j < count; ++j) {
                assertEq(heap.position[heap.dates[j]], j + 1);
                if (j > 0) {
                    assertLe(heap.dates[(j - 1) / 2], heap.dates[j]);
                }
            }
        }
    }
}
