import './App.css';

import React, {useEffect, useState} from 'react';
import DataService from './modules/DataService';
import DoseView from './components/DoseView.js';
import NavBar from './components/NavBar';
import ClusterControlPanel from './components/ClusterControlPanel.js';
import PatientDoseView from './components/PatientDoseView.js';
import OverView from './components/OverView.js';

import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import * as constants from './modules/Constants.js';
import * as d3 from 'd3';
import { active } from 'd3';

function App() {
  var api = new DataService();

  //data with entries for each patient
  const [doseData,setDoseData] = useState(null);
  //agregated data with stats for each cluster ,including ids
  const [clusterData,setClusterData] = useState(null);
  //organs used to cluster the patients
  const [clusterOrgans,setClusterOrgans] = useState([
    'Tongue',
    'Rt_Parotid_Gland','Lt_Parotid_Gland',
    'Rt_Submandibular_Gland','Lt_Submandibular_Gland',
  ])
  //used to hold the organs we select for the next time we query the clustering
  const [clusterOrganCue,setClusterOrganCue] = useState([])
  //used to check if we're waiting for new clusters so we don't query anything else in the meaning
  const [clusterDataLoading, setClusterDataLoading] = useState(false);
  //# of clusters used
  const [nDoseClusters,setNDoseClusters] = useState(3);
  //which dose features we use for each organ
  const [clusterFeatures,setClusterFeatures] = useState(['V35','V40','V45','V50','V55','V60']);
  //used to determine the confounders used in the models for determining p-values
  const [lrtConfounders,setLrtConfounders] = useState([
    't_severe',
    'n_severe',
    'hpv',
    'BOT','Tonsil',
    'Parotid_Gland_limit',
    'performance_1','performance_2',
  ]);
  //which variable is being ploted when showing patient dose distirbutions
  const [plotVar,setPlotVar] = useState('V55');
  //which cluster is the focus on in the detail views
  const [activeCluster,setActiveCluster] = useState(0);
  // const [updateCued,setUpdateCued] = useState(false)
  //which patient is focused on in detail views when appropriate
  const [selectedPatientId, setSelectedPatientId] = useState(-1);
  //what type of clustering to use.  bgmm = bayesian gaussian mixutre model.
  const [clusterType,setClusterType] = useState('bgmm');
  //wheter to show one or both sides of the head in the dose diagram.  probably should always be true
  const [showContralateral,setShowContralateral] = useState(true);
  //data results from testin the effects of other organs on clustering results
  const [additiveClusterResults,setAdditiveClusterResults] = useState(null);
  const [additiveClusterThreshold,setAdditiveClusterThreshold] = useState(5);
  //false = use highest dose cluster, ture = use all clusters
  const [additiveCluster, setAdditiveCluster] = useState(false);
  //I dont think I use this
  const [clusterMetricData,setClusterMetricData] = useState(null);
  //which symptoms we're including in the plots
  const [symptomsOfInterest,setSymptomsOfInterest] = useState([
    'drymouth',
    'salivary_mean',
    'salivary_max',
    'taste',
    'swallow',
    'voice',
    'mucositis',
    'choke',
    'pain',
  ]);
  //all possible symptoms I coded into the data
  const allSymptoms = [
    'drymouth',
    'salivary_mean',
    'salivary_max',
    'throat_mean',
    'throat_max',
    'mouth_max',
    'mouth_mean',
    'core_mean',
    'core_max',
    'interference_mean',
    'interference_max',
    'hnc_mean',
    'hnc_max',
    'teeth',
    'taste',
    'swallow',
    'choke',
    'voice',
    'mucus',
    'mucositis',
    'nausea',
    'vomit',
    'appetite',
    'pain',
  ]
  const [mainSymptom,setMainSymptom] = useState('drymouth');


  const [metricsModelType,setMetricsModelType] = useState('regression');
  //hnc diagram svg patths
  const [svgPaths,setSvgPaths] = useState();


  //this use to be d3.scaleOrdinal but it wasn't wokring for some reason
  //returns color based on index bascially
  const categoricalColors = (i) => {
    let colors = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628',,'#f781bf','999999'];
    let ii = Math.round(i);
    if(ii < 0 | ii > colors.length - 1){
      return 'black';
    }
    return colors[ii];
  }
  function resetSelections(){
    setActiveCluster(0);
    setSelectedPatientId(-1);
  }

  function updateClusterOrgans(){
    if(!clusterDataLoading & clusterData !== undefined){

      let cue = [];
      for(let o of clusterOrganCue){ cue.push(o); }
      if(cue.length > 0){
        // console.log('new cluster organs',cue)
        setClusterOrgans(cue);
      }
    }
  }

  function addOrganToCue(org){
    if(clusterData !== undefined){
      let newCue = [];
      for(let o of clusterOrganCue){ newCue.push(o); }

      if(clusterOrganCue.length < 1 | clusterOrganCue.indexOf(org) < 0){
        newCue.push(org);
        setClusterOrganCue(newCue);
      } else{
        newCue = newCue.filter(x=>x!=org);
        setClusterOrganCue(newCue);
      }
    }
  }

  useEffect(()=>{
      fetch('organ_svgs/organ_svg_paths.json').then((newPaths)=>{
          newPaths.json().then((data)=>{
              setSvgPaths(data);
          })
      })
  },[])

  
  var fetchDoseData = async(orgs,cFeatures) => {
    const response = await api.getDoseJson(orgs,cFeatures);
    setDoseData(response.data);
  }

  var fetchDoseClusters = async(org,nClust,clustFeatures,clusterType,confounders,symptoms) => {
    setClusterData();
    setClusterDataLoading(true);
    // console.log('clustering with organs', org)
    const response = await api.getDoseClusterJson(org,nClust,clustFeatures,clusterType,confounders,symptoms);
    // console.log('cluster data',response.data);
    setClusterData(response.data);
    setClusterDataLoading(false);
    resetSelections();
  }

  var fetchAdditiveEffects= async(org,nClust,clustFeatures,clusterType,symp,lrtConfounders,thresholds,useAllClusters) => {
    setAdditiveClusterResults(undefined);
    // console.log('aadditive clusters',clusters)
    if(clusterDataLoading){ return; }
    var clusters;
    if(useAllClusters){
      clusters = [-1];
    } else{
      clusters = [nDoseClusters-1]
    }
    const response = await api.getAdditiveOrganClusterEffects(
      org,
      nClust,
      clustFeatures,
      clusterType,
      symp,
      lrtConfounders,
      thresholds,
      clusters,
    );
    // console.log('fetched addtive',response.data);
    setAdditiveClusterResults(response.data);
  }

  var fetchClusterMetrics = async(cData,lrtConfounders,symptom,mType)=>{
    if(cData !== undefined & !clusterDataLoading){
      // const response = await api.getClusterMetrics(cData,organs,lrtConfounders,symptoms);
      // setClusterMetricData(response);
      // console.log('cluster metric data', response)
      api.getClusterMetrics(cData,lrtConfounders,symptom,mType).then(response =>{
        // console.log('cluster metric data',response)
        setClusterMetricData(response);
      }).catch(error=>{
        console.log('cluster metric data error',error);
      })
    }  
  }

  


  useEffect(() => {

    fetchDoseData(clusterOrgans,clusterFeatures);
    fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest);
    fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,mainSymptom,lrtConfounders,[additiveClusterThreshold],additiveCluster);
  },[])


  useEffect(() => {
    if(clusterData !== undefined & clusterData !== null){
      // console.log('cluster organ query', clusterOrgans)
      fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest);
    }
  },[clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest])

  useEffect(function updateDoses(){
    if(!clusterDataLoading & clusterData !== undefined){
      fetchDoseData(clusterOrgans,clusterFeatures)
    }
  },[clusterOrgans,clusterFeatures])

  useEffect(function clearCue(){
    setClusterOrganCue(new Array());
  },[clusterOrgans])

  useEffect(function updateEffect(){
    if(clusterData !== undefined & !clusterDataLoading){
      fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,mainSymptom,lrtConfounders,[additiveClusterThreshold],additiveCluster);
    }
  },[clusterDataLoading,clusterData,mainSymptom,clusterDataLoading,lrtConfounders,additiveClusterThreshold,additiveCluster])

  
  useEffect(()=>{
    if(!clusterDataLoading & clusterData !== undefined & clusterData !== null){
      fetchClusterMetrics(clusterData, lrtConfounders,mainSymptom,metricsModelType);
    }
  },[clusterDataLoading,clusterData,mainSymptom,lrtConfounders,metricsModelType]);
  
  
  
  

  function makeOverview(){
    return (
      <Row style={{'height': '50vh','overflowY':'hidden'}} className={'noGutter'} lg={12}>
        <OverView
            api={api}
            doseData={doseData}
            clusterData={clusterData}
            clusterDataLoading={clusterDataLoading}
            selectedPatientId={selectedPatientId}
            setSelectedPatientId={setSelectedPatientId}
            plotVar={plotVar}
            clusterOrgans={clusterOrgans}
            activeCluster={activeCluster}
            svgPaths={svgPaths}
            mainSymptom={mainSymptom}
            setMainSymptom={setMainSymptom}
            setActiveCluster={setActiveCluster}
            clusterFeatures={clusterFeatures}
            symptomsOfInterest={symptomsOfInterest}
            allSymptoms={allSymptoms}
            additiveClusterResults={additiveClusterResults}
            categoricalColors={categoricalColors}
            clusterMetricData={clusterMetricData}
            setClusterMetricData={setClusterMetricData}
            // ruleData={ruleData}
            // ruleThreshold={ruleThreshold}
            // ruleCluster={ruleCluster}
            // setRuleThreshold={setRuleThreshold}
            // setRuleCluster={setRuleCluster}
            // maxRules={maxRules}
            // setMaxRules={setMaxRules}
            // ruleMaxDepth={ruleMaxDepth}
            // setRuleMaxDepth={setRuleMaxDepth}
            // ruleCriteria={ruleCriteria}
            // setRuleCriteria={setRuleCriteria}
            // ruleTargetCluster={ruleTargetCluster}
            // setRuleTargetCluster={setRuleTargetCluster}
            // ruleUseAllOrgans={ruleUseAllOrgans}
            // setRuleUseAllOrgans={setRuleUseAllOrgans}
            additiveCluster={additiveCluster}
            additiveClusterThreshold={additiveClusterThreshold}
            setAdditiveCluster={setAdditiveCluster}
            setAdditiveClusterThreshold={setAdditiveClusterThreshold}
            nDoseCluster={nDoseClusters}
        ></OverView>
    </Row>
    )
  }
  return (
    <div className="App">

        <Row className={'fillSpace noGutter'} lg={12}>
          <Col style={{'height':'100vh'}} id={'clusterCol'} fluid={'true'} className={'noGutter'} lg={6}>
            <Row id={'clusterControlPanelContainer'} className={'noGutter'} lg={12}>
                <ClusterControlPanel
                  nDoseCluster={nDoseClusters}
                  setNDoseClusters={setNDoseClusters}
                  clusterFeatures={clusterFeatures}
                  setClusterFeatures={setClusterFeatures}
                  clusterDataLoading={clusterDataLoading}
                  setClusterDataLoading={setClusterDataLoading}
                  updateClusterOrgans={updateClusterOrgans}
                  plotVar={plotVar}
                  setPlotVar={setPlotVar}
                  clusterType={clusterType}
                  setClusterType={setClusterType}
                  symptomsOfInterest={symptomsOfInterest}
                  setSymptomsOfInterest={setSymptomsOfInterest}
                  lrtConfounders={lrtConfounders}
                  setLrtConfounders={setLrtConfounders}
                  showContralateral={showContralateral}
                  setShowContralateral={setShowContralateral}
                  allSymptoms={allSymptoms}
                ></ClusterControlPanel>
              </Row>
              <Row id={'clusterContainer'} className={'vizComponent noGutter scroll'} lg={12}>
                <DoseView
                  doseData={doseData}
                  clusterData={clusterData}
                  clusterOrgans={clusterOrgans}
                  addOrganToCue={addOrganToCue.bind(this)}
                  clusterOrganCue={clusterOrganCue}
                  nDoseClusters={nDoseClusters}
                  plotVar={plotVar}
                  svgPaths={svgPaths}
                  activeCluster={activeCluster}
                  setActiveCluster={setActiveCluster}
                  symptomsOfInterest={symptomsOfInterest}
                  showContralateral={showContralateral}
                  categoricalColors={categoricalColors}
                  mainSymptom={mainSymptom}
                  setMainSymptom={setMainSymptom}
                ></DoseView>
              </Row>    
          </Col>  
          <Col style={{'height': '100vh','overflowY':'hidden'}} className={'noGutter'} lg={6}>
            {makeOverview()}
            {makeOverview()}
        </Col>
      </Row>
    </div>
  );
}

export default App;
