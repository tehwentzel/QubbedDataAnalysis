import pandas as pd
import numpy as np
from Constants import Const
import simplejson
from re import findall, match, sub
import Utils
from glob import glob
from abc import ABC, abstractmethod
from Levenshtein import distance as levenshtein_distance
import collections
import re
import SpatialPreprocessing as spatial
import SymptomPreprocessing as symp

class SpellChecker():
    
    def __init__(self, keywords, aliases, max_edit_distance = .15,normalize_score = True):
        self.keywords = keywords #list
        self.keywordset = set(keywords)
        self.aliases = aliases #dict 
        self.normalize_score = normalize_score
        self.positional_pairs = [('Lt','Rt'),('L_','R_'),('_L','_R')]
        self.max_edit_distance = max_edit_distance
            
    def word_distance(self,word1,word2):
        dist = 0
        #add an extra penalty if one is right and one is left
        for (x,y) in self.positional_pairs:
            if x in word1 and y in word2 or y in word1 and x in word2:
                dist += len(word1)
                break
        clean = lambda w: w.strip().lower().replace("_","")
        dist += levenshtein_distance(clean(word1),clean(word2))
        if self.normalize_score:
            dist = dist/max(len(str(word1)),len(str(word2)))
        return dist
        
    def best_spell_match(self,name,words):
        #compare a word with a list of words
        #get the closest word to source word based on edit distance
        best_match = None
        best_dist = np.inf
        for word in words:
            ld = self.word_distance(name,word)
            if ld < best_dist:
                best_dist = ld
                best_match = word
                if ld <= 0:
                    break
        return best_match, best_dist
    
    def spellcheck_df(self, df, cols=None,unique = True):
        df = df.copy()
        rename_dict = {}
        if cols is None:
            cols = list(df.columns)
            
        all_renames = {}
        for col in cols:
            df[col] = df[col].apply(lambda x: self.aliases.get(x.lower(),x))
            in_col = np.unique(df[col].values.astype('str'))
            matchwords = [i for i in self.keywords if i not in in_col]
            col_words = [w for w in in_col if w not in self.keywordset]
            if len(col_words) < 1:
                break
            rename_dict = {}
            for cword in col_words:
                match,dist = self.best_spell_match(cword,matchwords)
                if dist < self.max_edit_distance:
                    if match != cword:
                        rename_dict[cword] = match
                        all_renames[cword] = match
                else:
                    aliasmatch, alias_dist = self.best_spell_match(cword, list(self.aliases.keys()))
                    if alias_dist < self.max_edit_distance:
                        target = self.aliases[aliasmatch]
                        rename_dict[cword] = target
                        all_renames[cword] = target
            df[col] = df[col].apply(lambda x: rename_dict.get(x,x))
        return df,all_renames
    
    
