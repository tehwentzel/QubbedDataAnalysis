import pandas as pd
import numpy as np
import json
from shapely.geometry import Polygon, MultiPolygon, Point, mapping, shape
import matplotlib as plt

def np_converter(obj):
    #converts stuff to vanilla python  for json since it gives an error with np.int64 and arrays
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.float) or isinstance(obj, float):
        #this doesnt work?
        return round(float(obj),3)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, datetime.datetime):
        return obj.__str__()

class NumpyEncoder(json.JSONEncoder):
    """ Custom encoder for numpy data types """
    def default(self, obj):
        if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                            np.int16, np.int32, np.int64, np.uint8,
                            np.uint16, np.uint32, np.uint64)):

            return int(obj)

        elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
            if obj.isnan():
                return 'null'
            else:
                return float(obj)

        elif isinstance(obj, (np.complex_, np.complex64, np.complex128)):
            return {'real': obj.real, 'imag': obj.imag}

        elif isinstance(obj, (np.ndarray,)):
            return obj.tolist()

        elif isinstance(obj, (np.bool_)):
            return bool(obj)

        elif isinstance(obj, (np.void)): 
            return None

        return json.JSONEncoder.default(self, obj)
    
def load_json(string):
    return json.loads(string.replace("\'", "\""))

def read_json(file):
    with open(file,'r') as f:
        j = json.load(f)
    return j