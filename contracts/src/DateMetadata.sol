// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract DateMetadata {
    using Strings for uint256;

    function isoDate(uint256 day) public pure returns (string memory) {
        require(day <= type(uint32).max, "date range");
        // Gregorian civil date from UTC epoch days (400-year eras).
        uint256 z = day + 719468;
        uint256 era = z / 146097;
        uint256 doe = z % 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 year = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 month = mp < 10 ? mp + 3 : mp - 9;
        if (month <= 2) {
            ++year;
        }
        return string.concat(year >= 10000 ? "+" : "", year.toString(), "-", two(month), "-", two(d));
    }

    function label(uint256 id, uint256 day) public pure returns (string memory) {
        return id <= day ? "USD spot" : string.concat("USD+", (id - day).toString());
    }

    function creationSymbol(uint256 id, uint256 day) external pure returns (string memory) {
        return string.concat("USD+", (id > day ? id - day : 0).toString());
    }

    function two(uint256 n) private pure returns (string memory) {
        return n < 10 ? string.concat("0", n.toString()) : n.toString();
    }

    function uri(uint256 id, uint256 day) external pure returns (string memory) {
        string memory date = isoDate(id);
        string memory title = label(id, day);
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#f0f7fa"/>',
            '<circle cx="200" cy="200" r="175" fill="#103b46" stroke="#67d8c5" stroke-width="10"/>',
            '<g fill="white" font-family="sans-serif" text-anchor="middle">',
            '<text x="200" y="125" font-size="22">CASCADE</text>',
            '<text x="200" y="205" font-size="38">',
            title,
            "</text>",
            '<text x="200" y="260" font-size="22">',
            date,
            "</text>",
            '<text x="200" y="290" font-size="15">UTC maturity</text></g></svg>'
        );
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(
                bytes(
                    string.concat(
                        '{"name":"',
                        title,
                        '","description":"Cascade dated dollar. Maturity: ',
                        date,
                        ' (UTC).","decimals":6,"image":"data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '"}'
                    )
                )
            )
        );
    }
}
