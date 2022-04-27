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

function App() {
  var api = new DataService();

  const [doseData,setDoseData] = useState(null);
  const [clusterData,setClusterData] = useState(null);
  const [clusterOrgans,setClusterOrgans] = useState(['IPC','MPC','SPC'])
  const [clusterOrganCue,setClusterOrganCue] = useState([])
  const [clusterDataLoading, setClusterDataLoading] = useState(false)
  const [nDoseClusters,setNDoseClusters] = useState(4);
  const [clusterFeatures,setClusterFeatures] = useState(['V35','V40','V45','V50','V55','V60']);
  const [lrtConfounders,setLrtConfounders] = useState(['t_severe','n_severe','hpv','Parotid_Gland_limit']);
  const [plotVar,setPlotVar] = useState('V55');
  const [activeCluster,setActiveCluster] = useState(0)
  // const [updateCued,setUpdateCued] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(-1);
  const [clusterType,setClusterType] = useState('bgmm');
  const [showContralateral,setShowContralateral] = useState(true);

  const [additiveClusterResults,setAdditiveClusterResults] = useState(null);
  const [symptomsOfInterest,setSymptomsOfInterest] = useState(['drymouth','teeth','voice','taste','mucus','nausea','pain','choke'])
  const [mainSymptom,setMainSymptom] = useState('drymouth');

  const [svgPaths,setSvgPaths] = useState();
  // const [patientIds, setPatientIds] = useState([0]);
  // const [selectedWindow, setSelectedWindow] = useState('doses');

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


  var fetchDoseData = async() => {
    const response = await api.getDoseJson();
    setDoseData(response.data);
  }

  var fetchDoseClusters = async(org,nClust,clustFeatures,clusterType,confounders) => {
    setClusterData();
    setClusterDataLoading(true);
    // console.log('clustering with organs', org)
    const response = await api.getDoseClusterJson(org,nClust,clustFeatures,clusterType,confounders);
    console.log('cluster data',response.data);
    setClusterData(response.data);
    setClusterDataLoading(false);
    resetSelections();
  }

  var fetchAdditiveEffects= async(org,nClust,clustFeatures,clusterType,soi,lrtConfounders) => {
    setAdditiveClusterResults(undefined);
    const response = await api.getAdditiveOrganClusterEffects(
      org,
      nClust,
      clustFeatures,
      clusterType,
      soi,
      lrtConfounders,
    );
    // console.log('fetched addtive',response.data);
    setAdditiveClusterResults(response.data);
  }


  useEffect(() => {
    fetchDoseData();
    fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders);
    fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,symptomsOfInterest);
  },[])


  useEffect(() => {
    if(!clusterDataLoading){
      // console.log('cluster organ query', clusterOrgans)
      fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders);
    }
  },[clusterOrgans,nDoseClusters,clusterFeatures,clusterType,lrtConfounders])

  useEffect(function clearCue(){
    setClusterOrganCue(new Array());
  },[clusterOrgans])

  useEffect(function updateEffect(){
    if(clusterData !== undefined & !clusterDataLoading){
      fetchAdditiveEffects(clusterOrgans,nDoseClusters,clusterFeatures,clusterType,[mainSymptom],lrtConfounders);
    }
    },[clusterData,mainSymptom,clusterDataLoading,lrtConfounders])

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
                  updateClusterOrgans={updateClusterOrgans}
                  plotVar={plotVar}
                  setPlotVar={setPlotVar}
                  clusterType={clusterType}
                  setClusterType={setClusterType}
                  symptomsOfInterest={symptomsOfInterest}
                  lrtConfounders={lrtConfounders}
                  setLrtConfounders={setLrtConfounders}
                  showContralateral={showContralateral}
                  setShowContralateral={setShowContralateral}
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
                ></DoseView>
              </Row>    
          </Col>  
          <Col style={{'height': '100vh','overflowY':'hidden'}} className={'noGutter'} lg={6}>
            <Row style={{'height': '50vh','overflowY':'hidden'}} className={'noGutter'} lg={12}>
                <OverView
                    doseData={doseData}
                    clusterData={clusterData}
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
                    additiveClusterResults={additiveClusterResults}
                    categoricalColors={categoricalColors}
                ></OverView>
            </Row>
            <Row style={{'height': '50vh','width':'100%'}} className={'noGutter'} lg={12}>
              {/* <Container md={12} className={'noGutter fillSpace'}> */}
                <OverView
                    doseData={doseData}
                    clusterData={clusterData}
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
                    additiveClusterResults={additiveClusterResults}
                    categoricalColors={categoricalColors}
                ></OverView>
              {/* </Container> */}
            </Row>
        </Col>
      </Row>
    </div>
  );
}

export default App;
