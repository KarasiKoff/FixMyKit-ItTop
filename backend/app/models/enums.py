from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    SYSADMIN = "sysadmin"


class RepairStatus(str, Enum):
    NOT_IN_REPAIR = "not_in_repair"
    IN_REPAIR = "in_repair"


class RequestStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class AttachmentsSyncStatus(str, Enum):
    NONE = "none"
    PARTIAL = "partial"
    COMPLETE = "complete"
