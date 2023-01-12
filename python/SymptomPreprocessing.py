import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import json
import re
import Formatting
from scipy import stats
import Metrics
from Constants import Const
import copy
import Utils
from Models import PatientKNN
import Cluster
import Autoencoders as AE
from Formatting import nan_mse_loss, numpy_nan_reconstruction_error
from Pytorchtools import EarlyStopping
import torch

def get_dates(columns):
    alldates = set([])
    for col in columns:
        if 'mdasi' in col:
            week = symptom_weektime(str(col))
            alldates.add(week)
    return sorted(alldates)

def valid_cols(df, columns):
    valid = list(set(df.columns).intersection(set(columns)))
    invalid = set(columns) - set(df.columns)
    return valid,invalid
    

def get_mdasi_rename_dict():
    #placehold for renaming columns later, based on "MDASI.csv" headings
    col_dict = {'site_of_tumor': 'subsite',
                'RT_duration': 'duration',
                'AGE': 'age',
                't_nominal': 't_stage',
                'n_nominal': 'n_stage',
                'Overall_survival': 'os',
                'Death_days': 'death_days',
                'Fudays': 'followup_days',
                'bc':'bootcamp_therapy',
                'Performance_score': 'performance_score',
                'm':'m_stage'
               }
    return col_dict

def symptom_weektime(string):
    #parses the column for each symptom into the number of weeks after baseline
    s = string.lower().strip().replace('_','')
    if 'baseline' in s:
        return 0
    elif 'startrt' in s:
        return 1
    elif 'endrt' in s:
        return 7
    week_regex = re.match("wk(\d+)",s)
    postweek_regex = re.match('wk(\d+)post',s)
    month_regex = re.match('m(\d+)',s)
    if postweek_regex is not None:
        return 7 + int(postweek_regex.group(1))
    elif week_regex is not None:
        return int(week_regex.group(1))
    elif month_regex is not None:
        return 7 + int(4.35*float(month_regex.group(1)))
    return -1

def get_symptom(string):
    s = string.lower().strip()
    regex = re.match('.*mdasi_([a-z]+)',s)
    if regex is not None:
        return regex.group(1)
    #because someone decided changing the name scheme for activity was a good idea
    else:
        if 'activity' in s:
            return 'activity'
    return False

def format_symptoms(df,
                 to_keep=None,
                symptoms=None,
                     ):
    if to_keep is None:
        to_keep = [
            'id',
            'is_male','age',
            'subsite',
            't_stage','n_stage',
            'is_ajcc_8th_edition',
            'hpv','rt','ic',
            'concurrent','performance_score',
            'os','followup_days','chemotherapy',
            'M6_mbs_digest','baseline_mbs_digest',
            'Local_control','Regional_control',
            'Technique',
            'status_at_enrollememt',
            'sxprimary','rt_dose','rt_fraction',
            'ic_prior_to_enrollment','rt_prior_to_enrollment',
            'concurrent_prior_to_enrollment','sx_prior_to_enrollment',
            'baseline_height','baseline_weight',
            'end_of_treatment_weight','wk6_weight',
                  ]
    valid,invalid = valid_cols(df,to_keep)
    if len(invalid) > 0:
        print('missing columns',invalid)
    new_df = df[valid].copy()
    if symptoms is None:
        symptoms = Const.symptoms
    dates = get_dates(df.columns)
    new_df['dates'] = [dates for i in range(new_df.shape[0])]
    for col in new_df.columns:
        if 'prior_to_enrollment' in col:
            new_df[col] = new_df[col].apply(lambda x: x != 0)
    for s in symptoms:
        scols = [i for i in df.columns if get_symptom(i) == s]
        scols = sorted(scols,key = lambda x: symptom_weektime(x))
        values = df.loc[:,scols].values.tolist()
        new_df['symptoms_'+s] = values
    
    def fix_dose_frac(df):
        temp = df.copy()
        for i,row in temp.iterrows():
            if np.nan_to_num(row['rt_fraction']) > np.nan_to_num(row['rt_dose']):
                tdose = row['rt_dose']
                tfrac = row['rt_fraction']
                temp.loc[i,'rt_dose'] = tfrac
                temp.loc[i,'rt_fraction'] = tdose
        return temp
    
    def format_dose(x):
        if np.isnan(x):
            return 0
        while x > 100:
            x = x/10
        return np.rint(x)
    
    new_df = fix_dose_frac(new_df)
    new_df['rt_dose'] = new_df['rt_dose'].apply(format_dose)
    new_df['dose_70'] = new_df['rt_dose'].apply(lambda x: x > 69.5)
