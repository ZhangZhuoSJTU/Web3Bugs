// SPDX-License-Identifier: GNU Lesser General Public License 3.0
pragma solidity ^0.8.4;

// ----------------------------------------------------------------------------
// BokkyPooBah's DateTime Library v1.00 - Contract Instance
//
// A gas-efficient Solidity date and time library
//
// https://github.com/bokkypoobah/BokkyPooBahsDateTimeLibrary
//
// Tested date range 1970/01/01 to 2345/12/31
//
// Conventions:
// Unit      | Range         | Notes
// :-------- |:-------------:|:-----
// timestamp | >= 0          | Unix timestamp, number of seconds since 1970/01/01 00:00:00 UTC
// year      | 1970 ... 2345 |
// month     | 1 ... 12      |
// day       | 1 ... 31      |
// hour      | 0 ... 23      |
// minute    | 0 ... 59      |
// second    | 0 ... 59      |
// dayOfWeek | 1 ... 7       | 1 = Monday, ..., 7 = Sunday
//
//
// Enjoy. (c) BokkyPooBah / Bok Consulting Pty Ltd 2018.
//
// GNU Lesser General Public License 3.0
// https://www.gnu.org/licenses/lgpl-3.0.en.html
// ----------------------------------------------------------------------------

import "./BokkyPooBahsDateTimeLibrary.sol";

