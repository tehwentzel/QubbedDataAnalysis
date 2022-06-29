import numpy as np
import pandas as pd

from SymptomPreprocessing import load_mdasi, impute_and_group, df_symptom_names

import Metrics 
import Utils
import Cluster
from Constants import Const

from sklearn.mixture import GaussianMixture, BayesianGaussianMixture

from xml.dom import minidom
from svgpath2mpl import parse_path
import matplotlib.patches as mpatches
import matplotlib.path as mpath
import matplotlib.transforms as mplt
import matplotlib as mpl

def rolled_up_dvh_valdf(rds,cols=None):
    #returns a dvh df with organ values rolled up nicely
    #note, currently uses string sort so idk how to make the order nice right now
    if cols == None:
        cols = rds.dvh_df.columns
    cols = sorted((set(cols) - set(['ROI','Structure','id'])).intersection(set(rds.dvh_df.columns)))
    vdf = rds.get_value_array(cols,as_df=True)
    olist = rds.organ_list
    vallist=[]
    for col in list(cols):
        #organ values in order
        colnames = [o + '_' + col for o in olist]
        valdf = vdf[colnames].sort_index()
        vals = valdf.values.tolist()
        vallist.append(vals)
    valdf = pd.DataFrame(np.swapaxes(np.array(vallist),0,1).tolist(),index=vdf.index,columns=cols)
    return valdf

def merge_dose_symptom_dfs(imputed_symptom_df,rds,dvh_cols=None,roll_up=True):
    n_id = lambda d: len(d.reset_index().id.unique())
    if roll_up:
        dose_df= rolled_up_dvh_valdf(rds,cols=dvh_cols)
    else:
        dose_df = rds.get_value_array(rds.dvh_df.columns,keep_2d=True,as_df=True)
    n_dose = n_id(dose_df)
    n_imputed = n_id(imputed_symptom_df)
    dose_df.index = dose_df.index.astype('int')
    merged = dose_df.merge(imputed_symptom_df.set_index('id'),on='id',how='inner')
    n_merged = n_id(merged)
    print('dose ids:',n_dose,'syptom ids:',n_imputed,'merged ids:',n_merged)
    return merged

def get_merged_symp_dose_df(rds=None,use_lstm=False,required=None,required_late=None,**kwargs):
    if rds is None:
        rds = RadDataset()

    df = load_mdasi(use_lstm=use_lstm,required=required,required_late=required_late)
#     imputed_df = df.fillna(0)
    imputed_df = impute_and_group(df,skip_inpute=use_lstm,use_domains=False)
    merged = merge_dose_symptom_dfs(imputed_df,rds,**kwargs)
    return merged


def df_to_symptom_array(df,use_groups = True, use_domains = False, simplify = False):
    df = df.copy()
    #determines if we use 3 the
    symptom_cols = df_symptom_names(df,use_groups=use_groups,use_domains=use_domains)
    def stack_row(row):
        vals = np.stack(row.values)
        return vals
    vals = np.stack(df[symptom_cols].apply(stack_row,axis=1).values)
    return vals

