import pandas as pd
import numpy as np
from Constants import Const
import json
import Utils
import re
from sklearn.mixture import GaussianMixture, BayesianGaussianMixture
from sklearn.cluster import SpectralClustering, KMeans, AgglomerativeClustering
from sklearn.decomposition import PCA
from scipy.stats import chi2
from sklearn.feature_selection import mutual_info_regression, mutual_info_classif
from ast import literal_eval
import statsmodels.api as sm
import Metrics

import joblib
import warnings
from statsmodels.tools.sm_exceptions import ConvergenceWarning, HessianInversionWarning
warnings.simplefilter('ignore', ConvergenceWarning)
warnings.simplefilter('ignore', HessianInversionWarning)

def add_sd_dose_clusters(sddf, 
                         clusterer = None,
                         features=None,
                         reducer=None,
                         organ_subset=None,
                         normalize = True,
                         prefix='',
                         n_clusters = 4,
                        ):
    if clusterer is None:
        clusterer = BayesianGaussianMixture(n_init=5,
                                            n_components=n_clusters, 
                                            covariance_type="full",
                                            random_state=100)
    if features is None:
        features=['V35','V40','V45','V50','V55','V60','V65']
    if reducer is None:
        reducer= None#PCA(len(organ_list),whiten=True)
    if organ_subset is None:
        organ_subset = Const.organ_list[:]
    organ_positions = [Const.organ_list.index(o) for o in organ_subset]
    vals = np.stack(sddf[features].apply(lambda x: np.stack([np.array([ii[i] for i in organ_positions]).astype(float) for ii in x]).ravel(),axis=1).values)
    if normalize:
        vals = (vals - vals.mean(axis=0))/(vals.std(axis=0) + .01)
    if reducer is not None:
        vals = reducer.fit_transform(vals)
    df = pd.DataFrame(vals,index = sddf.index)
    clusters = clusterer.fit_predict(vals)
    new_df = sddf.copy()
    cname= prefix+'dose_clusters'
    new_df[cname] = clusters
    new_df = reorder_clusters(new_df,
                              cname,
                              by='mean_dose',
                              organ_list=organ_subset#order by mean dose to clustered organs
                             )
    return new_df

def reorder_clusters(df,cname,by='moderate_6wk_symptoms',organ_list=None):
    df = df.copy()
    df2 = df.copy()
    severities = {}
    clusts = sorted(df[cname].unique())
    getmean = lambda d: d[by].astype(float).mean()
    if organ_list is not None and Utils.iterable(df[by].iloc[0]):
        keep_idx = [Const.organ_list.index(o) for o in organ_list]
        df[by] = df[by].apply(lambda x: [x[i] for i in keep_idx])
    if Utils.iterable(df[by].iloc[0]):
        getmean = lambda d: np.stack(d[by].apply(lambda x: np.array(x).sum()).values).mean()
    for c in clusts:
        subset = df[df[cname] == c]
        avg_severity = getmean(subset)
        severities[c] = avg_severity
    clust_order = np.argsort(sorted(severities.keys(), key = lambda x: severities[x]))
    clust_map = {c: clust_order[i] for i,c in enumerate(clusts)}
    df2[cname] = df[cname].apply(lambda x: clust_map.get(x))
    return df2

def get_df_dose_cols(df,key='DV'):
    return [c for c in df.columns if re.match('[' + key + ']\d+',c) is not None]

def get_df_symptom_cols(df):
    return [c for c in df.columns if 'symptoms_' in c if 'original' not in c]
    
def add_symptom_groups(df):
    smap = {
        'salivary': ['drymouth','taste'],
        'throat':['swallow','choke','teeth','sob','mucositis'],
        'mouth':['drymouth','teeth','swallow'],
        'core': ['pain','fatigue','nausea','sleep',
                 "distress", "sob", "memory", "appetite", 
                "drowsy", "drymouth", "sad", "vomit", "numb"],
        'interference': ["activity", "mood", "work", 
                "relations", "walking","enjoy"],
        'hnc': ["mucus", "swallow", "choke", "voice", "skin", 
                "constipation", "taste", "mucositis", "teeth"],
    }
    df = df.copy()
    for name, symptoms in smap.items():
        array = []
        for s in symptoms:
            svals = np.stack(df['symptoms_'+s].apply(lambda x: np.array(x)).values)
            array.append(svals)
        array = np.stack(array,axis=-1)
        #rounding in the same weird way you do in microprocessor code
        smean = (100*array.mean(axis=-1)).astype('int')/100.0
        smax = array.max(axis=-1)
        df['symptoms_'+name+'_max'] = smax.tolist()
        df['symptoms_'+name+'_mean'] = smean.tolist()
    return df
    
