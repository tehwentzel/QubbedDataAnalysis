import './App.css';

import React, {useEffect, useState} from 'react';
import DataService from './modules/DataService';
import Utils from './modules/Utils';
import DoseView from './components/DoseView.js';
import ClusterControlPanel from './components/ClusterControlPanel.js';
import OverView from './components/OverView.js';
import SymptomPlotD3 from './components/SymptomPlotD3.js';

import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import * as constants from './modules/Constants.js';
import { Spinner } from 'react-bootstrap';
import * as d3 from 'd3';

function App() {
  var api = new DataService();
  //data with entries for each patient
  const [doseData,setDoseData] = useState(null);
  //agregated data with stats for each cluster ,including ids
  const [clusterData,setClusterData] = useState(null);
  //organs used to cluster the patients
  const [clusterOrgans,setClusterOrgans] = useState([
    'Hard_Palate',
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
  const [clusterFeatures,setClusterFeatures] = useState(['V25','V30','V35','V40','V45','V50','V55','V60']);
  //used to determine the confounders used in the models for determining p-values
  const [lrtConfounders,setLrtConfounders] = useState([
    't_severe',
    'n_severe',
    'hpv',
    'BOT','Tonsil',
    'age_65',
    'Parotid_Gland_limit',
    'performance_1','performance_2',
  ]);

  const [endpointDates,setEndpointDates] = useState([33]);
  //which variable is being ploted when showing patient dose distirbutions
  const [plotVar,setPlotVar] = useState('V55');

  //in progress, should toggle if the dose cluster show labels for organs?
  const [showOrganLabels,setShowOrganLabels] = useState(true);
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
  
  //which symptoms we're including in the plots
  const [symptomsOfInterest,setSymptomsOfInterest] = useState([
    'drymouth',
    'salivary_mean',
    'salivary_max',
    'taste',
    'swallow',
    'voice',
    'mucus',
    'mucositis',
    'choke',
    'pain',
    'teeth',
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
  
  //this is theoreticall better than static 100 in case it goes really high?
  const [maxDose, setMaxDose] = useState(100);
  const doseColor = d3.interpolateReds;
  // function doseColor(v){
  //   return d3.interpolateReds(v/100);
  // }
  // const [doseColor,setDoseColor] = useState(() => getDoseColor);
  
  //hnc diagram svg patths
  const [svgPaths,setSvgPaths] = useState();


  //this use to be d3.scaleOrdinal but it wasn't wokring for some reason
  //returns color based on index bascially
  const categoricalColors = (i) => {
    let colors = ['#1b9e77','#d95f02','#7570b3','#e7298a','#e6ab02','#999999','#666666'];
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
    //There is a copy of this in DoseEffectView that needs seperate updating
    //transfering it down doest update it properly for some reason I checked
    if(clusterData !== undefined & org !== undefined & constants.ORGANS_TO_SHOW.indexOf(org) >= 0){
      let newCue = [];

      for(let o of clusterOrganCue){ newCue.push(o); }

      if(clusterOrganCue.length < 1 | clusterOrganCue.indexOf(org) < 0){
        newCue.push(org);
        setClusterOrganCue(newCue);
      } else{
        newCue = newCue.filter(x=>x!==org);
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

  var fetchDoseClusters = async(org,nClust,clustFeatures,clusterType,confounders,symptoms,dates) => {
    setClusterData();
    setClusterDataLoading(true);
    // console.log('clustering with organs', org)
    const response = await api.getDoseClusterJson(org,nClust,clustFeatures,clusterType,confounders,symptoms,dates);
    // console.log('cluster data',response.data);
    setClusterData(response.data);
    setClusterDataLoading(false);
    resetSelections();
  }

  var fetchAdditiveEffects= async(org,nClust,clustFeatures,clusterType,symp,lrtConfounders,thresholds,useAllClusters,dates) => {
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
      dates,
    );
    // console.log('fetched addtive',response.data);
    setAdditiveClusterResults(response.data);
  }



  useEffect(() => {

    fetchDoseData(clusterOrgans,clusterFeatures);
    fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest,endpointDates);
    fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,mainSymptom,lrtConfounders,[additiveClusterThreshold],additiveCluster,endpointDates);
  },[])


  useEffect(() => {
    if(clusterData !== undefined & clusterData !== null){
      // console.log('cluster organ query', clusterOrgans)
      fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders,symptomsOfInterest,endpointDates);
    }
  },[clusterOrgans,nDoseClusters,clusterFeatures,clusterType,symptomsOfInterest])

  useEffect(function updateDoses(){
    if(!clusterDataLoading & clusterData !== undefined){
      fetchDoseData(clusterOrgans,clusterFeatures)
    }
  },[clusterOrgans,clusterFeatures])

  // useEffect(function clearCue(){
  //   setClusterOrganCue(new Array());
  // },[clusterOrgans])

  useEffect(function updateEffect(){
    if(clusterData !== undefined & !clusterDataLoading){
      fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,mainSymptom,lrtConfounders,[additiveClusterThreshold],additiveCluster,endpointDates);
    }
  },[clusterDataLoading,clusterData,mainSymptom,clusterDataLoading,lrtConfounders,additiveClusterThreshold,additiveCluster,endpointDates])

  function makeOverview(state,showToggle=true){
    return (
      <Row style={{'height': 'var(section-height)','overflowY':'hidden'}} 
        className={'noGutter'} 
        lg={12}
      >
        <OverView
            api={api}
            doseData={doseData}
            defaultState={state}
            clusterData={clusterData}
            showToggle={showToggle}
            clusterDataLoading={clusterDataLoading}
            selectedPatientId={selectedPatientId}
            setSelectedPatientId={setSelectedPatientId}
            plotVar={plotVar}
            clusterOrgans={clusterOrgans}
            clusterOrganCue={clusterOrganCue}
            setClusterOrganCue={setClusterOrganCue}
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
            lrtConfounders={lrtConfounders}
            nDoseClusters={nDoseClusters}
            additiveCluster={additiveCluster}
            additiveClusterThreshold={additiveClusterThreshold}
            setAdditiveCluster={setAdditiveCluster}
            setAdditiveClusterThreshold={setAdditiveClusterThreshold}
            nDoseCluster={nDoseClusters}
            showOrganLabels={showOrganLabels}
            setShowOrganLabels={setShowOrganLabels}
            doseColor={doseColor}
            endpointDates={endpointDates}
            setEndpointDates={setEndpointDates}
        ></OverView>
    </Row>
    )
  }

  function makeSymptomPlot(){
    if(clusterData !== undefined & doseData != undefined & !clusterDataLoading){
      return (
        <Container>
            <span className={'centerText controlPanelTitle'}>
              {Utils.getVarDisplayName(mainSymptom) + ' Trajectory vs Time'}
            </span>
            <SymptomPlotD3
                doseData={doseData}
                clusterData={clusterData}
                selectedPatientId={selectedPatientId}
                setSelectedPatientId={setSelectedPatientId}
                plotVar={plotVar}
                clusterOrgans={clusterOrgans}
                activeCluster={activeCluster}
                setActiveCluster={setActiveCluster}
                mainSymptom={mainSymptom}
                categoricalColors={categoricalColors}
                
            ></SymptomPlotD3>
        </Container>
      )
    } else{
      return (
        <Container className={'noGutter fillSpace'}>
          <span className={'centerText controlPanelTitle'}>
                {'Symptom Trajectory vs Time'}
            </span>
          <Spinner as={'span'}></Spinner>
        </Container>
      )
    }
  }

  return (
    <div className="App">

        <Container className={'fillSpace noGutter'} lg={12}>
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
                  mainSymptom={mainSymptom}
                  setMainSymptom={setMainSymptom}
                  setClusterType={setClusterType}
                  symptomsOfInterest={symptomsOfInterest}
                  setSymptomsOfInterest={setSymptomsOfInterest}
                  lrtConfounders={lrtConfounders}
                  setLrtConfounders={setLrtConfounders}
                  showContralateral={showContralateral}
                  setShowContralateral={setShowContralateral}
                  allSymptoms={allSymptoms}
                  showOrganLabels={showOrganLabels}
                  setShowOrganLabels={setShowOrganLabels}
                  doseColor={doseColor}
                  maxDose={maxDose}
                  endpointDates={endpointDates}
                  setEndpointDates={setEndpointDates}
                ></ClusterControlPanel>
          </Row>
          <Row id={'mainVis'} className={'noGutter'} lg={12}>   
            <Col fluid={'true'} className={'fillHeight noGutter'} lg={6}>
                {makeOverview('effect',false)}
                {makeOverview('rules',false)}
            </Col>  
            <Col className={'noGutter'} lg={6}>
              <Row className={'clusterContainer vizComponent noGutter scroll'} lg={12}>
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
                    showOrganLabels={showOrganLabels}
                    setShowOrganLabels={setShowOrganLabels}
                    doseColor={doseColor}
                    endpointDates={endpointDates}
                    setEndpointDates={setEndpointDates}
                    maxDose={maxDose}
                    setMaxDose={setMaxDose}
                ></DoseView>
              </Row>
              <Row className={'clusterContainer noGutter'} lg={12}>
                {makeOverview('symptom',true)}
              </Row>
            </Col>
          </Row>
      </Container>
    </div>
  );
}

export default App;