#     new_df['surgery'] = new_df['sxprimary'].apply(lambda x: x in [1,2,3,4])
    new_df = add_bmi_stuff(new_df)
    new_df['surgery'] = new_df['id'].apply(lambda x: int(x) in Const.mdasi_surgery)
    new_df['surgery_alone'] = new_df['id'].apply(lambda x: int(x) in Const.mdasi_surgery_alone)
    return new_df

def add_bmi_stuff(df):
    #add bmi info
    to_impute = ['baseline_height','baseline_weight','end_of_treatment_weight','wk6_weight']
    to_impute = [c for c in to_impute if c in df.columns]
    for col in to_impute:
        df[col] = df[col].apply(lambda x: pd.to_numeric(x,errors='coerce')).astype(float)
    df[to_impute] = df[to_impute].fillna(df[to_impute].median())
    #we have a people who weight 600+kg apparently so i'm asusming there's and extra 0
    for col in [c for c in to_impute if 'weight' in c]:
        df[col] = df[col].apply(lambda x: x/10 if x > 500 else x)
    df['baseline_height'] = df['baseline_height'].apply(lambda x: x*10 if x < 50 else x)
    
    #I think one person has 80 cm instead of 180 cm idk
    df.loc[df[df.id.astype(int) == 576].index,['baseline_height']] = 180
    
    format_height = lambda h: (h/100)**2 #cm to m2 for bmi calc
    df['baseline_bmi'] = df['baseline_weight']/df['baseline_height'].apply(format_height)
    df['wk6_bmi'] =df['wk6_weight']/df['baseline_height'].apply(format_height)
    df['end_of_treatment_bmi'] = df['end_of_treatment_weight']/df['baseline_height'].apply(format_height)
    df['bmi_change'] = df['end_of_treatment_bmi'] - df['baseline_bmi']
    df['weight_loss_5kg'] =((df['end_of_treatment_weight'] - df['baseline_weight']) >= 5).astype(int)
    df['longterm_bmi_change'] = df['wk6_bmi'] - df['baseline_bmi']
    return df

def get_mdasi_symptom_states(df,
                     symptom_prefix='symptoms',
                     merge_symptoms=[],
                    ):
    df = df.copy()
    if symptom_prefix is not None:
        key = symptom_prefix + '_'
    else:
        key = 'symptom'  
    candidates = [[c] for c in df.columns if key in c and 'original' not in c]
    temp_df = df.copy()#df[[c[0] for c in candidates]]
    
    for sgroup in merge_symptoms:
        added = [c[0] for c in candidates if np.any([s in c[0] for s in sgroup])]
        candidates.append(added)
        
    def get_max_symptom(row,colnames,min_date=13,max_date = 300,baseline=False):
        dates = row.dates
        maxval = 0
        for colname in colnames:
            values = np.array(row[colname])
            if baseline:
                values = values - values[0]
            values = [float(v) for d,v in zip(dates,values) if  (d >= min_date) and (d <= max_date) ]
            maxval = max(np.max(values),maxval)
        return float(maxval)
    
    for c in candidates:
        name = key + '_'.join([k.replace(key,'').replace('_','') for k in c])
        temp_df[name+'_max_all'] = df.apply(lambda x: get_max_symptom(x,c,0,300),axis=1)
        temp_df[name+'_max_treatment'] = df.apply(lambda x: get_max_symptom(x,c,0,8),axis=1)
        temp_df[name+'_max_post'] = df.apply(lambda x: get_max_symptom(x,c,13,300),axis=1)
        temp_df[name+'_max_late'] = df.apply(lambda x: get_max_symptom(x,c,15,300),axis=1)
        temp_df[name+'_max_change_all'] = df.apply(lambda x: get_max_symptom(x,c,0,300,True),axis=1)
        temp_df[name+'_max_change_treatment'] = df.apply(lambda x: get_max_symptom(x,c,0,8,True),axis=1)
        temp_df[name+'_max_change_post'] = df.apply(lambda x: get_max_symptom(x,c,13,300,True),axis=1)
        temp_df[name+'_max_change_late'] = df.apply(lambda x: get_max_symptom(x,c,15,300,True),axis=1)
        temp_df = temp_df.copy() #it gives me  a 'heavily fragmented' warning without this
    return temp_df