def load_dose_symptom_data():
    data = pd.read_csv(Const.data_dir + 'dose_symptoms_merged.csv')
    to_drop = [c for c in data.columns if 'symptom' in c and ('symptoms_' not in c or 'original' in c)]
    data = data.drop(to_drop,axis=1)
    dose_cols = get_df_dose_cols(data)
    s_cols = get_df_symptom_cols(data) 
    for c in dose_cols + s_cols + ['max_dose','mean_dose','volume','dates']:
        try:
            data[c] = data[c].apply(literal_eval)
        except Exception as e:
            print(c,e)
    data = add_symptom_groups(data)
    return data

def add_confounder_dose_limits(df,organ_list=None):
    #dose limits as binary values from https://applications.emro.who.int/imemrf/Rep_Radiother_Oncol/Rep_Radiother_Oncol_2013_1_1_35_48.pdf
    #not inlcudeing other stuff like eyes at this time
    #also, my max dose is weird so I'm using V10 for that because I feel like that makes sense
    #using the 
    if organ_list is None:
        organ_list = Const.organ_list[:]
    df = df.copy()
    original_cols = set(df.columns)
    getval = lambda organ,param: df[param].apply(lambda x: x[organ_list.index(organ)])
    get_lr_val = lambda organ,param: np.maximum(getval('Lt_'+organ,param),getval('Rt_'+organ,param))
    
    maxdose_var = 'max_dose'
   
    #xerostomia. >25 for 1 or >20 for both
    df['Parotid_Gland_limit'] = (get_lr_val('Parotid_Gland','mean_dose') > 20) | (getval('Lt_Parotid_Gland','mean_dose') > 25) | (getval('Rt_Parotid_Gland','mean_dose') > 25)
    
    #there is 50 for PEG tube and 60 for aspiration so i'll do 50
    for o in ['IPC','MPC',"SPC"]:
        df[o+"_limit"] = getval(o,'mean_dose') > 50
        df[o+"_limit2"] = getval(o,'mean_dose') > 60
    
    #edema
    df['Larynx_limit'] = getval('Larynx','V50') > 27
    
    #Esophagitus
    elimits = [('V35',50),('V50',40),('V70',20),('V60',30)]
    df['Esophagus_limit'] = np.stack([(getval('Esophagus',v) > lim) for v,lim in elimits]).sum(axis=0) > 0
    return df

def add_total_doses(df,cols):
    df = df.copy()
    for col in cols:
        if col in df.columns:
            df['total_'+col] = df[col].apply(np.sum)
    return df


def var_test(df, testcol, ycol,xcols, 
             boolean=True,
             regularize = False,
             scale=True):
    df = df.fillna(0)
    y = df[ycol]
    if testcol not in xcols:
        xcols = xcols + [testcol]
    x = df[xcols].astype(float)
    if regularize:
        for col in xcols:
            x[col] = (x[col] - x[col].mean())/(x[col].std()+ .01)
    if scale:
        for col in xcols:
            x[col] = (x[col] - x[col].min())/(x[col].max() - x[col].min())
    for col in xcols:
        if x[col].std() < .00001:
            x = x.drop(col,axis=1)
    x2 = x.copy()
    x2 = x2.drop(testcol,axis=1)
    boolean = (y.max() <= 1) and (len(y.unique()) <= 2)
    if boolean:
        model = sm.Logit
        method = 'bfgs'
    else:
        model = sm.OLS
        method= 'qr'
    logit = model(y,x)
    logit_res = logit.fit(maxiter=500,
                          disp=False,
                          method=method,
                         )
    
    logit2 = model(y,x2)
    logit2_res = logit2.fit(maxiter=500,
                            disp=False,
                            method=method,
                           )
    
    llr_stat = 2*(logit_res.llf - logit2_res.llf)
    llr_p_val = chi2.sf(llr_stat,1)
    
    aic_diff = logit_res.aic - logit2_res.aic
    bic_diff = logit_res.bic - logit2_res.bic
    
    results = {
        'ttest_pval': logit_res.pvalues[testcol],
        'ttest_tval': logit_res.tvalues[testcol],
        'lrt_pval': llr_p_val,
        'aic_diff': aic_diff,
        'bic_diff': bic_diff
    }
    return results

