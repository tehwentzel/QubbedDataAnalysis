import * as constants from './Constants';
import * as d3 from 'd3';
const querystring = require('querystring');

export default class DataService {

    constructor(args){
        this.axios = require('axios');
        this.api = this.axios.create({
            baseURL: constants.API_URL,
        })
    }

    getParamList(pObj){
        let newParams = {}
        let empty= true;
        for(let k of Object.keys(pObj)){
            if(pObj[k] !== undefined & pObj[k] !== null){
                newParams[k] = pObj[k];
                empty = false;
            }
        }
        let paramQuery = '';
        if(!empty){
            let pstring = querystring.stringify(newParams);
            paramQuery = paramQuery + '?' + pstring
        }
        return paramQuery
    }

    async testPost(data){
        console.log('testing post')
        if(data === undefined){
            data = {'test': [1,2,3,4,4],'test2': 'lol'}
        }
        try{
            this.api.post('/test', data).then(response => {
                console.log('test post respsonse',response)
            }).catch(error => {
                console.log('test post error',error);
            })
        } catch(error){
            console.log(error)
        }
    }

    async getDoseJson(){
        try{
            const dDataResponse = await this.api.get('/doses');
            // console.log('dose data');
            // console.log(dDataResponse);
            return dDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getClusterMetrics(clusterData,organs,lrtConfounders,symptoms){
        let postData = {
            'clusterData': clusterData,
            'organs': organs,
            'lrtConfounders':lrtConfounders,
            'symptoms': symptoms,
        }
        console.log('post data',postData)
        try{
            const response = await this.api.post('/cluster_metrics', postData);
            console.log('cluster metrics response',response.data);
            return response.data;
        } catch(error){
            console.log(error);
        }

    }

    async getClusterRules(clusterData,organs,symptoms,organFeatures,threshold,cluster){
        let postData = {
            'clusterData': clusterData,
            'organs': organs,
            'symptoms': symptoms,
            'clusterFeatures': organFeatures,
            'threshold': threshold,
            'cluster': cluster,
        }
        let goodPostData = {}
        for(let key of Object.keys(postData)){
            let entry = postData[key];
            if(entry !== undefined){
                goodPostData[key] = entry
            }
        }
        // console.log('rule post data',goodPostData)
        if(goodPostData.clusterData === undefined){
            return undefined
        }
        try{
            const response = await this.api.post('/rules', goodPostData);
            // console.log('rules response',response.data);
            return response.data;
        } catch(error){
            console.log(error);
        }

    }

    async getDoseClusterJson(organs,nClusters,clusterFeatures,clusterType,lrtConfounders,symptoms){
        try{
            var params = {
                'organs': organs,
                'nClusters':nClusters,
                'clusterFeatures':clusterFeatures,
                'clusterType':clusterType,
                'confounders':lrtConfounders,
                'symptoms':symptoms,
            }
            let qstring = '/dose_clusters';
            qstring += this.getParamList(params)
            // console.log('clusterstring',qstring)
            const dDataResponse = await this.api.get(qstring);
            // console.log('dose cluster data');
            // console.log(dDataResponse);
            return dDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getAdditiveOrganClusterEffects(baseOrgans,nClusters,features,clusterType,
        symptoms,confounders,threshold,dropBaseCluster){
        try{
            let params = {
                symptoms:symptoms,
                clusterType:clusterType,
                nClusters:nClusters,
                features:features,
                baseOrgans:baseOrgans,
                confounders:confounders,
                threshold:threshold,
                dropBaseCluseter:dropBaseCluster,
            }
            let qstring = '/single_organ_effects';
            qstring += this.getParamList(params);
            console.log('additiveClusterString',qstring)
            const dataResponse = await this.api.get(qstring);
            console.log('additiveClusterEffectData',dataResponse);
            return dataResponse
        }catch(error){
            console.log('error getting additive cluster effects',error);
        }
    }


    async getOrganJson(){
        try{
            const oDataResponse = await this.api.get('/organ_values_denoised');
            console.log('organ data');
            console.log(oDataResponse);
            return oDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getOrganClusterJson(){
        try{
            const oDataResponse = await this.api.get('/organ_clusters');
            console.log('organ clusters');
            console.log(oDataResponse);
            return oDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getSymptomJson(){
        try{
            const sDataResponse = await await this.api.get('/mdasi');
            console.log('symptom data');
            console.log(sDataResponse);
            return sDataResponse;
        } catch(error){
            console.log(error)
        }
    }

    async getSymptomClusterJson(){
        try{
            const sDataResponse = await await this.api.get('/symptom_clusters');
            console.log('symptom clusters');
            console.log(sDataResponse);
            return sDataResponse;
        } catch(error){
            console.log(error)
        }
    }


}