class MdasiOrganData():
       
    organ_rename_dict = {
        'cricoid': 'Cricoid_cartilage',
         'cricopharyngeus': 'Cricopharyngeal_Muscle',
         'esophagus_u': 'Esophagus',
         'oral_cavity': 'Extended_Oral_Cavity',
         'musc_geniogloss': 'Genioglossus_M',
         'hardpalate': 'Hard_Palate',
         'bone_hyoid': 'Hyoid_bone',
         'musc_constrict_i': 'IPC',
         'lips_lower': 'Lower_Lip',
         'lips_upper': 'Upper_Lip',
         'musc_constrict_m': 'MPC',
         'musc_mgh_complex': 'Mylogeniohyoid_M',
         'musc_mghcomplex': 'Mylogeniohyoid_M',
         'palate_soft': 'Soft_Palate',
         'musc_constrict_s': 'SPC',
         'spinalcord_cerv': 'Spinal_Cord',
         'larynx_sg': 'Supraglottic_Larynx',
         'cartlg_thyroid': 'Thyroid_cartilage',
         'brachial_plex_r': 'Rt_Brachial_Plexus',
         'brachial_plex_l': 'Lt_Brachial_Plexus',
         'pterygoid_lat_r': 'Rt_Lateral_Pterygoid_M',
         'pterygoid_lat_l': 'Lt_Lateral_Pterygoid_M',
         'musc_masseter_r': 'Rt_Masseter_M',
         'musc_masseter_l': 'Lt_Masseter_M',
         'bone_mastoid_r': 'Rt_Mastoid',
         'bone_mastoid_l': 'Lt_Mastoid',
         'pterygoid_med_r': 'Rt_Medial_Pterygoid_M',
         'pterygoid_med_l': 'Lt_Medial_Pterygoid_M',
         'parotid_r': 'Rt_Parotid_Gland',
         'parotid_l': 'Lt_Parotid_Gland',
         'musc_sclmast_r': 'Rt_Sternocleidomastoid_M',
         'musc_sclmast_l': 'Lt_Sternocleidomastoid_M',
         'glnd_submand_r': 'Rt_Submandibular_Gland',
         'glnd_submand_l': 'Lt_Submandibular_Gland',
         'musc_digastric_ra': 'Rt_Ant_Digastric_M',
         'musc_digastric_la': 'Lt_Ant_Digastric_M',
        'musc_digastric_rp': 'Rt_Post_Digastric_M',
         'musc_digastric_lp': 'Lt_Post_Digastric_M',
        'esophagus_u': 'Esophagus',
        'hardpalate':'Hard_Palate',
    }
    
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
        'mean': 'mean_dose',
        'minGy': 'min_dose',
        'maxGy': 'max_dose',
    }
    
    #header names for the files
    
    roi_cols = ['Reference ROI','Target ROI']
    roi_dist_col = 'Eucledian Distance (mm)'
    
    centroid_roi_col = 'roi'
    volume_col = 'volume'
    mean_dose_col = 'mean_dose'
    centroid_cols = ['x','y','z']
    
    default_dose_values = [
        'mean_dose','volume',
        'V5','V10','V15',
        'V20','V25',
        'V30','V35','V40',
        'V45','V50','V55',
        'V60','V65','V70',
        'V75','V80',
    ]
    
    def __init__(self, 
                 root = None,
                 organ_info_json = None,
                 data_type = np.float16,
                 spellcheck_organs = True,
                 mdasi_dvh_path = None,
                 require_gtv=True,
                ):
        if mdasi_dvh_path is None:
            mdasi_dvh_path = Const.data_dir + 'Cohort_SMART2_530pts_(486pts).xlsx'
        self.mdasi_dvh_path = mdasi_dvh_path
        self.require_gtv=require_gtv
        self.data_type = data_type
        self.root = Const.mdasi_centroid_dir if root is None else root
        self.organ_list = self.get_organ_list()
        self.num_organs = len(self.organ_list)
        #see if we run a spellcheck on the data
        #robust to typos, but slow
        self.spellcheck_organs = spellcheck_organs
        self.spellchecker =  SpellChecker(Const.organ_list, 
                          MdasiOrganData.organ_rename_dict)
        self.processed_df = None
        
    def load_spatial_files(self):
        spatial_files = spatial.load_spatial_files(root=self.root)
        #temp
#         spatial_files = {k:v for k,v in spatial_files.items() if k > 20 and k < 100}
        return spatial_files
        
    def get_organ_list(self, skip_gtv = True):
        return Const.organ_list
    
    def rename_gtvs(self,gtvlist):
        #rename gtvs for a single patient
        new_dict = {}
        sorted_entries = sorted(gtvlist, key = lambda x: -x[1].get(MdasiOrganData.volume_col,0))
        currname = 'GTVp'
        node_num = 0
        for (gtvname, gtv) in sorted_entries:
            #stuff to error check nan could go here
            try:
                volume = float(gtv.get(MdasiOrganData.volume_col,np.nan))
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

    def is_valid_patient(self,p_entry):
        #code for cleaning up patients that are just no good
        if not self.require_gtv:
            return True
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
    
    def process_cohort_spatial_dict(self, spatial_files):
        patients = {}
        invalid_ids = []
        for pid, entry in spatial_files.items():
            try:
                p_entry = self.process_patient(entry['distances'], entry['doses'])
                if(self.is_valid_patient(p_entry)):
                    patients[int(pid)] = p_entry
                else:
                    invalid_ids.append(pid)
            except Exception as e:
                print('error reading patient', pid)
                print(e)
        if len(invalid_ids) > 1:
            print("invalid patients", invalid_ids)
        return patients
