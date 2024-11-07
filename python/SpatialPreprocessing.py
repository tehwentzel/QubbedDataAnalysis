import pandas as pd
import numpy as np
from Constants import Const
import Utils
from abc import ABC, abstractmethod
from Spellchecker import SpellChecker
import re

    
class RadDataset():
    
    #to keep it all consistent with the other dataset
    file_header_renames = {
        'mean': 'mean_dose',
        'Volume': 'volume',
        'minGy': 'min_dose',
        'maxGy': 'max_dose',
#         'Structure': 'ROI'
    }
    
    # alliases for all the organs in the data because people just make up the abreviations
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
#          'lens_r': 'Rt_Anterior_Seg_Eyeball',
#          'lens_l': 'Lt_Anterior_Seg_Eyeball',
#          'brac_plx_l': 'Lt_Brachial_Plexus',
#          'brac_plx_r': 'Rt_Brachial_Plexus',
#          'brachialplex_l': 'Lt_Brachial_Plexus',
#          'brachialplex_r': 'Rt_Brachial_Plexus',
#          'l_parotid': 'Lt_Parotid_Gland',
#          'lparotid': 'Lt_Parotid_Gland',
#          'rparotid': 'Rt_Parotid_Gland',
#          'r_parotid': 'Rt_Parotid_Gland',
#          'eye_r': 'Rt_Posterior_Seg_Eyeball',
#          'eye_l': 'Lt_Posterior_Seg_Eyeball',
#          'inferior_pharyngeal_constrictor': 'IPC',
#          'inferior_constrictor': 'IPC',
#          'inferior_constrictor_muscle': 'IPC',
#          'superior_pharyngeal_constrictor': 'IPC',
#          'superior_constrictor_muscle': 'SPC',
#          'superior_constrictor': 'SPC',
#          'larynx_roi': 'Larynx',
#          'glottis': 'Glottic_Area',
#          'cricopharyngeus_muscle': 'Cricopharyngeal_Muscle',
#          'cavity_oral': 'Extended_Oral_Cavity'
    }
    
    def __init__(self, path = None, organ_list = None,max_missing_ratio = .5,print_out=False):
        if path  is None:
            path = Const.data_dir + 'Cohort_SMART2_530pts_(486pts).xlsx'
        if 'xlsx' in path:
            dvh_df = pd.read_excel(path,index_col=0)
        else: 
            dvh_df = pd.read_csv(path,index_col=0)
        if organ_list is None:
            self.organ_list = Const.organ_list
        self.print_out = print_out
        self.max_missing = int(len(self.organ_list)*max_missing_ratio)
        self.dropped_organ_names = set([])
        self.spellchecker =  SpellChecker(Const.organ_list, 
                          RadDataset.organ_rename_dict)
        
        self.dvh_df = self.clean_dvh_df(dvh_df)
        self.all_patient_ids = sorted(self.dvh_df.id.values)

    def clean_dvh_df(self, df, organ_rename_dict = None):
        df = df.rename(RadDataset.file_header_renames,axis=1)
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
        print('adding nan values for missing organs')
        df = self.add_missing_organs(df) 
        print('adding histograms')
        hist_cols = [c for c in df.columns if (re.match(r'[DV]\d+',c) is not None)]
        df[hist_cols] = df[hist_cols].astype('float16')
        return df.drop(['index'],axis=1)
            
    def add_patient_organs(self,pid,patient_df):
        pdf = patient_df.copy()
        rois = np.unique(patient_df.ROI.values)
        for organ in self.organ_list:
            if organ not in rois:
                entry = pd.Series([pid,'missing',organ],index=['id','Structure','ROI'])
                pdf = pd.concat([pdf,entry],ignore_index=True)
        return pdf
    
    def add_missing_organs(self,df):
        dfs = []
        for pid,subdf in df.groupby('id'):
            subdf = self.add_patient_organs(pid,subdf).set_index("ROI")
            subdf = subdf.loc[self.organ_list]
            subdf = subdf.reset_index()
            dfs.append(subdf)
        return pd.concat(dfs)
            
    def filter_valid_patients(self,df):
        dfs = []
        flag = True
        for pid,subdf in df.groupby('id'):
            has_gtv = subdf.ROI.apply(lambda x: 'gtv' in x.lower())
            flag = flag & (has_gtv.sum() >= 0)
            
            rois = set(np.unique(subdf.ROI))
            n_rois = len(rois)
            n_missing = n_rois - len(self.organ_list)
            if self.print_out:
                if n_missing != 0:
                    print('patient ', pid, 'has', n_missing,'organs off')
            if n_rois != subdf.shape[0]:
                print('patient',pid,'has duplicate organs?')
                print(subdf[subdf.duplicated(subset=['ROI'],keep=False)].loc[:,['ROI','Structure']])
            
            flag = flag & (n_missing < self.max_missing)
            if flag:
                dfs.append(subdf)
        return pd.concat(dfs)

    def filter_dvh_organs(self,dvh_df = None):
        if dvh_df is None:
            dvh_df = self.dvh_df
        valid_organs = set([o.lower() for o in self.organ_list])
        valid = dvh_df.ROI.apply(lambda x: x.lower() in valid_organs)
        dvh_df = dvh_df[valid]
        return dvh_df
    
    def get_dvh_columns(self,key,steps=None):
        good_cols = []
        dvh=self.dvh_df
        for c in dvh.columns:
            match = re.match(key+r'(\d+)', c)
            if match is not None:
                use = True
                if steps is not None and match.group(1) is not None:
                    value = int(match.group(1))
                    if value not in steps:
                        use = False
                if use:
                    good_cols.append(match.group(0))
        keys = sorted(good_cols, key = get_dvhcol_pos)
        pos = [get_dvhcol_pos(x) for x in good_cols]
        return keys, pos
    
    def get_dvh_array(self, key = 'D',dose_points = None, organ_list = None,max_missing=None):
        #uses the cvh dataframe and key to return a 3d array of dvh values
        #pos is the array of values from the keys (e.g. V5 V10 ... => [5,10,...])
        #so we can do clustering or something idk
        keys, pos = self.get_dvh_columns(key,steps=dose_points)
        array = []
        if max_missing is not None:
            df = self.get_clean_dvh_df(max_missing=False)
        else:
            df = self.dvh_df
        for pid, subdf in df.groupby('id'):
            if organ_list is None:
                organ_list = list(subdf.ROI.values)
                assert(len(organ_list) == len(set(organ_list)))
            subdf = subdf.set_index('ROI').loc[organ_list,keys]
            array.append(subdf.values)
        array = np.stack(array)
        print(np.isnan(array).sum())
        return array, pos
    
    def get_clean_dvh_df(self,max_missing = 0,print_out = False):
        clean_ids = set()
        df = rds.dvh_df
        for pid, subdf in df.groupby('id'):
            n_missing = np.isnan(subdf.mean_dose).sum()
            if print_out:
                print(pid, subdf[np.isnan(subdf.mean_dose)].loc[:,['ROI','Structure']].values.tolist())
                print()
            if n_missing <= max_missing:
                clean_ids.add(pid)
        clean_df= df[df.id.isin(clean_ids)]
        if self.print_out:
            print(len(df.id.unique()) - len(clean_ids),'ids removed out of ', len(df.id.unique()))
        clean_df = clean_df.sort_values(['id','ROI'],kind='mergesort')
        return clean_df
    
    def get_value_array(self,cols,
                        organ_list = None,
                        max_missing=None,input_median=True, rows='patients',keep_2d=True,as_df=False):
        #returns a value array, with rows=patients, it will roll up the organs for a paeitn
        #keep_d2 set to false will return a 3d matrix where the second dimension is the organs in same order as organ list
        #as_df needs to be 2d, will include headers and ID
        #cols is the value arrays to inclue from
        if organ_list is None:
            organ_list = self.organ_list[:]
        if max_missing is not None:
            df = self.get_clean_dvh_df(max_missing=1000000000)
        else:
            df = self.dvh_df
        if 'Structure' in cols or 'ROI' in cols:
            cols = list(set(cols) - set(['Structure','ROI']))
        try:
            subdf = df[cols].astype(float)
            subdf['id'] = df.id
            subdf['ROI'] = df['ROI']
        except Exception as e:
            print('error getting values as floats')
            print(e)
        if keep_2d == False and as_df == True:
            print('error, cant had 3d dataframe, assuming you just want a 2d dataframe')
            keep_2d= True
        if input_median:
            for col in cols:
                nanvals = np.isnan(subdf[col])
                subdf.loc[nanvals,col] = subdf[~nanvals][col].median()
        if rows== 'organs':
            if as_df:
                return subdf
            else:
                return subdf.drop(['id','ROI'],axis=1).values
        else:
            assert(rows=='patients')
            values = []
            pids = sorted(subdf.id.unique())
            colnames =[]
            for roi in subdf.ROI.unique():
                for c in subdf.columns:
                    if c != 'id' and c != 'ROI':
                        colnames.append(roi + '_' + c)
            for pid in pids:
                pdf = subdf[subdf.id == pid]
#             for pid, pdf in subdf.groupby('id'):
#                 pids.append(pid)
                if keep_2d==True:
                    pdf = pdf[pdf.ROI.apply(lambda x: x in organ_list)]
                    rows = pdf.drop(['id','ROI'],axis=1)
                    values.append(rows.values.ravel())
                else:
                    dim2 = []
                    for organ in organ_list:
                        sub_pdf = pdf[pdf.ROI.apply(lambda x: x.lower()) == organ.lower()]
                        dim2.append(sub_pdf.drop(['id','ROI'],axis=1).values.ravel())
#                     for organ, sub_pdf in pdf.groupby('ROI'):
#                         dim2.append(sub_pdf.drop(['id','ROI'],axis=1).values.ravel())#,columns=colnames
                    values.append(dim2)
            if as_df:
                returndf = pd.DataFrame(np.array(values),index=pids,columns=colnames)
                returndf.index.name = 'id'
                return returndf
            else:
                values = np.array(values)
                return values
    
def get_dvhcol_pos(x):
    m = re.match('[DV]'+r'(\d+)',x)
    if m is not None:
        return int(m.group(1))
    else:
        return -1
    
