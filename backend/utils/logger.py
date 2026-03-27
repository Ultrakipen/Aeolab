import logging
import json
import sys
from datetime import datetime


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            log.update(record.extra)
        return json.dumps(log, ensure_ascii=False)


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])
    # PM2가 stdout을 자동으로 ~/.pm2/logs/ 에 저장
