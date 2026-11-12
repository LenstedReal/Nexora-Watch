from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL, tz_aware=True)
db = client[DB_NAME]


async def ensure_indexes():
    await db.rooms.create_index("code", unique=True)
    await db.room_playback.create_index("room_code", unique=True)
    await db.room_participants.create_index([("room_code", 1), ("participant_id", 1)], unique=True)
    await db.room_messages.create_index([("room_code", 1), ("created_at", 1)])
    await db.room_messages.create_index(
        [("room_code", 1), ("client_id", 1)],
        unique=True,
        partialFilterExpression={"client_id": {"$type": "string"}},
    )
    await db.media.create_index("media_id", unique=True)
    await db.media.create_index([("room_code", 1), ("status", 1)])
    await db.sync_metrics.create_index([("room_code", 1), ("t", 1)])
    await db.usage.create_index("month", unique=True)
    await db.room_bans.create_index([("room_code", 1), ("participant_id", 1)])