def format_mdasi_columns(df):
    cd = get_mdasi_rename_dict()
    df = df.rename(columns = cd, inplace=False)
    df.loc[:,'is_male'] = df.sex.apply(lambda x: x > 1)
    df.loc[:,'is_ajcc_8th_edition'] = df.ajcc_version.apply(lambda x : (x > 1 if not np.isnan(x) else -1))
    df.loc[:,'hpv'] = df.p16_hpv_postive.apply(lambda x: (x if x in [0,1] else -1))
    df.loc[~df['os'].isnull(),'os'] = df.loc[~df['os'].isnull(),'os'].apply(lambda x: int('alive' in str(x.lower())))
    #some weird formatting here
    df.loc[df.t_stage == 'tx','t_stage'].t_stage = 't1'
    df.loc[df.n_stage == 'nx','n_stage'].n_stage = 'n1'
    df.loc[df.t_stage == 'NOS','t_stage'] = np.nan
    df.loc[df.n_stage == 'NOS','n_stage'] = np.nan
    return format_symptoms(df)

def filter_bad_mdasi_rows(df,required=None,required_late=None,missing_ratio_cutoff=.7):
    #drop things with these missing
    df = df.copy()
    if required is None:
        required = ['baseline_mdasi_drymouth']
    
    print('before drop count',df.shape[0])
    if required_late is not None:
        allnan = lambda x: np.all([np.isnan(i) for i in x])
        for s in required_late:
            col = s+'_late'
            postcols = lambda x:  [x['wk6_post_mdasi_'+s],x['M6_mdasi_'+s]]
            df = df[~df.apply(lambda x: allnan(postcols(x)),axis=1)]
            
    df = df.dropna(subset=required)
    #drop values with too many missing symptoms
    scols = [c for c in df.columns if 'mdasi' in c]
    mean_null = df[scols].apply(lambda x: x.isnull().mean(),axis=1)
    df = df[mean_null <= missing_ratio_cutoff]
    print('after drop count',df.shape[0])
    return df
    
def add_binary_clinical_stuff(df):
    df = df.copy()
    df['t4'] = (df.t_stage == 't4').astype(int)
    df['n3'] = ((df.n_stage == 'n3') + (df.n_stage == 'n2c')).astype(int)
    df['t3'] = (df.t_stage == 't3').astype(int)
    df['n2'] = ((df.n_stage == 'n2') + (df.n_stage == 'n2a') + (df.n_stage == 'n2b')).astype(int)
    df['BOT'] = (df.subsite == 'BOT').astype(int)
    df['t_severe'] = df.t4 + df.t3
    df['n_severe'] = df.n2 + df.n3
    df['Tonsil'] = (df.subsite == 'Tonsil').astype(int)
    df['old'] = (df.age >= df.age.quantile([.5]).values[0]).astype(int)
    df['age_65'] = (df.age > 65).astype(int)
    df['digest_increase'] = (df['M6_mbs_digest'] - df['baseline_mbs_digest'] > 0).astype(int)
    
    df['performance_1'] = (df.performance_score == 1).astype(int)
    df['performance_2' ] = (df.performance_score == 2).astype(int)
    df['performance_high'] = ((df.performance_score == 1) | (df.performance_score == 2)).astype(int)
    
    df['previously_treated'] = df['status_at_enrollememt'].apply(lambda x: str(x) == 'Previously_Treated')
    df['IMRT'] = df['Technique'].apply(lambda x: x == 'IMRT')
    df['IMPT'] = df['Technique'].apply(lambda x: x == 'IMPT')
    df['VMAT'] = df["Technique"].apply(lambda x: x == 'VMAT')