#         return {'organs': self.organ_list, 'patients': patients}
    
    def process_patient(self, dist_file,dose_file):
        dose_dict= self.process_dose_file(dose_file)
        merged_dict = self.process_distance_file(dist_file, dose_dict)
        merged_dict= self.format_gtvs(merged_dict)
        return merged_dict
    
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
            organ_dist_df,renames = self.spellchecker.spellcheck_df(organ_dist_df,
                                                            cols=cols_to_check)
            if len(renames) > 0:
                print('renames',renames)
        return organ_dist_df#.replace(self.oar_rename_dict())
    
    def reconcile_cohort_columns(self, organ_df):
        #placeholder
        organ_df = organ_df.rename(MdasiOrganData.file_header_renames,axis=1)
        return organ_df
    
    def read_spatial_file(self, file):
        df = pd.read_csv(file)
        df = self.reconcile_cohort_columns(df)
        df = self.reconcile_organ_names(df)
        return df
    
    
    def format_gtvs(self, mdict):
        gtvs = [(k,v) for k,v in mdict.items() if 'GTV' in k]
        if len(gtvs) < 1:
            return mdict
        oars = self.rename_gtvs(gtvs)
        for oname, odata in mdict.items():
            if 'GTV' in oname:
                continue
            oars[oname] = odata
        return oars
    
    def process_dose_file(self, dose_file, 
                          default_value = np.nan):
        dose_df = self.read_spatial_file(dose_file)
        dose_df = dose_df.set_index(MdasiOrganData.centroid_roi_col).sort_index()
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
            entry['centroids'] = np.array([getfield(v) for v in MdasiOrganData.centroid_cols])
            dose_dict[organ] = entry
        return dose_dict
    
    def format_patient_distances(self, pdist_file):
        #read the file with the centroid info, and format it for the data
        #currently outputs a dict of {(organ1, organ2): distance} where organ1, organ2 are sorted alphaetically
        dist_df = self.read_spatial_file(pdist_file)
        dist_df = dist_df.reindex(MdasiOrganData.roi_cols + [MdasiOrganData.roi_dist_col],axis=1)
        dist_df = dist_df.dropna()
        subdf = dist_df.loc[:, MdasiOrganData.roi_cols]
        dist_df.loc[:,'organ1'] = subdf.apply(lambda x: sorted(x)[1], axis=1)
        dist_df.loc[:,'organ2'] = subdf.apply(lambda x: sorted(x)[0], axis=1)
        dist_df = dist_df.set_index(['organ1','organ2']).sort_index(kind='mergesort') #I just sort everthing alphabetically, may bug out otherwise idk
        dist_df = dist_df.loc[:,MdasiOrganData.roi_dist_col]
        return dist_df.reset_index()
    
    def process_distance_file(self, file, centroid_dict, default_value = np.nan):
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
                            tdist = match[MdasiOrganData.roi_dist_col].values
                            assert(len(tdist) < 2)
                            tdist = tdist[0]
                        else:
                            tdist = default_value
                    oentry[pos] = tdist
            mdict_entry = centroid_dict[o1]
            mdict_entry['distances'] = oentry
            merged_dict[o1] = mdict_entry
        return merged_dict
    
    def filter_valid_patients(self,df):
        return df[~df.id.isnull()]
    
    def clean_dvh_df(self, df, organ_rename_dict = None):
        df = df.rename(MdasiOrganData.file_header_renames,axis=1)
        df = df[df.DicomType == "ORGAN"]
        
        #this maps words to words in the rename dict
        #somewhat weird because it can inverse the order but it re-fixes itself?
        #don't know how else to prevent bugs
        print('spellchecking...')
        spellchecked_df, _= self.spellchecker.spellcheck_df(df,['Structure'])
        print('renaming things')
        df['ROI'] = spellchecked_df['Structure']
        df = df.drop(["DicomType"],axis=1)
        df = df.reset_index()
        df = df[df.ROI.isin(self.organ_list)] #only keep organs we car about
        df = df.drop_duplicates(subset=['id','ROI','volume'])
        df = df[df.mean_dose != 'error'] #idk what this is from
        for col in df.columns:
            if 'dose' in col.lower() or 'volume' in col.lower():
                df[col] = df[col].astype(float)
        print('filtering pateints')
        df = self.filter_valid_patients(df.reset_index()) 