def get_cluster_lrt(df,clust_key = 'dose_clusters',
                             symptoms=None,
                             nWeeks = None,
                             thresholds=None,
                             confounders=None,
                            ):
    #add tests for pvalues for data
    # print('cluster lrt',symptoms)
    if symptoms is None:
        symptoms = Const.symptoms[:]
    if nWeeks is None:
        nWeeks = [13,33]
    if confounders is None:
        confounders = [
            't4',
            'n3',
            'hpv',
            'BOT',
            'Tonsil',
            'total_mean_dose',
           #'Larynx_limit',
           #'Parotid_Gland_limit'
                      ]
    date_keys = [df.dates.iloc[0].index(week) for week in nWeeks if week in df.dates.iloc[0]]
    #calculate change from baseline instead of absolute
    get_symptom_max = lambda x: np.max([x[d] for d in date_keys])
    df = add_confounder_dose_limits(df)
    
    tdose_cols = [c.replace('total_','') for c in confounders if 'total_' in c]
    if len(tdose_cols) > 0:
        df = add_total_doses(df,tdose_cols)
        
    for symptom in symptoms:
        skey = 'symptoms_'+symptom
        if skey not in df.columns:
            continue
        max_symptoms = df[skey].apply(get_symptom_max).values
        for threshold in [-1,3, 5, 7]:
            colname=  'cluster_'+symptom
            boolean = threshold > 0
            if boolean:
                y = max_symptoms >= threshold
                colname += '_'+str(threshold)
            else:
                y = max_symptoms/10
            names = ['lrt_pval','ttest_tval','ttest_pval','aic_diff']
            for n in names:
                df[colname+'_'+n] = -1
            for clust in df[clust_key].unique():
                in_clust = df[clust_key] == clust
                if len(np.unique(y)) < 2:
                    continue
                else:
                    df['x'] = in_clust
                    df['y'] = y
                    res = var_test(df,'x','y',confounders,regularize=boolean,boolean=boolean)
                    for name in names:
                        if not pd.isnull(res[name]):
                            df.loc[df[in_clust].index,[colname+'_'+name]] = res[name]
                    
    return df

def get_cluster_correlations(df,clust_key = 'dose_clusters',
                             symptoms=None,
                             nWeeks = None,
                             thresholds=None,
                             baselines=[False],
                            ):
    #add tests for pvalues for data
    if symptoms is None:
        symptoms = Const.symptoms[:]
    if nWeeks is None:
        nWeeks = [13,33]
    if thresholds is None:
        thresholds = [3,5,7]
    date_keys = [df.dates.iloc[0].index(week) for week in nWeeks if week in df.dates.iloc[0]]
    #calculate change from baseline instead of absolute
    get_symptom_change_max = lambda x: np.max([x[d]-x[0] for d in date_keys])
    get_symptom_max = lambda x: np.max([x[d] for d in date_keys])
    df = df.copy()    
    for symptom in symptoms:
        skey = 'symptoms_'+symptom
        if skey not in df.columns:
            continue
        max_symptoms = df[skey].apply(get_symptom_max).values
        max_change = df[skey].apply(get_symptom_change_max).values
        for threshold in thresholds:
            for baseline in baselines:
                if baseline:
                    y = (max_change >= threshold).astype(int)
                else:
                    y = (max_symptoms >= threshold).astype(int)
                colname=  'cluster_'+symptom
                if baseline:
                    colname += '_change'
                colname += "_" + str(threshold)
                df[colname+'_odds_ratio'] = -1
                df[colname+'_pval'] = -1
                for clust in df[clust_key].unique():
                    in_clust = df[clust_key] == clust
                    if len(np.unique(y)) < 2:
                        (odds_ratio,pval) = (0,1)
                    else:
                        (odds_ratio, pval) = Metrics.boolean_fisher_exact(in_clust.astype(int),y)
                    df.loc[df[in_clust].index,[colname+'_odds_ratio']] = odds_ratio
                    df.loc[df[in_clust].index,[colname+'_pval']] = pval
    return df

def keyword_clusterer(cluster_type, n_clusters,**kwargs):
    clusterer = None
    if cluster_type.lower() == 'bgmm':
        clusterer = BayesianGaussianMixture(n_init=5,
                                            n_components=n_clusters, 
                                            covariance_type="full",
                                            random_state=100)
    if cluster_type.lower() == 'gmm':
        clusterer = GaussianMixture(n_init=5,
                                    n_components=n_clusters, 
                                    covariance_type="full",
                                    random_state=100)
    if cluster_type.lower() == 'spectral':
        clusterer = SpectralClustering(n_clusters=n_clusters)
    if cluster_type.lower() == 'kmeans':
        clusterer = KMeans(n_clusters=n_clusters,max_iter=1000)
    if cluster_type.lower() == 'ward':
        clusterer = AgglomerativeClustering(n_clusters=n_clusters,
                                            linkage='ward')
    if clusterer is None:
        print('bad cluster argument', cluster_type,'using kmeans')
        clusterer = KMeans(n_clusters=n_clusters,max_iter=1000)
    return clusterer

