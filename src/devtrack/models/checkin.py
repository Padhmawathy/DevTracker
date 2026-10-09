
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class DeveloperCheckIn:
    project_name: str
    work_description: str
    category: str
    blocker: Optional[str] = None
    created_at: datetime = field(
        default_factory=datetime.now
    )
