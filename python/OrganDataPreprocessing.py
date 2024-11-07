from Levenshtein import distance as levenshtein_distance
import pandas as pd
import numpy as np
import re
import simplejson
from abc import ABC,abstractmethod
from Constants import Const
import Utils

class OrganData(ABC):
    
    #probably depricated
    additional_renames = {
        'Lt_Ant_Digastric_M': 'Musc_Digastric_LA',
        'Rt_Ant_Digastric_M': 'Musc_Digastric_RA',
    }
    
    #should map columns to the ones in the lists below
    #these are alo used for spellchecking
    file_header_renames = {
        'x coordinate': 'x',
        'y coordinate': 'y',
        'z coordinate': 'z',
        'ROI': 'roi',
        'Structure Volume': 'volume',
        'Volume': 'volume',
        'Min Value': 'min_dose',
        'Max Value': 'max_dose',
        'Max': 'max_dose',
        'Min': 'min_dose',
        'Mean': 'mean_dose',
        'Mean Value': 'mean_dose',
        'Mean doses': 'mean_dose',
        'Minimum': 'min_dose',
        'Maximum': 'max_dose',
    }
    
    #header names for the files
    
    roi_cols = ['Reference ROI','Target ROI']
    roi_dist_col = 'Eucledian Distance (mm)'
    
    centroid_roi_col = 'roi'
    volume_col = 'volume'
    mean_dose_col = 'mean_dose'
    centroid_cols = ['x','y','z']
    
    def __init__(self, 
                 organ_info_json = None,
                 data_type = np.float16,
                 spellcheck_columns = True,
                 spellcheck_organs = True
                ):
        self.data_type = data_type
        
        self.organ_list = self.get_organ_list()
        self.num_organs = len(self.organ_list)
        #see if we run a spellcheck on the data
        #robust to typos, but slow
        self.spellcheck_columns = spellcheck_columns
        self.spellcheck_organs = spellcheck_organs
        
    def get_organ_list(self, skip_gtv = True):
        return Const.organ_list
    
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
    
    def best_spell_match(self,name,words):
        #compare a word with a list of words
        #get the closest word to source word based on edit distance
        best_match = None
        best_dist = np.inf
        ldist = lambda x,y: levenshtein_distance(x.strip().lower(),y.strip.lower())
        for word in words:
            #Lt and Rt changes keep getting weird
            if 'Lt' in name and 'Rt' in word or 'Rt' in name and 'Lt' in word:
                continue
            ld = levenshtein_distance(name,word)
            if ld < best_dist:
                best_dist = ld
                best_match = word
                if ld <= 0:
                    break
        return best_match, best_dist
    
    def spellcheck_cols(self, df, words,edit_distance = 3,print_out=False):
        #changes the names of columns that are probably misspelling of the one's we're
        #supposed to have (given by words)
        if not Utils.iterable(words):
            words = [words]
        words = list(words)
        cols = list(df.columns)
        rename_dict = {}
#         for word in words:
#             match, dist = self.best_spell_match(word, cols)
#             if dist < edit_distance:
#                 cols.remove(match)
#                 if dist > 0:
#                     rename_dict[match] = word
        for col in cols:
            match, dist = self.best_spell_match(col,words)
            if dist < edit_distance:
                words.remove(match)
                if col != match:
                    rename_dict[col] = match
        if print_out and len(rename_dict) > 0:
            print('rename cols',rename_dict)
        return df.rename(rename_dict,axis=1)
    
    def spellcheck_rows(self, df, rows, words,edit_distance=3,print_out=False):
        #based on testing, edit distances > 3 makes similar organs get messed up
        #(becuase sometimes Lt_<organ> is missing but Rt_<organ> isn't or something
        if not Utils.iterable(words):
            words = [words]
        words = list(words)
        row_words = df.loc[:,rows].values.astype('str').ravel().tolist()
        rename_dict = {}
