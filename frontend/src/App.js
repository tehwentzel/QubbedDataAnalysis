

import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import * as constants from './modules/Constants.js';
import { Spinner } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Button from 'react-bootstrap/Button';

import * as d3 from 'd3';

import React, {useEffect, useState} from 'react';
import DataService from './modules/DataService';
import Utils from './modules/Utils';
import DoseView from './components/DoseView.js';
import ClusterControlPanel from './components/ClusterControlPanel.js';
import OverView from './components/OverView.js';
import DoseEffectView from './components/DoseEffectView.js';
import SymptomPlotD3 from './components/SymptomPlotD3.js';
import PatientScatterPlotD3 from './components/PatientScatterPlotD3.js';

import PatientDoseView from './components/PatientDoseView.js';
import ClusterMetrics from './components/ClusterMetrics.js';
import RuleView from './components/RuleView.js';;




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
  const [activeCluster,setActiveCluster] = useState(nDoseClusters-1);
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
  const [xVar,setXVar] = useState('cluster_organ_pca1');
  const [yVar, setYVar] = useState('cluster_organ_pca2');
  const [showTemporalSymptoms,setShowTemporalSymptoms] = useState(true);

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
    setActiveCluster(nDoseClusters-1);
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
  },[clusterOrgans,nDoseClusters,clusterFeatures,clusterType])

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

  function makeOverview(state,showToggle=true,className){
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
            className={className}
        ></OverView>
    </Row>
    )
  }

  function makeEffectPlot(){
      if(clusterData != undefined & additiveClusterResults != undefined){
          return (
            <DoseEffectView
                doseData={doseData}
                clusterData={clusterData}
                additiveClusterResults={additiveClusterResults}
                clusterOrgans={clusterOrgans}
                clusterOrganCue={clusterOrganCue}
                setClusterOrganCue={setClusterOrganCue}
                activeCluster={activeCluster}
                symptomsOfInterest={symptomsOfInterest}
                mainSymptom={mainSymptom}
                setMainSymptom={setMainSymptom}
                svgPaths={svgPaths}
                additiveCluster={additiveCluster}
                additiveClusterThreshold={additiveClusterThreshold}
                setAdditiveCluster={setAdditiveCluster}
                setAdditiveClusterThreshold={setAdditiveClusterThreshold}
                nDoseClusters={nDoseClusters}
                clusterFeatures={clusterFeatures}
                showOrganLabels={showOrganLabels}
                setShowOrganLabels={setShowOrganLabels}
                endpointDates={endpointDates}
            ></DoseEffectView>
          )
      } else{
          return (
              <Spinner 
                  as="span" 
                  animation = "border"
                  role='status'
                  className={'spinner'}/>
          )
      }
  }

  function makeMetricPlot(){
      if(clusterData != undefined & doseData != undefined){
          return (
              <Container className={'noGutter fillSpace'}>
                  <ClusterMetrics
                      doseData={doseData}
                      api={api}
                      clusterData={clusterData}
                      selectedPatientId={selectedPatientId}
                      setSelectedPatientId={setSelectedPatientId}
                      plotVar={plotVar}
                      clusterOrgans={clusterOrgans}
                      activeCluster={activeCluster}
                      setActiveCluster={setActiveCluster}
                      symptomsOfInterest={symptomsOfInterest}
                      mainSymptom={mainSymptom}
                      categoricalColors={categoricalColors}
                      endpointDates={endpointDates}
                  ></ClusterMetrics>
              </Container>
          )
      } else{
          return (<Spinner 
              as="span" 
              animation = "border"
              role='status'
              className={'spinner'}/>
          );
      }
  }

  function makeSymptomPlot(){
      //I'm maybe not doing this an putting it in the left hand side as a pernament view
      if(clusterData != undefined & doseData != undefined){
          return (
              <Container className={'noGutter fillSpace'}>
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
          return (<Spinner 
              as="span" 
              animation = "border"
              role='status'
              className={'spinner'}/>
          );
      }
  }

  function makeOutcomeView(showSymptomView){
    let outcomeView = showSymptomView? makeSymptomPlot: makeMetricPlot;
    return (
      <Row md={12} className={'noGutter fillSpace'}>
        <Row md={12} className={'centerText'} style={{'height':'2em'}}>
          <Col>
            <Button 
              title={'Symptom Trajectory'}
              onClick={() => setShowTemporalSymptoms(true)}
              disabled={showTemporalSymptoms}
              variant={showTemporalSymptoms? 'dark':'outline-secondary'}
            >{'Symptom Trajectory'}</Button>
            <Button 
              title={'Cluster-Outcome Correlations'}
              onClick={() => setShowTemporalSymptoms(false)}
              disabled={!showTemporalSymptoms}
              variant={!showTemporalSymptoms? 'dark':'outline-secondary'}
            >{'Cluster-Outcome Correlations'}</Button>
          </Col>
        </Row>
        <Row md={12} style={{'height':'calc(100% - 2em)'}}>
          {outcomeView()}
        </Row>
      </Row>
    )
  }

  function makeRulePlot(){
    // if(props.ruleData != undefined & props.doseData != undefined){
      return (
          <RuleView
              api={api}
              clusterDataLoading={clusterDataLoading}
              doseData={doseData}
              svgPaths={svgPaths}
              mainSymptom={mainSymptom}
              clusterData={clusterData}
              activeCluster={activeCluster}
              clusterOrgans={clusterOrgans}
              selectedPatientId={selectedPatientId}
              setSelectedPatientId={setSelectedPatientId}
              categoricalColors={categoricalColors}
              endpointDates={endpointDates}
          ></RuleView>
      )
  }

  function makeDropdown(title,active,onclickFunc,key,options,dropDir,showState=true){
      let buttonOptions = options.map((d,i)=>{
          return (
              <Dropdown.Item
                  key={i+key}
                  value={d}
                  eventKey={d}
                  onClick={() => onclickFunc(d)}
              >{d}</Dropdown.Item>
          )
      })
      let name = active + '';
      if(title !== ''){
        name = showState? title + ': ' + active: title;
      } 
      return (
          <DropdownButton
          className={'controlDropdownButton'}
          style={{'width':'auto'}}
          drop={dropDir}
          title={name}
          value={active}
          key={key}
          variant={'primary'}
          >{buttonOptions}</DropdownButton>
      )
  }

  function makeScatter(){
      if(clusterData != undefined & doseData != undefined){
          return (
              <>
                  <PatientScatterPlotD3
                      doseData={doseData}
                      clusterData={clusterData}
                      selectedPatientId={selectedPatientId}
                      setSelectedPatientId={setSelectedPatientId}
                      plotVar={plotVar}
                      clusterOrgans={activeCluster}
                      setActiveCluster={setActiveCluster}
                      xVar={xVar}
                      yVar={yVar}
                      sizeVar={mainSymptom}
                      categoricalColors={categoricalColors}
                      svgPaths={svgPaths}
                      symptomsOfInterest={allSymptoms}
                      endpointDates={endpointDates}
                  ></PatientScatterPlotD3>
              </>
          )
      } else{
          return (<Spinner 
              as="span" 
              animation = "border"
              role='status'
              className={'spinner'}/>
          );
      }
  }

  function makeScatterPlot(){
    const varOptions = [
      'cluster_organ_pca1','cluster_organ_pca2','cluster_organ_pca3',
      'dose_pca1','dose_pca2','dose_pca3',
      'symptom_all_pca1','symptom_all_pca2','symptom_all_pca3',
      'symptom_post_pca1','symptom_post_pca2','symptom_post_pca3',
      'symptom_treatment_pca1','symptom_treatment_pca2','symptom_treatment_pca3',
      'totalDose','tstage','nstage',
    ].concat(allSymptoms);
    return (
      <Container md={12} className={'noGutter fillSpace'}>
          <Row style={{'height':'1.5em'}} className={'noGutter centerText'} md={12}>
              {makeDropdown('',xVar,setXVar,1,varOptions,'down')}
              <Button
                title={'vs'}
                className={'controlPanelTitle'}
                style={{'width':'auto'}}
                variant={''}
              >{'vs'}</Button>
              {makeDropdown('',yVar,setYVar,2,varOptions,'down')}
              <select 
                className={'btn btn-primary dropdown-toggle'}
              value="4">
                <option value="4">{'1'}</option>
                <option value='b'>{"ur mom lol"}</option>
                <option value='11'>{'c'}</option>
              </select>
          </Row>
          <Row style={{'height':'calc(100% - 1.5em)'}} className={'noGutter'} md={12}>
                  {makeScatter()}
          </Row>
      </Container>
    ) 
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
            <Col fluid={'true'} className={'fillHeight noGutter'} lg={5}>
              <Row className={'ul-view'}>
                {makeEffectPlot()}
              </Row>
              <Row className={'ll-view'}>
                {makeRulePlot()}
              </Row>
            </Col>  
            <Col className={'noGutter'} lg={3} 
            style={{'height':'100%'}}>
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
            </Col>
            <Col className={'noGutter'} lg={4}>
              <Row className={'clusterContainer ur-view vizComponent noGutter'} lg={12}>
                {makeScatterPlot()}
              </Row>
              <Row className={'clusterContainer lr-view vizComponent noGutter'} lg={12}>
                {makeOutcomeView(showTemporalSymptoms)}
              </Row>
            </Col>
          </Row>
      </Container>
    </div>
  );
}

export default App;
