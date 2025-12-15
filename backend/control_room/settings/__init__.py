import os

# Default to local settings for development
environment = os.getenv('DJANGO_ENV', 'local')

if environment == 'production':
    from .production import *
elif environment == 'docker':
    from .docker import *
else:
    from .local import *