#     df = df.drop('status_at_enrollememt',axis=1)
    return df

def add_lstm_stuff(dframe):
    dframe = dframe.set_index('id')
    lstm_symptoms = pd.read_csv(Const.lstm_symptom_file).set_index('id').loc[dframe.index]
    
    replaced = []
    for col in lstm_symptoms.columns:
        if col != 'id' and col in dframe.columns:
            dframe[col] = lstm_symptoms[col].values
            replaced.append(col)
    return dframe.reset_index()


def read_table(file):
    if 'xlsx' in file:
        dframe = pd.read_excel(file)
    else:
        dframe = pd.read_csv(file)
    return dframe

def load_mdasi(file = None,use_lstm=False,required=None,required_late=None):
    if file is None:
        file = Const.mdasi_folder + 'MDASI_09092021.xlsx'
    dframe = read_table(file)
    if use_lstm:
        dframe = add_lstm_stuff(dframe)
    dframe =filter_bad_mdasi_rows(dframe,required=required,required_late=required_late)
    dframe = format_mdasi_columns(dframe)
    dframe = add_binary_clinical_stuff(dframe)
#     dframe = get_mdasi_symptom_states(dframe)
    return dframe

def df_symptom_names(df,use_groups=False,use_domains=False,clean=False):
    keyword = 'symptoms_'
    if use_groups:
        keyword = 'symptomgroup_'
    if use_domains:#just override for now because I'm lazy
        keyword = 'symptomdomain_'
    symptom_cols = [c for c in df.columns if (keyword in c) and ('original' not in c)]
    if clean:
        symptom_cols = [c.replace(keyword,'') for c in symptom_cols]
    return symptom_cols

def flat_mdasi_df(df, columns = [], symptoms = None):
    if columns is None:
        columns = [c for c in df.columns if 'symptoms' not in c]
    if symptoms is None:
        symptoms = df_symptom_names(df,use_groups=False)
    df = df.copy()
    val_df = df_to_onehot(df,columns)
    for sym in symptoms:
        symp_df = []
        svals = df[sym]
        svals = np.stack(svals.values)
        for i in range(svals.shape[1]):
            timestep = svals[:,i]
            name = sym+'_t'+str(int(i))
            val_df[name] = timestep
    val_df.index = df.id
    return val_df

def df_to_onehot(df, columns):
    arrays=[]
    for col in columns:
        vals = df[col].copy()
        vals[vals.isnull()] = np.nan
        is_num = True
        try: 
            vals.astype('float')
        except:
            is_num = False
        if (not is_num) or len(vals.unique()) < 5:
            vals = pd.get_dummies(vals,drop_first=True)
            vals.columns = [col + "|" + str(c) for c in vals.columns]
        arrays.append(vals)
    val_df = pd.concat(arrays,axis=1)
    return val_df

def get_symptom_denoiser_path(model=None,x=None,lr=None,epochs=None,**kwargs):
    name = 'symptom_autoencoder'
    if model is not None:
        name = name + '_m=' + str(model)
    if x is not None:
        name = name + '_n='+ str(x.shape[0])
        name = name + '_f=' + str(x.shape[1])
    if epochs is not None:
        name = name + '_e=' + str(epochs)
    if lr is not None:
        name = name + '_lr=' + str(lr)
    return Const.pytorch_model_dir + name
        