def get_cluster_json(df,
                     organ_list=None,
                     quantiles = None,
                     sdates = [13,33],
                     other_values = None,
                     add_metrics = True,
                     clustertype = None,
                     confounders=None,
                     update_clusters=True,
                     n_clusters = 4,
                     symptoms=None,
                     **kwargs):
    if organ_list is None:
        organ_list = Const.organ_list[:]
    clusterer = None
    if clustertype is not None:
        clusterer = keyword_clusterer(clustertype,n_clusters)
    if update_clusters or ('dose_clusters' not in df.columns):
        df = add_sd_dose_clusters(df.copy(),
                                  organ_subset = organ_list,
                                  clusterer=clusterer,
                                  n_clusters = n_clusters,
                                  **kwargs)
    else:
        print('skipping stuff')
    clust_dfs = []
    dose_cols = get_df_dose_cols(df,key='V') + ['mean_dose','volume']
    s_cols = get_df_symptom_cols(df)
    if quantiles is None:
        quantiles = np.linspace(.1,.9,6) 
    dates = df.dates.iloc[0]
    date_positions = [(sdate, dates.index(sdate)) for sdate in sdates if sdate in dates]
    #i'm asuming these are discrete
    if other_values is None:
        other_values = [
            'subsite',
            'n_stage','t_stage',
            'os',
#             'age',
            'hpv',
            'is_male',
            'chemotherapy','concurrent','ic','rt',
            'digest_increase'
        ]
    #adds in pvalues and odds ratio
    stats_cols=[]
    if add_metrics:
        old_cols = df.columns
        df = get_cluster_correlations(df,
                                      thresholds=[3,5,7],
                                      clust_key='dose_clusters',
                                      baselines=[False],
                                      symptoms=symptoms,
                                      nWeeks=sdates)
        df = get_cluster_lrt(df,
                              clust_key='dose_clusters',
                              confounders=confounders,
                              symptoms=symptoms,
                              nWeeks=sdates)
        stats_cols =sorted(set(df.columns) - set(old_cols))
    df = df.reset_index()
    for c,subdf in df.groupby('dose_clusters'):
        clust_entry = {
            'cluster_size': subdf.shape[0],
            'dates':dates,
            'ids': subdf.id.values.tolist(),
            'clusterId': c,
            }
        
        for organ in Const.organ_list:
            opos = Const.organ_list.index(organ)
            for dcol in dose_cols:
#                 print(dcol,len(subdf[dcol].iloc[0]),len(Const.organ_list))
                vals = subdf[dcol].apply(lambda x: x[opos])
                qvals = vals.quantile(quantiles)
                clust_entry[organ+'_'+dcol] = qvals.values.astype(float).tolist()
            
        for scol in s_cols:
            sname = scol.replace('symptoms_','')
            clust_entry[sname] = subdf[scol].apply(lambda x: [int(i) for i in x]).values.tolist()
        for col in other_values:
            clust_entry[col] = subdf[col].values.tolist()
        for statcol in stats_cols:
            val = subdf[statcol].iloc[0]
            clust_entry[statcol] = val
        clust_dfs.append(clust_entry)
    return clust_dfs


def sddf_to_json(df,
                 to_drop =None,
                 add_pca = True,
                 dose_pca_features = None,
                ):
    if to_drop is None:
        to_drop = ['min_dose','is_ajcc_8th_edition']
    df = df.copy().fillna(0)
    df['totalDose'] = df['mean_dose'].apply(np.sum)
    df['organList'] = [Const.organ_list[:] for i in range(df.shape[0])]
    if add_pca:
        if dose_pca_features is None:
            dose_pca_features = ['V35','V40','V45','V50','V55','V60','V65']
        dose_x = np.stack(df[dose_pca_features].apply(lambda x: np.stack(x).ravel(),axis=1).values)
        dose_x_pca = PCA(3).fit_transform(dose_x)
        df['dose_pca'] = [x.tolist() for x in dose_x_pca]

        symptom_cols = [c for c in df.columns if 'symptoms_' in c and 'original' not in c] 
        valid_sd = [i for i,date in enumerate(df.dates.iloc[0]) if date <= 33]
        late_sd = [i for i,date in enumerate(df.dates.iloc[0]) if date <= 33 and date > 7]
        treatment_sd = [i for i,date in enumerate(df.dates.iloc[0]) if date <= 7]
        for name, pos_list in zip(['all','post','treatment'],[valid_sd,late_sd,treatment_sd]):
            symptom_x = np.stack(df[symptom_cols].apply(lambda x: np.stack([x[i] for i in pos_list]).ravel(),axis=1).values)
            symptom_x_pca = PCA(3).fit_transform(symptom_x)
            df['symptom_'+name+'_pca'] = [x.tolist() for x in symptom_x_pca]
    
    is_dose_dvh = lambda x: re.match('D[0-9][0-9]?',x) is not None
    vol_dvh_too_high = lambda x: re.match('V[0-18-9][0-9]?',x) is not None
    for c in df.columns:
        if is_dose_dvh(c) or vol_dvh_too_high(c):
            to_drop.append(c)
        if 'symptoms' in c and 'original' in c:
            to_drop.append(c)
        if '_max_' in c:
            to_drop.append(c)
    df = df.drop(to_drop,axis=1)
    ddict = df.reset_index().to_dict(orient='records')
    return ddict