def add_sd_dose_clusters(sddf, 
                         clusterer = None,
                         features=None,
                         reducer=None,
                         organ_subset=None,
                         normalize = True,
                         prefix='',
                         return_score=False,
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
    if return_score:
        score = clusterer.score_samples(vals).mean()
        return new_df, score
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

# def reorder_clusters(df,cname,by='moderate_6wk_symptoms'):
#     df = df.copy()
#     severities = {}
#     clusts = sorted(df[cname].unique())
#     getmean = lambda d: d[by].mean()
#     if Utils.iterable(df[by].iloc[0]):
#         getmean = lambda d: np.stack(d[by].apply(lambda x: np.array(x).sum()).values).mean()
#     for c in clusts:
#         subset = df[df[cname] == c]
#         avg_severity = getmean(subset)
#         severities[c] = avg_severity
#     clust_order = np.argsort(sorted(severities.keys(), key = lambda x: severities[x]))
#     clust_map = {c: clust_order[i] for i,c in enumerate(clusts)}
#     df[cname] = df[cname].apply(lambda x: clust_map.get(x))
#     return df

# def add_sd_symptom_clusters(sddf,
#                             use_groups = True,
#                             use_domains=False,
#                             sim_func = None, 
#                             n = 5, 
#                             link='ward',
#                             n_timesteps=9,
#                             simplify=True,
#                            ):
#     array = df_to_symptom_array(sddf,
#                                 use_groups = use_groups,
#                                 use_domains=use_domains, 
#                                 simplify = simplify)
#     end = min(n_timesteps, array.shape[-1])
#     x = array[:,:,0:end]
#     if sim_func is None:
#         print('using default similarity')
#         sim_func = Metrics.DTWd2d()
    
#     clusterer = Cluster.SimilarityClusterer(n,link=link)
#     sim = sim_func.get_similarity_matrix(x)
#     clusters = clusterer.fit_predict(sim)
    
#     #reorder clusters so larger == higher average rating
#     cluster_severities = {}
#     clusts = np.unique(clusters)
#     for c in clusts:
#         subset = x[np.argwhere(clusters  == c).ravel()]
#         #metric is take highest rating per patient and then average over the cluster
#         avg_severity = subset.max(axis=1).max(axis=1).mean()
#         cluster_severities[c] = avg_severity
#     clust_order = np.argsort(sorted(cluster_severities.keys(), key = lambda x: cluster_severities[x]))
#     clust_map = {c: clust_order[i] for i,c in enumerate(clusts)}
#     ordered_clusts = np.array([clust_map.get(x) for x in clusters]).astype(int)
    
#     new_df = sddf.copy()
#     new_df['symptom_clusters'] = ordered_clusts
#     return new_df

# def add_sd_clusters(sddf):
#     df = add_sd_symptom_clusters(sddf)
#     df = add_sd_dose_clusters(df)
#     return df

def get_symptoms_max(df,
                     symptom_prefix='symptoms',
                     merge_symptoms = [
                     ],
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
            values = row[colname]
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
    return temp_df

def load_organ_svg_file(svg_file,olist=None,keep_center = None):
    doc = minidom.parse(svg_file)
    paths = {p.getAttribute('id'): p.getAttribute('d') for p in doc.getElementsByTagName('path')}
    valid = lambda x: x in olist
    #temp thing where i skip the middle stuff for side view
    if keep_center is None:
        keep_center = 'center' in svg_file or 'both' in svg_file
    if not keep_center:
        valid = lambda x: ('Rt_' in str(x) or 'Lt_' in str(x))
        paths = {k:v for k,v in paths.items() if valid(k)}
    if olist is not None:
        paths = {k:v for k,v in paths.items() if k in olist}
    return paths

def load_organ_paths(files=None,olist=None):
    #the one I actually use
    if files is None:
        files = ['hnc_organs_center.svg',
                 'hnc_organs_right.svg',
                 'hnc_organs_left.svg'
                ]
        files = [Const.resource_dir + f for f in files]
    merged_dict = {}
    for file in files:
        try:
            d = load_organ_svg_file(file,olist,keep_center='center' in file)
            for k,v in d.items():
                merged_dict[k] = v
        except Exception as e:
            print(e)
    return merged_dict

#these were an attempt at centering the group of svg paths
#the code works in theory if you use it as a point cloud and apply a transform
#but in whatever coordinate system svg uses it makes it all messed up
#so just do the centering once in inscape
def parse_mpath_points(path):
    #gets a pointlist from an svg path
    #assuming format m x,y x2,y2 ... z
    path = path.split(' ')
    points = []
    for p in path:
        plist = p.split(',')
        if len(plist) == 2:
            points.append([float(i) for i in plist])
    return points

def transform_mpath_points(path,offset):
    #gets a pointlist from an svg path
    #assuming format m x,y x2,y2 ... z
    path = path.split(' ')
    newpath = ''
    for p in path:
        if len(newpath) > 0:
            newpath += ' '
        plist = p.split(',')
        if len(plist) == 2:
            vals = np.array([float(i) for i in plist])
            vals = vals+offset
            newpath += ','.join([str(i) for i in vals])
        else:
            newpath += p
        
    return newpath

def points_to_mpath(pointlist):
    string = 'm'
    for p in pointlist:
        point = ','.join([str(i) for i in p])
        string += ' ' + point
    string += ' z'
    return string

def get_centered_svgpaths(file,as_path=True):
    paths = load_organ_svg_file(file)
    opaths = {o:parse_mpath_points(v) for o,v in paths.items()}
    all_points = np.vstack([np.array(v) for v in opaths.values()])
    center = (all_points.max(axis=0) + all_points.min(axis=0))/2
    center = all_points.mean(axis=0)
    center = np.array([-center[1],center[0]])
#     return {k:transform_mpath_points(v,-center) for k,v in paths.items()}
    centered = {k:(np.array(v)).tolist() for k,v in opaths.items()}
    if as_path:
        centered = {k: points_to_mpath(v) for k,v in centered.items()}
    return centered

def center_scale_path(path,scale):
    bbox = path.get_extents()
    left = (1-scale)*(bbox.x0 + bbox.x1)/2
    up = (1-scale)*(bbox.y0 + bbox.y1)/2
    tform = mplt.Affine2D().scale(scale) + mplt.Affine2D().translate(left,up) 
    path2 = mplt.TransformedPath(path,tform)
    return path2.get_fully_transformed_path()