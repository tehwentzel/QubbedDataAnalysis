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
from ast import literal_eval
import statsmodels.api as sm
import Metrics

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
    
def load_dose_symptom_data():
    data = pd.read_csv(Const.data_dir + 'dose_symptoms_merged.csv')
    to_drop = [c for c in data.columns if 'symptom' in c and ('symptoms_' not in c or 'original' in c)]
    data = data.drop(to_drop,axis=1)
    dose_cols = get_df_dose_cols(data)
    s_cols = get_df_symptom_cols(data) 
    for c in dose_cols + s_cols + ['mean_dose','volume','dates']:
        try:
            data[c] = data[c].apply(literal_eval)
        except Exception as e:
            print(c,e)
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

def var_test(df, testcol, ycol,xcols, 
             boolean=True,
             regularize = False,
             scale=True):
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
    if symptoms is None:
        symptoms = Const.symptoms[:]
    if nWeeks is None:
        nWeeks = [13,59]
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
        for threshold in [-1, 5, 7]:
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
        thresholds = [5,7]
    date_keys = [df.dates.iloc[0].index(week) for week in nWeeks if week in df.dates.iloc[0]]
    #calculate change from baseline instead of absolute
    get_symptom_change_max = lambda x: np.max([x[d]-x[0] for d in date_keys])
    get_symptom_max = lambda x: np.max([x[d] for d in date_keys])
    df = df.copy()
    clust_results = []
    
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
                     n_clusters = 4,
                     **kwargs):
    if organ_list is None:
        organ_list = Const.organ_list[:]
    clusterer = None
    if clustertype is not None:
        clusterer = keyword_clusterer(clustertype,n_clusters)
    df = add_sd_dose_clusters(df.copy(),
                              organ_subset = organ_list,
                              clusterer=clusterer,
                              n_clusters = n_clusters,
                              **kwargs)
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
                                      thresholds=[5,7],
                                      clust_key='dose_clusters',
                                      baselines=[False],
                                      nWeeks=sdates)
        df = get_cluster_lrt(df,
                              clust_key='dose_clusters',
                              confounders=confounders,
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
            unique = df[col].unique()
            entry = {}
            for val in unique:
                clust_entry[col+'_'+str(val)] = float((subdf[col] == val).sum())
                clust_entry[col+'_'+str(val)+'_mean'] = float((subdf[col] == val).mean())
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
          't4','n3','hpv','total_mean_dose',
          "BOT","Tonsil",
         ]
    df = df.copy()
    df['total_mean_dose'] = df.mean_dose.apply(lambda x: np.sum(x))
    results = []
    base_pval = 1
    completed_clusters = set([])
    
    clusterer = None
    if clustertype is not None:
        clusterer = keyword_clusterer(clustertype,n_clusters)
        
    for olist in olists:
        prefix = '_'.join(olist)+'_'
        df  = add_sd_dose_clusters(df,
                                     features = features,
                                     organ_subset=olist,
                                     prefix=prefix,
                                    clusterer=clusterer,
                                     n_clusters=n_clusters,
            )
        clustname = prefix+'dose_clusters'
        xvals = []
        for cval in df[clustname].unique():
            if cval == 0 and drop_base_cluster:
                continue
            df['x'+str(cval)] = (df[clustname] == cval).astype(int)
            xvals.append('x'+str(cval))
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
    #sort by effect size of highest-dose cluster
    results= sorted(results,key=lambda x: -x['ttest_tval_x'+str(n_clusters-1)])
    return results