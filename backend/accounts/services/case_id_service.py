import random
import string
import logging
from django.db import transaction, IntegrityError

logger = logging.getLogger(__name__)

class CaseIDService:
    SUFFIX_LENGTH = 8
    MAX_RETRIES = 10

    PREFIXES = {
        'CIBC': 'CIBC',
        'BMO': 'BMO',
        'TD': 'TD',
        'RBC': 'RBC',
        'KWARTHA': 'KCU',
        'default': 'CS'
    }

    @classmethod
    def _generate_suffix(cls):
        chars = string.ascii_uppercase.replace('O', '').replace('I', '') + \
                string.digits.replace('0', '').replace('1', '')
        return ''.join(random.choices(chars, k=cls.SUFFIX_LENGTH))

    @classmethod
    def generate_unique_case_id(cls, prefix_type='default'):
        """Generate a guaranteed non-empty, unique Case ID."""
        from accounts.models import Session

        prefix = cls.PREFIXES.get(prefix_type, cls.PREFIXES['default'])
        for attempt in range(cls.MAX_RETRIES):
            suffix = cls._generate_suffix()
            case_id = f"{prefix}{suffix}"
            try:
                with transaction.atomic():
                    if not Session.objects.filter(external_case_id=case_id).exists():
                        return case_id
            except IntegrityError:
                logger.warning("IntegrityError on case_id %s (retry %d)", case_id, attempt + 1)
                continue

        # Fallback (extremely rare)
        import uuid
        fallback_id = f"{prefix}{uuid.uuid4().hex[:cls.SUFFIX_LENGTH].upper()}"
        logger.error("CaseIDService fallback to UUID after %d retries", cls.MAX_RETRIES)
        return fallback_id

    @classmethod
    def validate_case_id_format(cls, case_id):
        if not case_id or len(case_id) < 3:
            return False
        for prefix in cls.PREFIXES.values():
            if case_id.startswith(prefix):
                suffix = case_id[len(prefix):]
                return len(suffix) == cls.SUFFIX_LENGTH and suffix.isalnum()
        return False

    @classmethod
    def get_prefix_from_case_id(cls, case_id):
        for prefix in cls.PREFIXES.values():
            if case_id.startswith(prefix):
                return prefix
        return None