def train_symptom_autoencoder(x_numpy, 
                              loss_idx=None,
                              model_path=None,
                              lr = .001,
                              patience = 200,
                              epochs = 20000,
                              **kwargs
                             ):
    autoencoder = AE.BasicDenoiser(x_numpy.shape[1],**kwargs)
    if model_path is None:
        model_path = get_symptom_denoiser_path(x=x_numpy)
    print('model path',model_path)
    x_torch = torch.tensor(x_numpy).float()
    optimizer = torch.optim.Adam(autoencoder.parameters(), lr=lr)
    early_stopping = EarlyStopping(patience = patience, path=model_path)
    losses=[]
    for epoch in range(epochs):
        optimizer.zero_grad()
        y_pred = autoencoder(x_numpy)
        if loss_idx is not None:
            loss = nan_mse_loss(y_pred[:,loss_idx],x_torch[:,loss_idx])
        else:
            loss = nan_mse_loss(y_pred,x_torch)
        loss.backward()
        losses.append(loss.item())
        optimizer.step()
        torch.cuda.empty_cache()
        early_stopping(loss.item(), autoencoder)
        print(epoch,'loss:',loss,end='\r')
        if early_stopping.early_stop:
            print('training stopped on epoch', epoch - patience)
            break
    autoencoder.load_state_dict(torch.load(model_path))
    print()
    return autoencoder.eval(), early_stopping.get_loss_history()
    
def impute_symptom_values(df,
                   additional_vars= None, 
                   limit_loss = False, 
                   use_trained=True,
                   model_path = None,
                  ):
    if additional_vars is None:
        additional_vars = ['ic','rt','concurrent','n_stage','t_stage']
    flat_df = flat_mdasi_df(df,additional_vars)
    x = flat_df.values
    if model_path is None:
        model_path = get_symptom_denoiser_path(x=x)
    scol_pos = [i for i,c in enumerate(flat_df.columns) if 'symptom' in c]
    loss_idx = None
    if limit_loss:
        loss_idx = scol_pos
    if use_trained:
        #will fail if I cahnged the model parameters
        try:
            ae= AE.BasicDenoiser(x.shape[1])
            ae.load_state_dict(torch.load(model_path))
            ae = ae.eval()
        except Exception as e:
            print('training failed')
            print(e)
            use_trained = False
    if not use_trained:
        ae, loss_hist = train_symptom_autoencoder(x, loss_idx = loss_idx)
    xpred = ae(x).detach().numpy()
    xpred = np.rint(xpred)
    error = numpy_nan_reconstruction_error(xpred[:,scol_pos],x[:,scol_pos])
    print('error (%)',error)
    new_df = flat_df.copy()
    new_df[new_df.isnull()] = xpred.astype(float)
    return new_df

def get_flat_symptom(x):
    match = re.match('symptoms_(.+)_t(\d+)',x)
    if match is not None:
        return match.group(1), int(match.group(2))
    return None,None
    
def group_imputed_symptoms(row,symptom):
    cols = [i for i in row.index if symptom.lower() in str(i).lower()]
    cols = sorted(cols,key = lambda x: get_flat_symptom(x)[1])
    vals = row[cols]
    return list(vals.values)

def unflatten_symptom_df(flat_df,original_df=None):
    unflat_df = []
    symptoms = [get_flat_symptom(c)[0] for c in flat_df.columns if 'symptom' in c]
    symptoms = sorted(set(symptoms))
    #index should be id for flattend index
    for pid, row in flat_df.iterrows():
        entry = {'symptoms_'+s: group_imputed_symptoms(row,s) for s in symptoms}
        entry['id'] = pid
        unflat_df.append(entry)
        print(pid,'/',flat_df.shape[0],end='\r')
    unflat_df = pd.DataFrame(unflat_df)
    if original_df is not None:
        return pd.merge(original_df,unflat_df,on='id',how='right',suffixes=['_original',''])
    return pd.DataFrame(unflat_df)

            
