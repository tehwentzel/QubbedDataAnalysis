import * as constants from './Constants';
import * as d3 from 'd3';
// const querystring = require('querystring');

export default class DataService {

    constructor(args){
        this.axios = require('axios');
        this.api = this.axios.create({
            baseURL: constants.API_URL,
        })
    }

    async getOrganJson(){
        try{
            const oDataResponse = await this.api.get('/organ_values');
            console.log('organ data');
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

}