import pandas as pd
import numpy as np
from Constants import Const
import simplejson
from re import findall, match, sub
import Utils
from glob import glob

class OrganData():
    
    additional_renames = {
        'Lt_Ant_Digastric_M': 'Musc_Digastric_LA',
        'Rt_Ant_Digastric_M': 'Musc_Digastric_RA',
    }
    
    #should map columns to the ones in the lists below
    file_header_renames = {
        'x coordinate': 'x',
        'y coordinate': 'y',
        'z coordinate': 'z',
        'ROI': 'roi',
        'Structure Volume': 'volume',
        'Min Value': 'min_dose',
        'Max Value': 'max_dose',
        'Mean Value': 'mean_dose'
    }
    
    roi_cols = ['Reference ROI','Target ROI']
    roi_dist_col = 'Eucledian Distance (mm)'
    
    centroid_roi_col = 'roi'
    volume_col = 'volume'
    mean_dose_col = 'mean_dose'
    centroid_cols = ['x','y','z']
    
    default_organs = [
        '_GTVp',
        '_GTVn',
        'Brainstem',
        'Oral_Cavity',
        'Larynx',
        'Musc_Masseter',
        'Tongue',
        'Musc_Sclmast',
        'Test'
    ]

    def __init__(
        self, 
        organ_info_json = None, 
        only_default_organs = True, 
        data_type = np.float16
    ):
        self.default_organs = only_default_organs
        self.data_type = data_type
        organ_info_json = Const.organ_info_json if organ_info_json is None else organ_info_json
        with open(Const.organ_info_json) as f:
            organ_dict = simplejson.load(f)
            
        if only_default_organs:
            defaults = set(OrganData.default_organs).intersection(set(organ_dict.keys()))
            excluded = set(OrganData.default_organs) - set(organ_dict.keys())
            if len(excluded) > 0:
                print("organs not found in resource file", excluded)
            defaults = sorted(defaults)
            self.organ_dict = {o:organ_dict[o] for o in defaults}
        else:
            self.organ_dict = organ_dict
        self.organ_list = self.get_organ_list()
        self.num_organs = len(self.organ_list)
    
    def get_organ_list(self, skip_gtv = True):
        olist = []
        for organ,odata in self.organ_dict.items():
            if skip_gtv and odata['tissue_type'] == 'gtv':
                continue
            pmods = odata['positional_modifiers']
            for pm in pmods:
                olist.append(organ+pm)
            if len(pmods) < 1:
                olist.append(organ)
        return sorted(olist)
            
    def oar_rename_dict(self):
        #gives a dict for renaming organs in the old CAMPRt cohort with the new organ names
        rename_dict = OrganData.additional_renames
        for organ,odata in self.organ_dict.items():
            for alt_name in odata['alt_names']:
                pm = odata['positional_modifiers']
                if len(pm) < 1:
                    rename_dict[alt_name] = organ
                else:
                    for modifier in pm:
                        alt_key = self.standardize_position_modifier(alt_name, modifier)
                        rename_dict[alt_key] = organ + modifier
        return rename_dict
    
    def standardize_position_modifier(self, old_basename, new_modifier):
        #just reconciling the way the positions are added between cohorts
        new_name = old_basename
        lmod = new_modifier.lower()
        if('_r' in lmod):
            new_name = 'Rt_' + new_name
        elif('_l' in lmod):
            new_name = 'Lt_' + new_name
        elif('rt_' in lmod):
            new_name = new_name + '_R'
        elif('lt_' in lmod):
            new_name = new_name + '_L'
        return new_name
    
    def reconcile_organ_names(self, organ_dist_df, columns = None):
        #basically tries to standardize organ names accross datasets
        if type(columns) != type(None):
            organ_dist_df = organ_dist_df[columns]
        #check that this works idk
        organ_dist_df.replace(to_replace = r'_*GTV.*N', value = '_GTVn', regex = True, inplace = True)
        return organ_dist_df.replace(self.oar_rename_dict())
    
    def reconcile_cohort_columns(self, organ_df):
        #placeholder
        return organ_df.rename(OrganData.file_header_renames,axis=1)
    
    
    def read_spatial_file(self, file):
        df = pd.read_csv(file)
        df = self.reconcile_organ_names(df)
        df = self.reconcile_cohort_columns(df)
        return df

    def format_patient_distances(self, pdist_file):
        #read the file with the centroid info, and format it for the data
        #currently outputs a dict of {(organ1, organ2): distance} where organ1, organ2 are sorted alphaetically
        dist_df = self.read_spatial_file(pdist_file)
        dist_df = dist_df.reindex(OrganData.roi_cols + [OrganData.roi_dist_col],axis=1)
        dist_df = dist_df.dropna()
        subdf = dist_df.loc[:, OrganData.roi_cols]
        dist_df.loc[:,'organ1'] = subdf.apply(lambda x: sorted(x)[1], axis=1)
        dist_df.loc[:,'organ2'] = subdf.apply(lambda x: sorted(x)[0], axis=1)
        dist_df = dist_df.set_index(['organ1','organ2']).sort_index(kind='mergesort') #I just sort everthing alphabetically, may bug out otherwise idk
        dist_df = dist_df.loc[:,OrganData.roi_dist_col]
        return dist_df.reset_index()
    
    def process_dose_file(self, dose_file, default_value = np.nan):
        dose_df = self.read_spatial_file(dose_file)
        
        dose_df = dose_df.set_index(OrganData.centroid_roi_col).sort_index()
        organs = sorted(dose_df.index.values)
        dose_dict = {}
        for organ in organs:
            #filter out extra organs idk
            if ('GTV' not in organ) and organ not in self.organ_list:
                continue
            entry = {}
            def getfield(col):
                try:
                    return dose_df.loc[organ, col]
                except:
                    return default_value
            entry[OrganData.volume_col] = getfield(OrganData.volume_col)
            entry[OrganData.mean_dose_col] = getfield(OrganData.mean_dose_col)
            entry['centroids'] = np.array([getfield(v) for v in OrganData.centroid_cols])
            dose_dict[organ] = entry
        return dose_dict
    
    def process_distance_file(self,file, centroid_dict, default_value = np.nan):
        #reads a file, returns a df with organ1, organ2, distance (sorted)
        dist_df = self.format_patient_distances(file)
        rois = set(centroid_dict.keys())
        oars = sorted(set(self.organ_list).intersection(rois))
        gtvs = [r for r in rois if 'GTV' in r]
        
        merged_dict = {}
        organs = set(list(oars) + gtvs)
        #we want the entrys to be all valid organs or gtvs, but
        #the distance array to be in the shape of the predefined list
        for o1 in organs: 
            oentry = np.zeros((self.num_organs,)).astype(self.data_type)
            if(o1 not in organs):
                oentry = oentry.fill(default_value)
            else:
                for pos, o2 in enumerate(self.organ_list):
                    if o1 == o2:
                        continue
                    if o2 not in oars:
                        tdist = default_value
                    else:
                        match = dist_df[(dist_df.organ1 == o1) & (dist_df.organ2 == o2) | (dist_df.organ1 == o2) & (dist_df.organ2 == o1)]
                        if match.shape[0] > 0:
                            tdist = match[OrganData.roi_dist_col].values
                            assert(len(tdist) < 2)
                            tdist = tdist[0]
                        else:
                            tdist = default_value
                    oentry[pos] = tdist
            mdict_entry = centroid_dict[o1]
            mdict_entry['distances'] = oentry
            merged_dict[o1] = mdict_entry
        return merged_dict
    
    def format_gtvs(self, mdict):
        gtvs = [(k,v) for k,v in mdict.items() if 'GTV' in k]
        if len(gtvs) < 1:
            return mdict
        oars = rename_gtvs(gtvs)
        for oname, odata in mdict.items():
            if 'GTV' in oname:
                continue
            oars[oname] = odata
        return oars
    
    def process_patient(self, dist_file,dose_file):
        dose_dict= self.process_dose_file(dose_file)
        merged_dict = self.process_distance_file(dist_file, dose_dict)
        merged_dict= self.format_gtvs(merged_dict)
        return merged_dict
    
    def is_valid_patient(self,p_entry):
        #code for cleaning up patients that are just no good
        has_gtv = False
        for oar in p_entry.keys():
            if 'GTV' in oar:
                has_gtv = True
                return has_gtv #delete this line if I want more stuff here
            else:
                has_gtv = False
        return has_gtv
                
    def process_cohort_spatial_dict(self, spatial_files):
        patients = {}
        invalid_ids = []
        for pid, entry in spatial_files.items():
            try:
                p_entry = self.process_patient(entry['distances'], entry['doses'])
                if(self.is_valid_patient(p_entry)):
                    patients[pid] = p_entry
                else:
                    invalid_ids.append(pid)
            except Exception as e:
                print('error reading patient', pid)
                print(e)
        if len(invalid_ids) > 1:
            print("invalid patients", invalid_ids)
        return {'organs': self.organ_list, 'patients': patients}
    
