from datetime import datetime, timedelta, timezone

from shiftload.metrics import sleep_before

START = datetime(2026, 10, 3, 14, 0, tzinfo=timezone.utc)   # 07:00 Vancouver


def at(hours_before: float) -> datetime:
    return START - timedelta(hours=hours_before)


def test_no_sleep_data_is_none_not_zero():
    assert sleep_before([], START) is None
    assert sleep_before([(at(30), at(26))], START) is None      # outside the 24 h window


def test_one_night():
    assert sleep_before([(at(7.5), at(1.5))], START) == 360


def test_overlapping_sessions_are_merged():
    # watch and phone both logged the same night
    assert sleep_before([(at(8), at(2)), (at(7), at(1))], START) == 420


def test_nap_and_night_add_up():
    assert sleep_before([(at(20), at(19)), (at(7), at(2))], START) == 360


def test_clipped_to_window_and_shift_start():
    assert sleep_before([(at(25), at(23))], START) == 60
    assert sleep_before([(at(1), START + timedelta(hours=1))], START) == 60
