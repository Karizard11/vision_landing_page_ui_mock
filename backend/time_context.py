from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from math import ceil
import re
from typing import Any
from zoneinfo import ZoneInfo


SAST = ZoneInfo("Africa/Johannesburg")
UTC = timezone.utc
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


@dataclass(frozen=True)
class QueryWindow:
    start_day: date
    end_day: date
    from_time: str
    to_time: str
    start_sast: datetime
    end_sast: datetime
    end_sast_exclusive: datetime
    start_utc: datetime
    end_utc: datetime

    @property
    def duration_minutes(self) -> int:
        return int((self.end_sast_exclusive - self.start_sast).total_seconds() // 60)

    @property
    def duration_day_count(self) -> int:
        return max(1, ceil(self.duration_minutes / (24 * 60)))

    @property
    def is_full_day_selection(self) -> bool:
        return self.from_time == "00:00" and self.to_time == "23:59"


def _calendar_day(value: str, name: str) -> date:
    if not DATE_PATTERN.fullmatch(value):
        raise ValueError(f"{name} must be a valid YYYY-MM-DD date")
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as error:
        raise ValueError(f"{name} must be a valid calendar date") from error


def _clock_time(value: str, name: str) -> tuple[int, int]:
    if not TIME_PATTERN.fullmatch(value):
        raise ValueError(f"{name} must be a valid HH:MM time")
    hour, minute = value.split(":")
    return int(hour), int(minute)


def build_query_window(
    from_value: str,
    to_value: str,
    from_time: str = "00:00",
    to_time: str = "23:59",
    *,
    max_days: int,
) -> QueryWindow:
    start_day = _calendar_day(from_value, "from")
    end_day = _calendar_day(to_value, "to")
    start_hour, start_minute = _clock_time(from_time, "from_time")
    end_hour, end_minute = _clock_time(to_time, "to_time")
    start_sast = datetime(
        start_day.year, start_day.month, start_day.day,
        start_hour, start_minute, tzinfo=SAST,
    )
    end_sast = datetime(
        end_day.year, end_day.month, end_day.day,
        end_hour, end_minute, tzinfo=SAST,
    )
    if end_sast < start_sast:
        raise ValueError("the selected end date and time must not be earlier than the start")
    end_sast_exclusive = end_sast + timedelta(minutes=1)
    duration_minutes = int((end_sast_exclusive - start_sast).total_seconds() // 60)
    if duration_minutes > max_days * 24 * 60:
        raise ValueError(f"date range must not exceed {max_days} days")
    return QueryWindow(
        start_day=start_day,
        end_day=end_day,
        from_time=from_time,
        to_time=to_time,
        start_sast=start_sast,
        end_sast=end_sast,
        end_sast_exclusive=end_sast_exclusive,
        start_utc=start_sast.astimezone(UTC).replace(tzinfo=None),
        end_utc=end_sast_exclusive.astimezone(UTC).replace(tzinfo=None),
    )


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    return datetime.fromisoformat(str(value))


def doris_utc_to_sast(value: Any) -> datetime:
    timestamp = _as_datetime(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    return timestamp.astimezone(SAST)


def sast_bucket_datetime(value: Any) -> datetime:
    timestamp = _as_datetime(value)
    return timestamp.replace(tzinfo=SAST) if timestamp.tzinfo is None else timestamp.astimezone(SAST)


def solcast_period_start_sast(value: Any) -> datetime:
    timestamp = _as_datetime(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    return (timestamp - timedelta(minutes=30)).astimezone(SAST)