#         print('adding nan values for missing organs')
#         df = self.add_missing_organs(df) 
        print('adding histograms')
        hist_cols = [c for c in df.columns if (re.match('[DV]\d+',c) is not None)]
        df[hist_cols] = df[hist_cols].astype('float16')
        if 'index' in df.columns:
            df = df.drop(['index'],axis=1)
        return df
    
    def add_patient_organs(self,pid,patient_df):
        pdf = patient_df.copy()
        rois = np.unique(patient_df.ROI.values)
        for organ in self.organ_list:
            if organ not in rois:
                entry = pd.Series([pid,'missing',organ],index=['id','Structure','ROI'])
                pdf = pdf.append(entry,ignore_index=True)
        return pdf
    
    def add_missing_organs(self,df):
        dfs = []
        for pid,subdf in df.groupby('id'):
            subdf = self.add_patient_organs(pid,subdf).set_index("ROI")
            subdf = subdf.loc[self.organ_list]
            subdf = subdf.reset_index()
            dfs.append(subdf)
        return pd.concat(dfs)
    
    def load_mdasi_doses(self,path=None):
        if path is None:
            path = self.mdasi_dvh_path
        if 'xlsx' in path:
            dvh_df = pd.read_excel(path,index_col=0)
        else: 
            dvh_df = pd.read_csv(path,index_col=0)
        return self.clean_dvh_df(dvh_df)
    
    def get_defaults(self, df,cols=None,default_value = np.nan):
        if cols is None:
            cols = list(df.columns)
        defaults = {}
        for col in cols:
            entry = df[col].values[0]
            if Utils.iterable(entry):
                d = [np.nan for i in entry]
            else:
                d = np.nan
            if type(entry) == np.ndarray:
                d = np.array(d)
            defaults[col] = d
        return defaults
    
    def add_doses(self,pdict,
                  dose_values=None,
                  drop_missing=False):
        ddf = self.load_mdasi_doses()
        if dose_values is None:
            dose_values = MdasiOrganData.default_dose_values
        ddf = ddf[dose_values+['id','ROI','Structure']]
        pdict2 = {k:v for k,v in pdict.items()}
        to_copy = [c for c in ddf.columns if c not in ['ROI',"Structure",'id']]
        defaults = self.get_defaults(ddf,cols=to_copy)
        bad_pids = set([])
        for pid,odata in pdict.items():
            subddf = ddf[ddf.id.astype(int) == int(pid)]
            for oname, oentry in odata.items():
                if 'GTV' in oname:
                    continue
                match = subddf[subddf.ROI.apply(lambda x: x.lower()) == oname.lower()]
            
                if match.shape[0] > 0:
                    vals = match[to_copy].to_dict(orient='records')[0]
                else:
                    if 'GTV' not in oname:
                        bad_pids.add(pid)
                    vals = {k:v for k,v in defaults.items()}
                for k,v in vals.items():
                    oentry[k] = v
        if drop_missing:
            pdict2 = {k:v for k,v in pdict2.items() if k not in bad_pids}
        return pdict2
    
    def add_symptoms(self,pdict,to_drop=None):
        symp_df = symp.load_mdasi()
        symp_df = symp.impute_and_group(symp_df)
        if to_drop is None:
            to_drop = [c for c in symp_df.columns if 'symptomdomain' in c or 'symptomgroup' in c or '_original' in c]
        symp_df = symp_df.drop(to_drop,axis=1)
        good_ids = set([])
        good_patients= []
        for pid,subdf in symp_df.groupby('id'):
            match = pdict.get(int(pid),None)
            if subdf.shape[0] > 1:
                print('muliple entries',pid,subdf.shape[0])
            if match is None:
                continue
            else:
                sentry = subdf.to_dict(orient='records')[0]
                for k,v in match.items():
                    sentry[k] = v
            good_patients.append(sentry)
            good_ids.add(pid)
        missing = [k for k in pdict.keys() if k not in good_ids]
        return {e['id']: e for e in good_patients}
    
    def center_centroid_df(self,df=None):
        #should subtract center of all centroids from dataframe
        if df is None:
            df = self.process(as_df=True).copy()
        centroid_cols = [c for c in df.columns if 'centroids' in c]
        for col in centroid_cols:
            df[col] = df[col].apply(lambda x: np.array(x) if Utils.iterable(x) else np.array([np.NaN,np.NaN,np.NaN]))
        #only look at non-tumor organs to calculate center of point cloud
        ocentroids = [c for c in centroid_cols if 'GTV' not in c]
        #n patients x n_organs # 3
        array = np.stack(df[ocentroids].apply(lambda x: np.stack(x),axis=1).values)
        #n-patients x 3 to get center of all points
        mean_vals = np.nanmean(array,axis=1)
        for i,col in enumerate(centroid_cols):
            df[col] = list(np.stack(df[col].values).reshape(-1,3) - mean_vals)
        return df
    
    def process(self,
                add_doses=True,
                drop_missing_doses=False,
                add_symptoms=True,
                as_df=True,
                use_cache=True,
               ):
        if as_df and self.processed_df is not None and use_cache:
            return self.processed_df
        files = self.load_spatial_files()
        pdict = self.process_cohort_spatial_dict(files)
        if add_doses:
            #this one uses nan when missing if drop_missing=False
            pdict = self.add_doses(pdict,drop_missing=drop_missing_doses)
        if add_symptoms:
            #this one does an inner join basically because I'm lazy
            pdict = self.add_symptoms(pdict)
        if as_df:
            new_pdict = []
            for k,v in pdict.items():
                new_entry = {}
                for kk,vv in v.items():
                    if type(vv)==type({}):
                        for kkk,vvv in vv.items():
                            name = kk+'_'+kkk
                            new_entry[name] = vvv
                    else:
                        new_entry[kk]=vv
                new_pdict.append(new_entry)
            pdict = pd.DataFrame(new_pdict)
            pdict = self.center_centroid_df(pdict)
            self.processed_df=pdict
        return pdict
    
 class CamprtOrganData():
       
    organ_rename_dict = {}
    
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
        'mean': 'mean_dose',
        'minGy': 'min_dose',
        'maxGy': 'max_dose',
    }
    
    #header names for the files
    
    roi_cols = ['Reference ROI','Target ROI']
    roi_dist_col = 'Eucledian Distance (mm)'
    
    centroid_roi_col = 'roi'
    volume_col = 'volume'
    mean_dose_col = 'mean_dose'
    centroid_cols = ['x','y','z']
    
    default_dose_values = [
        'mean_dose','volume',
        'V5','V10','V15',
        'V20','V25',
        'V30','V35','V40',
        'V45','V50','V55',
        'V60','V65','V70',
        'V75','V80',
    ]
    
    def __init__(self, 
                 root = None,
                 organ_info_json = None,
                 data_type = np.float16,
                 spellcheck_organs = True,
                 mdasi_dvh_path = None,
                 require_gtv=True,
                ):
        if mdasi_dvh_path is None:
            mdasi_dvh_path = Const.data_dir + 'Cohort_SMART2_530pts_(486pts).xlsx'
        self.mdasi_dvh_path = mdasi_dvh_path
        self.require_gtv=require_gtv
        self.data_type = data_type
        self.root = Const.mdasi_centroid_dir if root is None else root
        self.organ_list = self.get_organ_list()
        self.num_organs = len(self.organ_list)
        #see if we run a spellcheck on the data
        #robust to typos, but slow
        self.spellcheck_organs = spellcheck_organs
        self.spellchecker =  SpellChecker(Const.organ_list, 
                          MdasiOrganData.organ_rename_dict)
        self.processed_df = None
        
    def load_spatial_files(self):
        spatial_files = spatial.load_spatial_files(root=self.root)
        #temp
