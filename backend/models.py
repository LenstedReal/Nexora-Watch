from datetime import datetime
from typing import Annotated, Any, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True)
        if data.get("_id") is None:
            data.pop("_id", None)
        return data


class Room(BaseDocument):
    code: str
    name: str
    host_id: str
    status: str = "active"
    created_at: datetime
    expires_at: datetime
    version: int = 0
    video: Optional[dict[str, Any]] = None
    queue: Optional[list[dict[str, Any]]] = None  # room_queue.py
    public: bool = False  # listed under "Açık odalar" on the home page (host opt-in)


class RoomPlayback(BaseDocument):
    room_code: str
    media_id: Optional[str] = None
    position: float = 0.0
    is_playing: bool = False
    rate: float = 1.0  # playback speed chosen by the host; guests follow it
    updated_at: int
    updated_by: Optional[str] = None
    revision: int = 0
    last_seq: int = 0


class RoomParticipant(BaseDocument):
    room_code: str
    participant_id: str
    nickname: str
    role: str
    token_hash: str
    joined_at: datetime
    last_seen_at: datetime
    online: bool = False


class RoomMessage(BaseDocument):
    msg_id: str
    room_code: str
    participant_id: Optional[str] = None
    nickname: str
    text: str
    kind: str = "chat"
    client_id: Optional[str] = None
    created_at: datetime
    # System messages only: what happened ("created", "joined", "left", "kicked", "host") and to whom, so clients can
    # show the line in their own language; "text" stays as the Turkish fallback for older clients.
    event: Optional[str] = None
    subject: Optional[str] = None


class Media(BaseDocument):
    media_id: str
    room_code: str
    owner_id: str
    filename: str
    size: int
    mime: str
    object_key: str
    driver: str
    status: str
    fingerprint: Optional[str] = None
    upload_id: Optional[str] = None
    part_size: int
    part_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None
