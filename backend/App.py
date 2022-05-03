from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
from Utils import *
from AppApi import *

app = Flask(__name__)
CORS(app)
print('code yay')

data = load_dose_symptom_data()

def as_float(item):
    if item is None:
        return item
    try:
        item = float(item)
        return item
    except:
        return None

def responsify(dictionary):
    # djson = nested_responsify(dictionary) #simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    djson = simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    resp = app.response_class(
        response=djson,
        mimetype='application/json',
        status=200
    )
    return resp

def nested_responsify(dictionary):
    if isinstance(dictionary,list) or isinstance(dictionary,set):
        vals = [nested_responsify(x) for i,x in enumerate(dictionary)]
        return vals
    new_dict= {}
    for k,v in dictionary.items():
        if isinstance(v,dict):

            new_dict[k] = nested_responsify(v)
        else:
            new_dict[k] = v
    djson = simplejson.dumps(new_dict,default=np_converter,ignore_nan=True)
    return djson.replace('\\"','\"')

@app.route('/')
def test():
    return 'test succesful'

@app.route('/test',methods=['GET','POST'])
def test_post():
    data = request.get_json(force=True)
    print('_____________________')
    print('test post recieved',data)
    print('_____________________')
    return 'lol'

@app.route('/doses',methods=['GET'])
def get_doses_json():
    ddict = sddf_to_json(data)
    return responsify(ddict)

@app.route('/single_organ_effects',methods=['GET'])
def get_single_organ_effects():
    symptoms = request.args.getlist('symptoms')
    if len(symptoms) <= 0:
        symptoms=None

    organ_list = request.args.getlist('organs')
    if len(organ_list) <= 0:
        organ_list = None

    base_organs = request.args.getlist('baseOrgans')
    if len(base_organs) <= 0:
        base_organs = None

    features = request.args.getlist('features')
    if len(features) <= 0:
        features = None
    
    n_clusters = request.args.get('nClusters',4)
    clustertype = request.args.get('clusterType',None)
    drop_base_cluster=request.args.get('dropBaseCluster',False)
    threshold = request.args.get('threshold',None)

    threshold = as_float(threshold)
    if threshold is not None and threshold < 0:
        threshold = None

    if n_clusters is None:
        n_clusters = 0
    n_clusters = int(as_float(n_clusters))
    
    covars = request.args.getlist('confounders')
    if len(covars) <= 0:
        covars = None
    # print('effect covars',covars)
    vals = select_single_organ_cluster_effects(
        data,
        symptoms=symptoms,
        base_organs=base_organs,
        covars=covars,
        n_clusters=n_clusters,
        threshold=threshold,
        features=features,
        clustertype=clustertype,
        organ_list=organ_list,
        drop_base_cluster=drop_base_cluster,
    )

    response = responsify(vals)
    return response

@app.route('/cluster_metrics',methods=['POST'])
def cluster_metrics():
    data = request.get_json(force=True)
    print('______________')
    print('cluster metric data')
    print(data)
    if data['clusterData'] is not None:
        with open('cluster_post_test.json','w') as f:
            simplejson.dump(data,f)
    print('______________')
    res = app.response_class(
        response='no',
        mimetype='application/json',
        status=200
    )
    return res

@app.route('/dose_clusters',methods=['GET'])
def get_dose_cluster_json():
    organ_list = request.args.getlist('organs')
    if len(organ_list) <= 0:
        organ_list = None
    n_clusters = request.args.get('nClusters',4)
    clustertype = request.args.get('clusterType',None)
    # print('cluster type argument',clustertype)
    cluster_features = request.args.getlist('clusterFeatures')
    if len(cluster_features) <= 0:
        cluster_features = None

    covars = request.args.getlist('confounders')
    if len(covars) <= 0:
        covars = None

    symptoms = request.args.getlist('symptoms')
    if len(symptoms) <= 0:
        symptoms = None

    # print('cluster symptoms',symptoms)
    ddict = get_cluster_json(data,
        organ_list=organ_list,
        n_clusters=int(n_clusters),
        clustertype=clustertype,
        features=cluster_features,
        confounders=covars,
        symptoms=symptoms,
    )
    # print('features for clusering',cluster_features)
    response = responsify(ddict)
    # print('response',response)
    return response
    
@app.route('/organ_values',methods=['GET'])
def get_raw_organ_data():
    odict = read_json('../data/patient_organ_data.json')
    # print('odict', odict.keys())
    return responsify(odict)

@app.route('/organ_values_denoised',methods=['GET'])
def get_denoised_organ_data():
    odict = read_json('../data/patient_organ_data_denoised.json')
    # print('odict', odict.keys())
    return responsify(odict)

@app.route('/organ_clusters',methods=['GET'])
def get_organ_clusters():
    odict = read_json('../data/patient_organ_similarity.json')
    # print('organ similarity', odict.keys())
    return responsify(odict)

@app.route('/symptom_clusters',methods=['GET'])
def get_symtpom_clusters():
    sdict = read_json('../data/patient_symptom_similarity.json')
    # print('symptom_similarity',sdict.keys())
    return responsify(sdict)

@app.route('/mdasi',methods=['GET'])
def get_mdasi_data():
    sdict = read_json('../data/patients_symptom_data.json')
    return responsify(sdict)

