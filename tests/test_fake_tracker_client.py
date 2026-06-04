"""FakeTrackerClient: без сети, предсказуемые ответы."""

from tests.support.fake_tracker_client import FakeTrackerClient, tracker_create_issue_client


def test_fake_tracker_records_json_call() -> None:
    client = tracker_create_issue_client(key="FIX-99", ticket_id="99001")
    body = client.request_json("POST", "https://tracker.test/issues/", data={"summary": "x"})
    assert body["key"] == "FIX-99"
    assert body["id"] == "99001"
    assert len(client.calls) == 1
    assert client.calls[0][0] == "POST"