def rename_gtvs(gtvlist):
    #rename gtvs for a single patient
    new_dict = {}
    sorted_entries = sorted(gtvlist, key = lambda x: -x[1].get(OrganData.volume_col,0))
    currname = 'GTVp'
    node_num = 0
    for (gtvname, gtv) in sorted_entries:
        #stuff to error check nan could go here
        try:
            volume = float(gtv.get(OrganData.volume_col,np.nan))
            temp_name = currname
            if(node_num > 1):
                temp_name = temp_name + str(node_num)
            new_dict[temp_name] = gtv
            if(currname == 'GTVp'):
                currname = 'GTVn'
            node_num += 1
        except Exception as e:
            print('error reading gtv', gtvname, gtv)
            print(e)
    return new_dict
    
def load_spatial_files(root = None):
    #reads in the files for tumor centroids and ROI-tumor distances
    #returns {'id': {'distances': <distfile>, 'doses': <centroid/dosefile>}}
    #currently only returns patients with both ids
    root = Const.camprt_dir if root is None else root
    
    try:
        distance_files = glob(Const.camprt_dir + '**/*distances.csv')
    except:
        distance_files = []
    try:
        dose_files = glob(Const.camprt_dir + '**/*centroid*.csv')
    except: 
        dose_files = []
        
    def file_id(file):
        return max([int(x) for x in findall("[0-9]+", file)])
    
    dose_dict = {file_id(f): f for f in dose_files}
    dist_dict = {file_id(f): f for f in distance_files}
    
    dose_ids = set(dose_dict.keys())
    dist_ids = set(dist_dict.keys())
    shared_ids = dose_ids.intersection(dist_ids)
    
    #print which patients didn't have matches
    dropped_ids = dose_ids.symmetric_difference(dist_ids)
    if(len(dropped_ids) > 0):
        print("missing doses", dose_ids - shared_ids)
        print("missing distances", dist_ids - shared_ids)
        
    file_dict = {sid: {'doses': dose_dict.get(sid), 'distances': dist_dict.get(sid)} for sid in shared_ids}
    return file_dict

def np_converter(obj):
    #converts stuff to vanilla python  for json since it gives an error with np.int64 and arrays
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.float):
        return round(float(obj),5)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, datetime.datetime):
        return obj.__str__()
    return obj
    
def np_dict_to_json(d,destination_file, nan_to_null = False):   
    try:
        with open(destination_file, 'w') as f:
            #nan_to_null makes it save it as null in the json instead of NaN
            #more useful when it's sent to a json but will be read back in python as None
            simplejson.dump(d,f,default = np_converter, ignore_nan = nan_to_null)
        return True
    except Exception as e:
        print(e)
        return False
    
def load_pdict(filepath = None):
    if filepath is None:
        filepath = Const.processed_organ_json
    with open(filepath) as f:
        pdict = simplejson.load(f)
    return pdict