import numpy as np
import pandas as pd
import Utils
import matplotlib.pyplot as plt
from Autoencoders import *

class DataInputer():
    #class that takes in the original data and formats it into arrays
    #uses an autoencoder to inpute missing values and denoise the data
    def __init__(self,
                 keys = None,
                 autoencoder_kwargs = {},
                 denoise_alpha = .1,
                ):
        self.keys = keys
        self.autoencoder_kwargs = autoencoder_kwargs
        self.denoise_alpha = denoise_alpha
        self.autoencoder_error_report = None
        
    def get_keys(self,pdata):
        patients = pdata['patients']
        keys = set([])
        for pid, pentry in patients.items():
            for organ, odata in pentry.items():
                k = set(odata.keys())
                keys = keys.union(k)
        return keys
        
    def get_formatted_arrays(self, pdata,retrain=False):
        if self.keys is None:
            keys = self.get_keys(pdata)
        else:
            keys = self.keys
        data = autoencode(pdata, keys,train=retrain)
        self.save_autoencoder_error_report(data)
        ddict = {}
        for k in keys:
            ddict[k] = self.inpute_spatial_array(data,k)
            ddict[k+'_missing'] = np.isnan(data[k]['original'])
        return ddict
    
    def save_autoencoder_error_report(self, autoencoder_results):
        #means should be slightly higher because nans are filled in
        report = []
        for k,v in autoencoder_results.items():
            entry = {'key': k}
            mre = numpy_nan_reconstruction_error(v['denoised'],v['original'])
            entry['_mean_reconstruction_error (%)'] = mre
            for kk,vv in v.items():
                mean = np.round(np.nanmean(vv),5)
                std = np.round(np.nanstd(vv),5)
                numnan = np.isnan(vv).sum()
                entry['mean_' + kk] = mean
                entry['std_' + kk] = std
                entry['shape_' + kk] = vv.shape
                entry['num_nan_' + kk] = numnan
            report.append(entry)
        self.autoencoder_error_report = pd.DataFrame(report).set_index('key')
        return
        
    def error_report(self):
        if self.autoencoder_error_report is not None:
            return self.autoencoder_error_report
        else:
            print("no autoencoder has been run")
            
    def inpute_spatial_array(self, autoencoded_dict, key,clip=True):
        #quick wrapper
        d = autoencoded_dict
        return self.inpute_nan(d[key]['original'].copy(), d[key]['denoised'].copy(),clip) 
    
    def inpute_nan(self, original, denoised,clip=True):
        alpha = self.denoise_alpha
        out = ((1-alpha)*original) + (alpha*denoised)
        nan_args = np.argwhere(np.isnan(original))
        if nan_args.shape[0] > 0:
            out[nan_args] = denoised[nan_args]
        if clip:
            out = out.clip(min=original.min(),max=original.max())
        return out

#stuff for converting from a json format to formatted arrays for each value
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

#stuff for training autoencoder 
def nan_mse_loss(ypred, y):
    #ignores loss in the autoencoder for missing values
    y = torch.flatten(y)
    ypred = torch.flatten(ypred)
    mask = torch.isnan(y)
    out = (ypred[~mask] - y[~mask])**2
    loss = out.mean()
    return loss

def np_to_torch(x):
#     x = x.reshape((x.shape[0],-1))
    x = torch.tensor(x).float()
    return x
    
def train_autoencoder(autoencoder, x, model_path, 
                      lr=.001,
                      patience = 200,
                      plot_hist = False,
                      epochs = 10000,
                     ):
    optimizer = torch.optim.Adam(autoencoder.parameters(), lr = lr)
    #this is the one that saves the best model during training
    early_stopping = EarlyStopping(patience = patience, path=model_path)
    losses = []
    for epoch in range(epochs):
        optimizer.zero_grad()
        y_pred = autoencoder(x)
        
        loss = nan_mse_loss(y_pred, x)
        loss.backward()
        losses.append(loss.item())
        optimizer.step()
        torch.cuda.empty_cache()
        early_stopping(loss.item(), autoencoder)
        if early_stopping.early_stop:
            print('training stopped on epoch', epoch - patience)
            break
    autoencoder.load_state_dict(torch.load(model_path))
    if plot_hist:
        print('initial_loss', nan_mse_loss(torch.zeros(x.shape),x))
        print('best loss', early_stopping.best_score)
        plt.plot(early_stopping.get_loss_history())
    return autoencoder
    
def get_trained_autoencoder(x, 
                      train = False,
                      model_path = None, 
                      **kwargs): 
    #takes x np array in form n_items x (dims)
    #assumes missing values are nan and ignores them in training
    #saves model to model_path or default resources dir as autoencoder_<nitems>.pt
    autoencoder = OrganAutoEncoder(x.reshape((x.shape[0],-1)).shape[-1])
    
    if model_path is None:
        model_path = pytorch_model_name(x)
        print("autoencoder path not set with original info needed for recreation")
    if not train:
        try: 
            autoencoder.load_state_dict(torch.load(model_path))
        except:
            print("issue loading pretrained autoencoder",model_path,'training...')
            autoencoder = train_autoencoder(autoencoder, x, model_path, **kwargs)
    else:
        autoencoder = train_autoencoder(autoencoder, x, model_path, **kwargs)
        
    autoencoder = autoencoder.eval()
    return autoencoder

def pytorch_model_name(x, keys = None):
    name = Const.pytorch_model_dir + 'autoencoder' 
    if keys is not None:
        name += "_" + '_'.join(keys) 
    else:
        name += "_nokeys"
    name += '_' + 'x'.join([str(s) for s in x.shape])
    name += '.pt'
    return name

def autoencode(sdata, keys, **kwargs):
    #convert things into a normalized float that works with torch
    x_original, x_dims = multikey_merged_spatial_array(sdata,keys)
    normalizer = Normalizer(x_original)
    x = normalizer.transform(x_original)
    x = torch.tensor(x).float()
    
    #make model name encode original settings to prevent confusion
    model_path = pytorch_model_name(x, keys)
    autoencoder = get_trained_autoencoder(x, model_path = model_path, **kwargs)
    #check the final loss
    x_encoded = autoencoder(x)
    print(nan_mse_loss(x_encoded,x))
    
    x_out = x_encoded.cpu().detach().numpy()
    x_out = normalizer.unnormalize(x_out)
    out_arrays = {}
    curr_pos = 0
    for key, dim in x_dims:
        next_pos = curr_pos + dim
        x_key = x_out[:,:,curr_pos: next_pos]
        x0_key = x_original[:,:, curr_pos: next_pos]
        curr_pos = next_pos
        out_arrays[key] = {'denoised': x_key, 'original': x0_key}
    return out_arrays

def numpy_nan_reconstruction_error(ypred, y):
    y_mask = np.ma.masked_invalid(y)
    ypred_mask = np.ma.array(ypred, mask = y_mask.mask)
    out = np.abs(y_mask - ypred_mask)/np.abs(y_mask)
    return 100*out.mean()