contract BokkyPooBahsDateTimeContract {
    uint256 public constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 public constant SECONDS_PER_HOUR = 60 * 60;
    uint256 public constant SECONDS_PER_MINUTE = 60;
    int256 public constant OFFSET19700101 = 2440588;

    uint256 public constant DOW_MON = 1;
    uint256 public constant DOW_TUE = 2;
    uint256 public constant DOW_WED = 3;
    uint256 public constant DOW_THU = 4;
    uint256 public constant DOW_FRI = 5;
    uint256 public constant DOW_SAT = 6;
    uint256 public constant DOW_SUN = 7;

    function _now() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }

    function _nowDateTime()
        public
        view
        returns (
            uint256 year,
            uint256 month,
            uint256 day,
            uint256 hour,
            uint256 minute,
            uint256 second
        )
    {
        (year, month, day, hour, minute, second) = BokkyPooBahsDateTimeLibrary
            .timestampToDateTime(block.timestamp);
    }

    function _daysFromDate(
        uint256 year,
        uint256 month,
        uint256 day
    ) public pure returns (uint256 _days) {
        return BokkyPooBahsDateTimeLibrary._daysFromDate(year, month, day);
    }

    function _daysToDate(uint256 _days)
        public
        pure
        returns (
            uint256 year,
            uint256 month,
            uint256 day
        )
    {
        return BokkyPooBahsDateTimeLibrary._daysToDate(_days);
    }

    function timestampFromDate(
        uint256 year,
        uint256 month,
        uint256 day
    ) public pure returns (uint256 timestamp) {
        return BokkyPooBahsDateTimeLibrary.timestampFromDate(year, month, day);
    }

    function timestampFromDateTime(
        uint256 year,
        uint256 month,
        uint256 day,
        uint256 hour,
        uint256 minute,
        uint256 second
    ) public pure returns (uint256 timestamp) {
        return
            BokkyPooBahsDateTimeLibrary.timestampFromDateTime(
                year,
                month,
                day,
                hour,
                minute,
                second
            );
    }

    function timestampToDate(uint256 timestamp)
        public
        pure
        returns (
            uint256 year,
            uint256 month,
            uint256 day
        )
    {
        (year, month, day) = BokkyPooBahsDateTimeLibrary.timestampToDate(
            timestamp
        );
    }

    function timestampToDateTime(uint256 timestamp)
        public
        pure
        returns (
            uint256 year,
            uint256 month,
            uint256 day,
            uint256 hour,
            uint256 minute,
            uint256 second
        )
    {
        (year, month, day, hour, minute, second) = BokkyPooBahsDateTimeLibrary
            .timestampToDateTime(timestamp);
    }

    function isValidDate(
        uint256 year,
        uint256 month,
        uint256 day
    ) public pure returns (bool valid) {
        valid = BokkyPooBahsDateTimeLibrary.isValidDate(year, month, day);
    }

    function isValidDateTime(
        uint256 year,
        uint256 month,
        uint256 day,
        uint256 hour,
        uint256 minute,
        uint256 second
    ) public pure returns (bool valid) {
        valid = BokkyPooBahsDateTimeLibrary.isValidDateTime(
            year,
            month,
            day,
            hour,
            minute,
            second
        );
    }

    function isLeapYear(uint256 timestamp) public pure returns (bool leapYear) {
        leapYear = BokkyPooBahsDateTimeLibrary.isLeapYear(timestamp);
    }

    function _isLeapYear(uint256 year) public pure returns (bool leapYear) {
        leapYear = BokkyPooBahsDateTimeLibrary._isLeapYear(year);
    }

    function isWeekDay(uint256 timestamp) public pure returns (bool weekDay) {
        weekDay = BokkyPooBahsDateTimeLibrary.isWeekDay(timestamp);
    }

    function isWeekEnd(uint256 timestamp) public pure returns (bool weekEnd) {
        weekEnd = BokkyPooBahsDateTimeLibrary.isWeekEnd(timestamp);
    }

    function getDaysInMonth(uint256 timestamp)
        public
        pure
        returns (uint256 daysInMonth)
    {
        daysInMonth = BokkyPooBahsDateTimeLibrary.getDaysInMonth(timestamp);
    }

    function _getDaysInMonth(uint256 year, uint256 month)
        public
        pure
        returns (uint256 daysInMonth)
    {
        daysInMonth = BokkyPooBahsDateTimeLibrary._getDaysInMonth(year, month);
    }

    function getDayOfWeek(uint256 timestamp)
        public
        pure
        returns (uint256 dayOfWeek)
    {
        dayOfWeek = BokkyPooBahsDateTimeLibrary.getDayOfWeek(timestamp);
    }

    function getYear(uint256 timestamp) public pure returns (uint256 year) {
        year = BokkyPooBahsDateTimeLibrary.getYear(timestamp);
    }

    function getMonth(uint256 timestamp) public pure returns (uint256 month) {
        month = BokkyPooBahsDateTimeLibrary.getMonth(timestamp);
    }

    function getDay(uint256 timestamp) public pure returns (uint256 day) {
        day = BokkyPooBahsDateTimeLibrary.getDay(timestamp);
    }

    function getHour(uint256 timestamp) public pure returns (uint256 hour) {
        hour = BokkyPooBahsDateTimeLibrary.getHour(timestamp);
    }

    function getMinute(uint256 timestamp) public pure returns (uint256 minute) {
        minute = BokkyPooBahsDateTimeLibrary.getMinute(timestamp);
    }

    function getSecond(uint256 timestamp) public pure returns (uint256 second) {
        second = BokkyPooBahsDateTimeLibrary.getSecond(timestamp);
    }

    function addYears(uint256 timestamp, uint256 _years)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.addYears(timestamp, _years);
    }

    function addMonths(uint256 timestamp, uint256 _months)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.addMonths(
            timestamp,
            _months
        );
    }

    function addDays(uint256 timestamp, uint256 _days)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.addDays(timestamp, _days);
    }

    function addHours(uint256 timestamp, uint256 _hours)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.addHours(timestamp, _hours);
    }

    function addMinutes(uint256 timestamp, uint256 _minutes)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.addMinutes(
            timestamp,
            _minutes
        );
    }

    function addSeconds(uint256 timestamp, uint256 _seconds)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.addSeconds(
            timestamp,
            _seconds
        );
    }

    function subYears(uint256 timestamp, uint256 _years)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.subYears(timestamp, _years);
    }

    function subMonths(uint256 timestamp, uint256 _months)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.subMonths(
            timestamp,
            _months
        );
    }

    function subDays(uint256 timestamp, uint256 _days)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.subDays(timestamp, _days);
    }

    function subHours(uint256 timestamp, uint256 _hours)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.subHours(timestamp, _hours);
    }

    function subMinutes(uint256 timestamp, uint256 _minutes)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.subMinutes(
            timestamp,
            _minutes
        );
    }

    function subSeconds(uint256 timestamp, uint256 _seconds)
        public
        pure
        returns (uint256 newTimestamp)
    {
        newTimestamp = BokkyPooBahsDateTimeLibrary.subSeconds(
            timestamp,
            _seconds
        );
    }

    function diffYears(uint256 fromTimestamp, uint256 toTimestamp)
        public
        pure
        returns (uint256 _years)
    {
        _years = BokkyPooBahsDateTimeLibrary.diffYears(
            fromTimestamp,
            toTimestamp
        );
    }

    function diffMonths(uint256 fromTimestamp, uint256 toTimestamp)
        public
        pure
        returns (uint256 _months)
    {
        _months = BokkyPooBahsDateTimeLibrary.diffMonths(
            fromTimestamp,
            toTimestamp
        );
    }

    function diffDays(uint256 fromTimestamp, uint256 toTimestamp)
        public
        pure
        returns (uint256 _days)
    {
        _days = BokkyPooBahsDateTimeLibrary.diffDays(
            fromTimestamp,
            toTimestamp
        );
    }

    function diffHours(uint256 fromTimestamp, uint256 toTimestamp)
        public
        pure
        returns (uint256 _hours)
    {
        _hours = BokkyPooBahsDateTimeLibrary.diffHours(
            fromTimestamp,
            toTimestamp
        );
    }

    function diffMinutes(uint256 fromTimestamp, uint256 toTimestamp)
        public
        pure
        returns (uint256 _minutes)
    {
        _minutes = BokkyPooBahsDateTimeLibrary.diffMinutes(
            fromTimestamp,
            toTimestamp
        );
    }

    function diffSeconds(uint256 fromTimestamp, uint256 toTimestamp)
        public
        pure
        returns (uint256 _seconds)
    {
        _seconds = BokkyPooBahsDateTimeLibrary.diffSeconds(
            fromTimestamp,
            toTimestamp
        );
    }
}
