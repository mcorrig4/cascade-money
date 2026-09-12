// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Indexed min-heap of nonzero token dates. No maturity maintenance is needed.
library AccountDates {
    struct Heap {
        uint256[] dates;
        mapping(uint256 => uint256) position; // index + 1; zero means absent
    }

    function first(Heap storage self) internal view returns (uint256) {
        return self.dates.length == 0 ? type(uint256).max : self.dates[0];
    }

    function add(Heap storage self, uint256 date) internal {
        if (self.position[date] != 0) {
            return;
        }
        self.dates.push(date);
        _up(self, self.dates.length - 1, date);
    }

    function remove(Heap storage self, uint256 date) internal {
        uint256 pos = self.position[date];
        if (pos == 0) {
            return;
        }
        uint256 i = pos - 1;
        uint256 last = self.dates[self.dates.length - 1];
        self.dates.pop();
        delete self.position[date];
        if (i == self.dates.length) {
            return;
        }
        if (i > 0 && last < self.dates[(i - 1) / 2]) {
            _up(self, i, last);
        } else {
            uint256 length = self.dates.length;
            while (2 * i + 1 < length) {
                uint256 child = 2 * i + 1;
                if (child + 1 < length && self.dates[child + 1] < self.dates[child]) {
                    ++child;
                }
                if (self.dates[child] >= last) {
                    break;
                }
                self.dates[i] = self.dates[child];
                self.position[self.dates[i]] = i + 1;
                i = child;
            }
            self.dates[i] = last;
            self.position[last] = i + 1;
        }
    }

    function _up(Heap storage self, uint256 i, uint256 date) private {
        while (i > 0) {
            uint256 parent = (i - 1) / 2;
            if (self.dates[parent] <= date) {
                break;
            }
            self.dates[i] = self.dates[parent];
            self.position[self.dates[i]] = i + 1;
            i = parent;
        }
        self.dates[i] = date;
        self.position[date] = i + 1;
    }
}
