from flask import Flask, jsonify, request
from flask_cors import CORS
import simplejson
from Utils import *

app = Flask(__name__)
CORS(app)
print('code yay')

def responsify(dictionary):
    djson = simplejson.dumps(dictionary,default=np_converter,ignore_nan=True)
    resp = app.response_class(
        response=djson,
        mimetype='application/json',
        status=200
    )
    return resp

@app.route('/')
def test():
    return 'test succesful'

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