def add_late_symptoms(df,symptoms=None):
    df = df.copy()
    if symptoms is None:
        symptoms = Const.symptoms[:]
    date_idxs = [i for i,v in enumerate(df.dates.iloc[0]) if v > 12 and v < 35]
    for symptom in symptoms:
        mval = df['symptoms_'+symptom].apply(lambda x: np.max([x[i] for i in date_idxs]))
        df[symptom+'_late'] = mval
    return df


def multi_var_tests(df, testcols, ycol,xcols, 
             boolean=True,
             regularize = False,
             scale=True):
    y = df[ycol]
    xcols = list(set(xcols).union(set(testcols)))
    x = df[xcols].astype(float)
    if regularize:
        for col in xcols:
            x[col] = (x[col] - x[col].mean())/(x[col].std()+ .01)
    if scale:
        for col in xcols:
            x[col] = (x[col] - x[col].min())/(x[col].max() - x[col].min())
    for col in xcols:
        if x[col].std() < .00001:
            x = x.drop(col,axis=1)
    x2 = x.copy()
    x2 = x2.drop(testcols,axis=1)
    if boolean:
        model = sm.Logit
        method = 'bfgs'
    else:
        model = sm.OLS
        method= 'qr'
    logit = model(y,x)
    logit_res = logit.fit(maxiter=500,
                          disp=False,
                          method=method,
                         )
    
    logit2 = model(y,x2)
    logit2_res = logit2.fit(maxiter=500,
                            disp=False,
                            method=method,
                           )
    
    llr_stat = 2*(logit_res.llf - logit2_res.llf)
    llr_p_val = chi2.sf(llr_stat,len(testcols))
    
    aic_diff = logit_res.aic - logit2_res.aic
    bic_diff = logit_res.bic - logit2_res.bic
    
    results = {
        'lrt_pval': llr_p_val,
        'aic_diff': aic_diff,
        'bic_diff': bic_diff
    }
    for testcol in testcols:
        results['ttest_pval_' + str(testcol)]= logit_res.pvalues[testcol]
        results['ttest_tval_' + str(testcol)]= logit_res.tvalues[testcol]
    return results

# def select_single_organ_cluster_effects(df,
#                                         symptoms=None,
#                                         base_organs=None,
#                                         covars=None,
#                                         n_clusters=4,
#                                         clustertype=None,
#                                         threshold=None,
#                                         drop_base_cluster=True,
#                                         features=None,
#                                         organ_list=None):
#     if base_organs is None:
#         base_organs = []
#     if organ_list is None:
#         #imma just skip stuff that's like probably not relevant for this usage
#         exclude = set(['Brainstem',"Spinal_Cord",
#                    'Lt_Brachial_Plexus','Rt_Brachial_Plexus',
#                    'Lower_Lip',"Upper_Lip",
#                    'Hyoid_bone','Mandible',
#                    'Cricoid_cartilage',
#                     'Thyroid_cartilage',
#                   ])
#         organ_list = [o for o in Const.organ_list if o not in exclude]
#     if symptoms is None:
#         symptoms=Const.symptoms[:]
#     if isinstance(symptoms,str):
#         symptoms=[symptoms]
#     df = add_late_symptoms(df,symptoms)
#     df = add_confounder_dose_limits(df)
#     olists = [base_organs] if len(base_organs) > 0 else []
#     for o in organ_list:
#         if o in base_organs:
#             continue
#         if 'Rt_' in o:
#             continue
#         new_list = [o]
#         if len(base_organs) > 0:
#             new_list = new_list + base_organs
#         if 'Lt_' in o:
#             new_list.append(o.replace('Lt_','Rt_'))
#         if len(new_list) > len(base_organs):
#             olists.append(new_list)
#     if covars is None:
#         covars = [
#             'Parotid_Gland_limit',
#           'IPC_limit','MPC_limit','SPC_limit',
#           't4','n3','hpv','total_dose',
#           "BOT","Tonsil",
#          ]
#     df = df.copy()
#     df['total_dose'] = df.mean_dose.apply(lambda x: np.sum(x))
#     results = []
#     base_pval = 1
#     completed_clusters = set([])
    
