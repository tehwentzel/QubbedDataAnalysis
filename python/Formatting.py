import numpy as np
import pandas as pd
import Utils

def get_default_shape(pdict, key):
    default = None
    for pid, odata in pdict.items():
        for organ, organ_entry in odata.items():
            ovalues = organ_entry.get(key, None)
            if ovalues is not None:
                if(Utils.iterable(ovalues)):
                    return [np.nan for x in ovalues]
                else:
                    return np.nan
    print("error getting default")
    return None

def patient_organs_to_list(p_entry, key, organ_list, default):
    p_list = []
    for ii, organ in enumerate(organ_list):
        if organ not in p_entry.keys():
            values = default
        else:
            values = p_entry.get(organ).get(key)
        p_list.append(values)
    return p_list

def get_spatial_oar_array(sdict, key):
    #return n_patients x n_organs x n_values (if not a single thing)
    #doesn't include gtv
    patients = sdict['patients']
    organ_list = sdict['organs']
    pids = sorted(patients.keys())
    val_list = []
    default = get_default_shape(patients, key)
    for idx, pid in enumerate(pids):
        p_entry = patients.get(pid)
        p_list = patient_organs_to_list(p_entry, key, organ_list, default)
        val_list.append(p_list)
    return np.stack(val_list)

def aggregate_gtv_entry(gtv_list, key, aggfunc):
    #takes a single entry {'GTVp': {data}, 'GTVn': {data}, <GTVn2>...}
    vals = []
    for gdata in gtv_list:
        d = gdata.get(key,None)
        if(d is not None):
            vals.append(d)
    if len(vals) < 1:
        return None
    vals = np.stack(vals).astype('float')
    if np.isnan(vals).all():
        return None
    return np.apply_along_axis(aggfunc,0,vals)
    
def get_spatial_gtv_array(sdict, key, agg = None, filter_string = 'GTV'):
    patients = sdict['patients']
    organ_list = sdict['organs']
    default = get_default_shape(patients, key)
    #since we have an arbiratry # of gtvs, we need an aggregator
    if agg is None:
        if 'distance' in key:
            agg = np.nanmin
        if 'volume' in key or 'dose' in key:
            agg = np.nanmax
        else:
            #just take the value from the largest tumore
            agg = lambda x: x[0]
    val_list = []
    pids = sorted(patients.keys())
    for i, pid in enumerate(pids):
        p = patients.get(pid)
        gtvs = [v for k,v in p.items() if filter_string in k]
        #sort by largest so we can use
        gtvs = sorted(gtvs, key = lambda x: x.get('volume',0))
        if(len(gtvs) < 1):
            print('missing gtvs', pid, p.keys())
            print()
        gtv_vals = aggregate_gtv_entry(gtvs, key, agg)
        if gtv_vals is not None:
            val_list.append(gtv_vals)
        else:
            val_list.append(default)
    return np.stack(val_list)

def notnan(a):
    return np.ma.array(a, mask = np.isnan(a))

def merged_spatial_array(sdict, key, replace_nan = False, keep_third_dim = True, **kwargs):
    #creates a merged array with the aggregated gtv at the ned
    oar_array = get_spatial_oar_array(sdict, key)
    gtv_array = get_spatial_gtv_array(sdict, key, **kwargs)
    gtv_array =np.expand_dims(gtv_array,axis=1)
    arr = np.append(gtv_array, oar_array, axis = 1)
    if replace_nan:
        arr = np.nan_to_num(arr)
    #should be n_patients x (n_organs + gtv) x data_dims (nothing, 3 or n_organs)
    if keep_third_dim and arr.ndim < 3:
        arr = np.expand_dims(arr, axis = -1)
    return arr

def multikey_merged_spatial_array(sdict, keys,  **kwargs):
    #creates a combined array of values for different keys.  merged in the 3rd dimension
    #should be (n_patients) x (n_organs + gtv) x (sum of feature dimensions for each key)
    #also returns a list of (key, original feature dimension) tuples for reconstruction
    merged_array = None
    assert(Utils.iterable(keys))
    original_dims = []
    for k in keys:
        array = merged_spatial_array(sdict, k, **kwargs)
        if array.ndim < 3:
            array = np.expand_dims(array, axis =-1)
        original_dims.append((k,array.shape[-1]))
        if merged_array is None:
            merged_array = array
        else:
            merged_array = np.append(merged_array, array, axis=2)
    return merged_array, original_dims