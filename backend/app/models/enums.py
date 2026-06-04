from enum import Enum


def pg_enum_values(enum_cls: type[Enum]) -> list[str]:
    """Значения str-enum для PostgreSQL (нижний регистр), не имена членов"""
    return [member.value for member in enum_cls]


class UserRole(str, Enum):
    ADMIN = "admin"
    SYSADMIN = "sysadmin"


class RepairStatus(str, Enum):
    NOT_IN_REPAIR = "not_in_repair"
    IN_REPAIR = "in_repair"


class RequestStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    NEEDS_INFO = "needs_info"
    CLOSED = "closed"


class AttachmentsSyncStatus(str, Enum):
    NONE = "none"
    PARTIAL = "partial"
    COMPLETE = "complete"


class AnnouncementAudience(str, Enum):
    ALL = "all"
    ADMINS_ONLY = "admins_only"


class AnnouncementSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    DANGER = "danger"