#         for word in words:
#             match,dist = self.best_spell_match(word,row_words)
#             if dist < edit_distance:
#                 row_words.remove(match)
#                 if dist > 0:
#                     rename_dict[match] = word
        for rword in row_words:
            match,dist = self.best_spell_match(rword,words)
            if dist < edit_distance:
                words.remove(match)
                if rword != match:
                    rename_dict[rword] = match
        df = df.rename(rename_dict)
        if print_out and len(rename_dict) > 0:
            skipprint = set(OrganData.file_header_renames.keys())
            pdict = {k:v for k,v in rename_dict.items() if k not in skipprint}
            print('renamed organs',pdict)
        return df

    
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
    
    @abstractmethod
    def read_spatial_file(self, file):
        pass
   

    @abstractmethod
    def process_distance_file(self,file, centroid_dict, default_value = np.nan):
        pass
    
    @abstractmethod
    def process_dose_file(self, dose_file, default_value = np.nan):
        pass
    
class CamprtOrganData(OrganData):
    
    def reconcile_organ_names(self, organ_dist_df, columns = None):
        #basically tries to standardize organ names accross datasets
        if type(columns) != type(None):
            organ_dist_df = organ_dist_df[columns]
        #check that this works idk
        organ_dist_df.replace(to_replace = r'_*GTV.*N', value = '_GTVn', regex = True, inplace = True)
        #check organs if we're looking at at a centroid file
        if self.spellcheck_organs:
            cols_to_check = self.roi_cols
            if self.centroid_roi_col in organ_dist_df.columns:
                cols_to_check = [self.centroid_roi_col]
            organ_dist_df = self.spellcheck_rows(organ_dist_df,
                                                 cols_to_check,
                                                 self.get_organ_list(),
                                                 print_out=True
                                                )
        return organ_dist_df#.replace(self.oar_rename_dict())
    
    def reconcile_cohort_columns(self, organ_df):
        #placeholder
        if self.spellcheck_columns:
            organ_df = self.spellcheck_cols(organ_df, 
                                            OrganData.file_header_renames.keys(),
                                           print_out = True)
        organ_df = organ_df.rename(OrganData.file_header_renames,axis=1)
        organ_df = self.spellcheck_cols(organ_df,
                                       OrganData.file_header_renames.values(),
                                       print_out = True)
        return organ_df
    
    def read_spatial_file(self, file):
        df = pd.read_csv(file)
        df = self.reconcile_cohort_columns(df)
        df = self.reconcile_organ_names(df)
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
    
class MdasiOrganData(OrganData):
    
    def reconcile_organ_names(self, organ_dist_df, columns = None):
        #basically tries to standardize organ names accross datasets
        if type(columns) != type(None):
            organ_dist_df = organ_dist_df[columns]
        #check that this works idk
        organ_dist_df.replace(to_replace = r'_*GTV.*N', value = '_GTVn', regex = True, inplace = True)
        #check organs if we're looking at at a centroid file
        if self.spellcheck_organs:
            cols_to_check = self.roi_cols
            if self.centroid_roi_col in organ_dist_df.columns:
                cols_to_check = [self.centroid_roi_col]
            organ_dist_df = self.spellcheck_rows(organ_dist_df,
                                                 cols_to_check,
                                                 self.get_organ_list(),
                                                 print_out=True
                                                )
        return organ_dist_df#.replace(self.oar_rename_dict())
    
    def reconcile_cohort_columns(self, organ_df):
        #placeholder
        if self.spellcheck_columns:
            organ_df = self.spellcheck_cols(organ_df, 
                                            OrganData.file_header_renames.keys(),
                                           print_out = True)
        organ_df = organ_df.rename(OrganData.file_header_renames,axis=1)
        organ_df = self.spellcheck_cols(organ_df,
                                       OrganData.file_header_renames.values(),
                                       print_out = True)
        return organ_df
    
    def read_spatial_file(self, file):
        df = pd.read_csv(file)
        df = self.reconcile_cohort_columns(df)
        df = self.reconcile_organ_names(df)
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
        distance_files = glob(root + '**/*distances.csv')
    except:
        distance_files = []
    try:
        dose_files = glob(root + '**/*centroid*.csv')
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
    
def load_pdict(filepath = None):
    if filepath is None:
        filepath = Const.processed_organ_json
    with open(filepath) as f:
        pdict = simplejson.load(f)
    return pdict