#         spatial_files = {k:v for k,v in spatial_files.items() if k > 20 and k < 100}
        return spatial_files
    
    def rename_gtvs(self,gtvlist):
        #rename gtvs for a single patient
        new_dict = {}
        sorted_entries = sorted(gtvlist, key = lambda x: -x[1].get(MdasiOrganData.volume_col,0))
        currname = 'GTVp'
        node_num = 0
        for (gtvname, gtv) in sorted_entries:
            #stuff to error check nan could go here
            try:
                volume = float(gtv.get(MdasiOrganData.volume_col,np.nan))
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

    def process_cohort_spatial_dict(self, spatial_files):
        patients = {}
        invalid_ids = []
        for pid, entry in spatial_files.items():
            try:
                p_entry = self.process_patient(entry['distances'], entry['doses'])
                if(self.is_valid_patient(p_entry)):
                    patients[int(pid)] = p_entry
                else:
                    invalid_ids.append(pid)
            except Exception as e:
                print('error reading patient', pid)
                print(e)
        if len(invalid_ids) > 1:
            print("invalid patients", invalid_ids)
        return patients
#         return {'organs': self.organ_list, 'patients': patients}
    
    def process_patient(self, dist_file,dose_file):
        dose_dict= self.process_dose_file(dose_file)
        merged_dict = self.process_distance_file(dist_file, dose_dict)
        merged_dict= self.format_gtvs(merged_dict)
        return merged_dict
    
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
            organ_dist_df,renames = self.spellchecker.spellcheck_df(organ_dist_df,
                                                            cols=cols_to_check)
            if len(renames) > 0:
                print('renames',renames)
        return organ_dist_df#.replace(self.oar_rename_dict())
    
    def reconcile_cohort_columns(self, organ_df):
        #placeholder
        organ_df = organ_df.rename(MdasiOrganData.file_header_renames,axis=1)
        return organ_df
    
    def read_spatial_file(self, file):
        df = pd.read_csv(file)
        df = self.reconcile_cohort_columns(df)
        df = self.reconcile_organ_names(df)
        return df
    
    def process_dose_file(self, dose_file, 
                          default_value = np.nan):
        dose_df = self.read_spatial_file(dose_file)
        dose_df = dose_df.set_index(MdasiOrganData.centroid_roi_col).sort_index()
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
            entry['centroids'] = np.array([getfield(v) for v in MdasiOrganData.centroid_cols])
            dose_dict[organ] = entry
        return dose_dict
    
    def format_patient_distances(self, pdist_file):
        #read the file with the centroid info, and format it for the data
        #currently outputs a dict of {(organ1, organ2): distance} where organ1, organ2 are sorted alphaetically
        dist_df = self.read_spatial_file(pdist_file)
        dist_df = dist_df.reindex(MdasiOrganData.roi_cols + [MdasiOrganData.roi_dist_col],axis=1)
        dist_df = dist_df.dropna()
        subdf = dist_df.loc[:, MdasiOrganData.roi_cols]
        dist_df.loc[:,'organ1'] = subdf.apply(lambda x: sorted(x)[1], axis=1)
        dist_df.loc[:,'organ2'] = subdf.apply(lambda x: sorted(x)[0], axis=1)
        dist_df = dist_df.set_index(['organ1','organ2']).sort_index(kind='mergesort') #I just sort everthing alphabetically, may bug out otherwise idk
        dist_df = dist_df.loc[:,MdasiOrganData.roi_dist_col]
        return dist_df.reset_index()
    
    def process_distance_file(self, file, centroid_dict, default_value = np.nan):
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
                            tdist = match[MdasiOrganData.roi_dist_col].values
                            assert(len(tdist) < 2)
                            tdist = tdist[0]
                        else:
                            tdist = default_value
                    oentry[pos] = tdist
            mdict_entry = centroid_dict[o1]
            mdict_entry['distances'] = oentry
            merged_dict[o1] = mdict_entry
        return merged_dict
    
    def filter_valid_patients(self,df):
        return df[~df.id.isnull()]
    
    def clean_dvh_df(self, df, organ_rename_dict = None):
        df = df.rename(MdasiOrganData.file_header_renames,axis=1)
        df = df[df.DicomType == "ORGAN"]
        
        #this maps words to words in the rename dict
        #somewhat weird because it can inverse the order but it re-fixes itself?
        #don't know how else to prevent bugs
        print('spellchecking...')
        spellchecked_df, _= self.spellchecker.spellcheck_df(df,['Structure'])
        print('renaming things')
        df['ROI'] = spellchecked_df['Structure']
        df = df.drop(["DicomType"],axis=1)
        df = df.reset_index()
        df = df[df.ROI.isin(self.organ_list)] #only keep organs we car about
        df = df.drop_duplicates(subset=['id','ROI','volume'])
        df = df[df.mean_dose != 'error'] #idk what this is from
        for col in df.columns:
            if 'dose' in col.lower() or 'volume' in col.lower():
                df[col] = df[col].astype(float)
        print('filtering pateints')
        df = self.filter_valid_patients(df.reset_index()) 
