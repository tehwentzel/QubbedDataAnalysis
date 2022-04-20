from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
from Utils import *

app = Flask(__name__)
CORS(app)
print('code yay')

data = load_dose_symptom_data()

def responsify(dictionary):
    djson = nested_responsify(dictionary) #simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    resp = app.response_class(
        response=djson,
        mimetype='application/json',
        status=200
    )
    return resp

def nested_responsify(dictionary):
    if isinstance(dictionary,list) or isinstance(dictionary,set):
        return [nested_responsify(x) for x in dictionary]
    new_dict= {}
    for k,v in dictionary.items():
        if isinstance(v,dict):
            print(k,v)
            new_dict[k] = nested_responsify(v)
        else:
            new_dict[k] = v
    djson = simplejson.dumps(new_dict,default=np_converter,ignore_nan=True)
    return djson.replace('\\"','\"')

@app.route('/')
def test():
    return 'test succesful'

@app.route('/doses',methods=['GET'])
def get_doses_json():
    ddict = sddf_to_json(data)
    return responsify(ddict)

@app.route('/dose_clusters',methods=['GET'])
def get_dose_cluster_json():
    organ_list = request.args.get('organs',None)
    n_clusters = request.args.get('nClusters',4)
    ddict = get_cluster_json(data,organ_list=organ_list,n_clusters=n_clusters)
    retrn responsify(ddict)
    
@app.route('/organ_values',methods=['GET'])
def get_raw_organ_data():
    odict = read_json('../data/patient_organ_data.json')
    print('odict', odict.keys())
    return responsify(odict)

@app.route('/organ_values_denoised',methods=['GET'])
def get_denoised_organ_data():
    odict = read_json('../data/patient_organ_data_denoised.json')
    print('odict', odict.keys())
    return responsify(odict)

@app.route('/organ_clusters',methods=['GET'])
def get_organ_clusters():
    odict = read_json('../data/patient_organ_similarity.json')
    print('organ similarity', odict.keys())
    return responsify(odict)

@app.route('/symptom_clusters',methods=['GET'])
def get_symtpom_clusters():
    sdict = read_json('../data/patient_symptom_similarity.json')
    print('symptom_similarity',sdict.keys())
    return responsify(sdict)

@app.route('/mdasi',methods=['GET'])
def get_mdasi_data():
    sdict = read_json('../data/patients_symptom_data.json')
    return responsify(sdict)