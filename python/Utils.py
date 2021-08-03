import simplejson
import numpy as np

def iterable(obj):
    try:
        iter(obj)
    except Exception:
        return False
    else:
        return True
  