#     clusterer = None
#     if clustertype is not None:
#         clusterer = keyword_clusterer(clustertype,n_clusters)
#     for olist in olists:
#         prefix = '_'.join(olist)+'_'
#         df  = add_sd_dose_clusters(df,
#                                      features = features,
#                                      organ_subset=olist,
#                                      prefix=prefix,
#                                     clusterer=clusterer,
#                                      n_clusters=n_clusters,
#             )
#         clustname = prefix+'dose_clusters'
#         xvals = []
#         for cval in df[clustname].unique():
#             if cval == 0 and drop_base_cluster:
#                 continue
#             df['x'+str(cval)] = (df[clustname] == cval).astype(int)
#             xvals.append('x'+str(cval))
            
#         for symptom in symptoms:
#             outcome = symptom + '_late'
#             if threshold is None:
#                 df['y'] = df[outcome]
#             else:
#                 df['y'] = (df[outcome] >= threshold)
#             res = multi_var_tests(df,xvals,'y',covars,boolean=(threshold is not None))
#             entry = {
#                 'outcome':outcome,
#                 'base_organs':base_organs,
#                 'added_organs':sorted(set(olist)-set(base_organs)),
#                 'threshold':threshold,
#                 'clustertype':clustertype,
#             }
#             if ''.join(olist) == ''.join(base_organs):
#                 base_pval = res['lrt_pval']
#             entry['pval_change'] = base_pval - res['lrt_pval']
#             for k,v in res.items():
#                 entry[k] = v
#             results.append(entry)
#     #sort by effect size of highest-dose cluster
#     results= sorted(results,key=lambda x: -x['ttest_tval_x'+str(n_clusters-1)])
#     return results

def select_single_organ_cluster_effects(df,
                                        symptoms=None,
                                        base_organs=None,
                                        covars=None,
                                        n_clusters=4,
                                        clustertype=None,
                                        threshold=None,
                                        drop_base_cluster=True,
                                        features=None,
                                        organ_list=None):
    if base_organs is None:
        base_organs = []
    if organ_list is None:
        #imma just skip stuff that's like probably not relevant for this usage
        exclude = set(['Brainstem',"Spinal_Cord",
                   'Lt_Brachial_Plexus','Rt_Brachial_Plexus',
                   'Lower_Lip',"Upper_Lip",
                   'Hyoid_bone','Mandible',
                   'Cricoid_cartilage',
                    'Thyroid_cartilage',
                  ])
        organ_list = [o for o in Const.organ_list if o not in exclude]
    if symptoms is None:
        symptoms=Const.symptoms[:]
    if isinstance(symptoms,str):
        symptoms=[symptoms]
    df = add_late_symptoms(df,symptoms)
    df = add_confounder_dose_limits(df)
    olists = [base_organs] if len(base_organs) > 0 else []
    for o in organ_list:
        if o in base_organs:
            continue
        if 'Rt_' in o:
            continue
        new_list = [o]
        if len(base_organs) > 0:
            new_list = new_list + base_organs
        if 'Lt_' in o:
            new_list.append(o.replace('Lt_','Rt_'))
        if len(new_list) > len(base_organs):
            olists.append(new_list)
    if covars is None:
        covars = [
            'Parotid_Gland_limit',
          'IPC_limit','MPC_limit','SPC_limit',
          't4','n3','hpv','total_dose',
          "BOT","Tonsil",
         ]
    df = df.copy()
    df['total_dose'] = df.mean_dose.apply(lambda x: np.sum(x))
    results = []
    base_pval = 1
    completed_clusters = set([])
    
    clusterer = None
    if clustertype is not None:
        clusterer = keyword_clusterer(clustertype,n_clusters)
        
    rlist = joblib.Parallel(n_jobs=4)(joblib.delayed(parallel_cluster_lrt)((
        df,olist,base_organs,symptoms,covars,features,clusterer,n_clusters,clustertype,threshold,drop_base_cluster,
    )) for olist in olists)
    for rl in rlist:
        results.extend(rl)
    results= sorted(results,key=lambda x: -x['ttest_tval_x'+str(n_clusters-1)])
    return results