#         print('adding nan values for missing organs')
#         df = self.add_missing_organs(df) 
        print('adding histograms')
        hist_cols = [c for c in df.columns if (re.match('[DV]\d+',c) is not None)]
        df[hist_cols] = df[hist_cols].astype('float16')
        if 'index' in df.columns:
            df = df.drop(['index'],axis=1)
        return df
    
    def add_patient_organs(self,pid,patient_df):
        pdf = patient_df.copy()
        rois = np.unique(patient_df.ROI.values)
        for organ in self.organ_list:
            if organ not in rois:
                entry = pd.Series([pid,'missing',organ],index=['id','Structure','ROI'])
                pdf = pdf.append(entry,ignore_index=True)
        return pdf
    
    def add_missing_organs(self,df):
        dfs = []
        for pid,subdf in df.groupby('id'):
            subdf = self.add_patient_organs(pid,subdf).set_index("ROI")
            subdf = subdf.loc[self.organ_list]
            subdf = subdf.reset_index()
            dfs.append(subdf)
        return pd.concat(dfs)
    
    def get_defaults(self, df,cols=None,default_value = np.nan):
        if cols is None:
            cols = list(df.columns)
        defaults = {}
        for col in cols:
            entry = df[col].values[0]
            if Utils.iterable(entry):
                d = [np.nan for i in entry]
            else:
                d = np.nan
            if type(entry) == np.ndarray:
                d = np.array(d)
            defaults[col] = d
        return defaults
    
    
    def process(self,
                add_doses=True,
                drop_missing_doses=False,
                as_df=True,
                use_cache=True,
               ):
        if as_df and self.processed_df is not None and use_cache:
            return self.processed_df
        files = self.load_spatial_files()
        pdict = self.process_cohort_spatial_dict(files)
        if add_doses:
            #this one uses nan when missing if drop_missing=False
            pdict = self.add_doses(pdict,drop_missing=drop_missing_doses)
        if as_df:
            new_pdict = []
            for k,v in pdict.items():
                new_entry = {}
                for kk,vv in v.items():
                    if type(vv)==type({}):
                        for kkk,vvv in vv.items():
                            name = kk+'_'+kkk
                            new_entry[name] = vvv
                    else:
                        new_entry[kk]=vv
                new_pdict.append(new_entry)
            pdict = pd.DataFrame(new_pdict)
            pdict = self.center_centroid_df(pdict)
            self.processed_df=pdict
        return pdict