def impute_symptom_df(df):
    #imputes nan symptom values using a basic neural net
    imputed_flattened_df = impute_symptom_values(df, use_trained=True)
    imputed_df = unflatten_symptom_df(imputed_flattened_df,df)
    return imputed_df

def get_grouped_symptoms(df,use_original=False,use_domains=True):
    def average_cols(row):
        vals = np.nanmean(np.stack(row.values),axis=0)
        vals = np.nan_to_num(vals)
        return vals
    
    df = df.copy()
    groupings = [('symptomgroup', Const.symptom_category_map)]
    if use_domains:
        groupings.append(('symptomdomain',Const.symptom_domain_map))
    for prefix, groups in groupings:
        try:
            for gname, symptoms in groups.items():
                scols = ['symptoms_' + s for s in symptoms]
                if use_original:
                    scols = [s + '_original' for s in scols]
                df[prefix+'_'+gname] = df[scols].apply(average_cols,axis=1)
        except Exception as e:
            print(e)
    return df

def add_late_outcomes(df,min_date = 14):
    gcols = df_symptom_names(df,use_groups=True)
    def get_outcome(row,threshold=7,min_date=14,max_date=10000000):
        idx = [i for i,v in enumerate(row.dates) if v >= min_date and v <= max_date]
        vals = np.stack(row[gcols].values)[:,idx]
        is_severe = (vals > threshold).max().max()
        return is_severe
    df = df.copy()
    for severity,threshold in zip(['severe','moderate','mild'],[7,5,3]):
        for followup,(mindate,maxdate) in zip(['6wk','late'],[(13,13),(14,1000000)]):
            colname = severity + '_' + followup + '_symptoms'
            ofunc = lambda r: get_outcome(r,threshold=threshold,min_date=mindate,max_date=maxdate)
            df[colname] = df.apply(ofunc,axis=1)
#     df['severe_late_symptoms'] = df.apply(get_outcome,axis=1)
#     df['moderate_late_symptoms'] = df.apply(lambda r: get_outcome(r,threshold=5),axis=1)
#     df['mild_late_symptoms'] = df.apply(lambda r: get_outcome(r,threshold=3),axis=1)
    print([(c,df[c].mean()) for c in df.columns if 'late_symptoms' in c or '6wk_symptoms' in c])
    return df

def group_symptoms(idf,use_domains=True):
    idf = get_grouped_symptoms(idf,use_domains=use_domains)
    return add_late_outcomes(idf)
    
def fill_missing_symptoms(mdasi):
    mdasi= mdasi.copy()
    scols = [c for c in mdasi.columns if 'symptoms_' in c]
    def inpute_previous(array,col):
        for i, val in enumerate(array):
            if pd.isnull(val):
                if i == 0:
                    array[i] = mdasi[~pd.isnull(mdasi[col])][col].median()
                else:
                    array[i] = array[i-1]
        #list because it saves better
        return list(np.array(array).astype(float))
    for col in scols:
        mdasi[col] = mdasi[col].apply(lambda x: inpute_previous(x,col))
    return mdasi

def impute_and_group(df,skip_inpute=False,fill_na=True,use_domains=False):
    if not skip_inpute:
        df = impute_symptom_df(df)
    elif fill_na:
        df = fill_missing_symptoms(df)
    return group_symptoms(df,use_domains=use_domains)

def df_to_symptom_array(df,use_groups = True, use_domains = False, simplify = False):
    df = df.copy()
    #determines if we use 3 the
    symptom_cols = df_symptom_names(df,use_groups=use_groups,use_domains=use_domains)
    def stack_row(row):
        vals = np.stack(row.values)
        return vals
    vals = np.stack(df[symptom_cols].apply(stack_row,axis=1).values)
    return vals