def parallel_cluster_lrt(args):
    [df,olist,base_organs,symptoms,covars,features,clusterer,n_clusters,clustertype,threshold,drop_base_cluster] = args
    prefix = '_'.join(olist)+'_'
    df  = add_sd_dose_clusters(
        df,
        features = features,
        organ_subset=olist,
        prefix=prefix,
        clusterer=clusterer,
        n_clusters=n_clusters,
    )
    clustname = prefix+'dose_clusters'
    xvals = []
    base_pval = 1
    for cval in df[clustname].unique():
        if cval == 0 and drop_base_cluster:
            continue
        df['x'+str(cval)] = (df[clustname] == cval).astype(int)
        xvals.append('x'+str(cval))
    results=[]
    for symptom in symptoms:
        outcome = symptom + '_late'
        if threshold is None:
            df['y'] = df[outcome]
        else:
            df['y'] = (df[outcome] >= threshold)
        res = multi_var_tests(df,xvals,'y',covars,boolean=(threshold is not None))
        entry = {
            'outcome':outcome,
            'base_organs':base_organs,
            'added_organs':sorted(set(olist)-set(base_organs)),
            'threshold':threshold,
            'clustertype':clustertype,
        }
        if ''.join(olist) == ''.join(base_organs):
            base_pval = res['lrt_pval']
        entry['pval_change'] = base_pval - res['lrt_pval']
        for k,v in res.items():
            entry[k] = v
        results.append(entry)
    return results

def get_sample_cluster_metrics_input():
    with open(Const.data_dir+'cluster_post_test.json','r') as f:
        post_data= simplejson.load(f)
    return post_data

def extract_dose_vals(df,organs,features):
    oidxs = [Const.organ_list.index(o) for o in organs if o in Const.organ_list]
    df = df.copy()
    vals = []
    names = []
    for f in features:
        for (oname, oidx) in zip(organs,oidxs):
            values = df[f].apply(lambda x: x[oidx]).values
            vals.append(values.reshape((-1,1)))
            names.append(f+'_'+oname)
    vals = np.hstack(vals)
    vals = pd.DataFrame(vals,columns=names,index=df.index)
    return vals 

def get_outcomes(df,symptoms,dates,threshold=None):
    date_idxs = [i for i,d in enumerate(df.dates.iloc[0]) if d in dates]
    res = []
    get_max_sval = lambda s: df['symptoms_'+s].apply(lambda x: np.max([x[i] for i in date_idxs]) ).values
    res = {symp:get_max_sval(symp) for symp in symptoms}
    return pd.DataFrame(res,index=df.index)

def add_post_clusters(df,post_results):
    cmap = {}
    for c_entry in post_results['clusterData']:
        cId = c_entry['clusterId']
        for pid in c_entry['ids']:
            cmap[int(pid)] = cId
    df = df.copy()
    df['post_cluster'] = df.id.apply(lambda i: cmap.get(int(i),-1))
    return df

def get_rule_inference_data(df,
                           organs,
                           symptoms,
                           features, 
                           dates, 
                           cluster=None):
    if cluster is not None:
        df = df[df.post_cluster.astype(int) == int(cluster)]
    df_doses = extract_dose_vals(df,organs,features)
    outcome = get_outcomes(df,symptoms,dates)
    return df_doses,outcome
        
        
def process_rule(args):
    [df,col,y,currval,min_split_size,min_odds] = args
    vals = df[col]
    rule = vals >= currval
    entry = {
        'features': [col],
        'thresholds': [currval],
        'splits': [rule],
        'rule': rule
    }
    entry = evaluate_rule(entry,y)
    if valid_rule(entry,min_split_size,min_odds=min_odds):
        return entry
    return False
    
def get_rule_df(df,y,granularity=2,min_split_size=20,min_odds=1):
    split_args = []
    minval = df.values.min().min()
    maxval = df.values.max().max()
    granularity_vals = [i*granularity + minval for i in np.arange(np.ceil(maxval/granularity))]
    for col in df.columns:
        for g in granularity_vals:
            split_args.append((df,col,y,g,min_split_size,min_odds))
    splits = joblib.Parallel(n_jobs=4)(joblib.delayed(process_rule)(args) for args in split_args)
    return [s for s in splits if s is not False]

def combine_rule(r1,r2):
    if r1 is None:
        combined = r2
    elif r2 is None:
        combined = r1
    else:
        newthresholds = r1['thresholds'][:]
        newfeatures = r1['features'][:]
        newsplits = r1['splits'][:]
        newrule = r1['rule']
        for i,f in enumerate(r2['features']):
            #only one split per feature
            if f not in newfeatures:
                newfeatures.append(f)
                t = r2['thresholds'][i]
                s = r2['splits'][i]
                newthresholds.append(t)
                newsplits.append(s)
                newrule = newrule&s
        combined = {
            'features': list(newfeatures),
            'thresholds': list(newthresholds),
            'splits': newsplits,
            'rule': newrule
        }
    return combined

def evaluate_rule(rule, y):
    r = rule['rule']
    upper = y[r]
    lower = y[~r]
    entry = {k:v for k,v in rule.items()}
    if lower.mean().values[0] > 0:
        entry['odds_ratio'] = upper.mean().values[0]/lower.mean().values[0]
    else:
        entry['odds_ratio'] = -1
    for prefix, yy in zip(['lower','upper'],[lower,upper]):
        entry[prefix+'_count'] = yy.shape[0]
        entry[prefix+'_tp'] = yy.sum().values[0]
        entry[prefix+'_mean'] = yy.mean().values[0]
    return entry 

def valid_rule(r,min_split_size=20,min_odds=1):
    if r['odds_ratio'] < min_odds:
        return False
    if min(r['upper_count'],r['lower_count']) <= min_split_size:
        return False
    return True

def filter_rules(rulelist, bests):
    is_best = lambda r: r['odds_ratio'] >= bests.get(stringify_features(r['features']),1)
    filtered = [r for r in rulelist if is_best(r)]
    return filtered
    
def stringify_features(l):
    #turns a list of features in the form 'VXX_Organ' into a hashable set
    #removes V thing becuase I think it shold be per organ
    return ''.join([ll[3:] for ll in l])

def combine_and_eval_rule(args):
    [baserule,rule,outcome_df] = args
    r = combine_rule(baserule,rule)
    r = evaluate_rule(r,outcome_df)
    return r

def get_best_rules(front, allrules,dose_df,outcome_df,min_odds):
    new_rules = []
    bests = {}
    if len(front) < 1:
        front = [None]
    minsplit = int(outcome_df.shape[0]/4)
    for baserule in front:
        combined_rules = joblib.Parallel(n_jobs=4)(joblib.delayed(combine_and_eval_rule)((baserule,r,outcome_df)) for r in allrules)
        for combined_rule in combined_rules:
            if valid_rule(combined_rule,minsplit,min_odds):
                if baserule is not None and combined_rule['odds_ratio'] <= baserule.get('odds_ratio',1):
                    continue
                rname = stringify_features(combined_rule['features'])
                if bests.get(rname,0) < combined_rule['odds_ratio']:
                    bests[rname] = combined_rule['odds_ratio']
                    new_rules.append(combined_rule)
    new_rules = filter_rules(new_rules,bests)
    return new_rules
    
def format_rule_json(rule):
    newrule = {k:v for k,v in rule.items() if k not in ['splits','rule']}
    r = rule['rule']
    upper= r[r]
    lower = r[~r]
    newrule['upper_ids'] = r[r].index.tolist()
    newrule['lower_ids'] = r[~r].index.tolist()
    return newrule 

def get_rule_stuff(df,post_results=None):
    if post_results is None:
        print('using test post results')
        post_results = get_sample_cluster_metrics_input()
    
    df = add_post_clusters(df,post_results)
    df = add_confounder_dose_limits(df)
    
    organs = post_results.get('organs',['IPC','MPC','SPC'])
    symptoms = post_results.get('symptoms',['drymouth'])
    organ_features = post_results.get('clusterFeatures',['V35','V40','V45','V55'])
    s_dates = post_results.get('symptom_dates',[13,33])
    threshold = post_results.get('threshold',5)
    cluster = post_results.get('cluster',None)
    maxdepth = post_results.get('max_depth',3)
    min_odds = post_results.get('min_odds',1)
    max_rules = post_results.get('max_rules',15)
    
    dose_df, outcome_df = get_rule_inference_data(
        df,
        organs,
        symptoms,
        organ_features,
        s_dates,
        cluster=cluster,
    )
    y = (outcome_df>=threshold)
    if cluster is None:
        granularity = 5
    else:
        granularity = 2
    rules = get_rule_df(dose_df,y,min_odds=1,granularity=granularity)
    sort_rules = lambda rlist: sorted(rlist, key=lambda x: -x['odds_ratio'])
    rules = sort_rules(rules)
    rules = rules[:max_rules]
    frontier = [None]
    best_rules = []
    depth = 0
    while (depth < maxdepth) and (frontier is not None) and (len(frontier) > 0):
        frontier = get_best_rules(frontier,rules,dose_df,y,min_odds=min_odds)
        depth += 1
        best_rules.extend(frontier[:max_rules])
    best_rules = joblib.Parallel(n_jobs=4)(joblib.delayed(format_rule_json)(br) for br in best_rules)
    best_rules = sort_rules(best_rules)
    return best_rules[:max_rules]