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

function App() {
  var api = new DataService();

  const [doseData,setDoseData] = useState(null);
  const [clusterData,setClusterData] = useState(null);
  const [clusterOrgans,setClusterOrgans] = useState(['IPC','MPC','SPC'])
  const [clusterOrganCue,setClusterOrganCue] = useState([])
  const [clusterDataLoading, setClusterDataLoading] = useState(false)
  const [nDoseClusters,setNDoseClusters] = useState(4);
  const [clusterFeatures,setClusterFeatures] = useState(['V35','V40','V45','V50','V55','V60','V65']);
  const [plotVar,setPlotVar] = useState('V55');
  const [activeCluster,setActiveCluster] = useState(0)
  // const [updateCued,setUpdateCued] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(-1);
  // const [patientIds, setPatientIds] = useState([0]);
  // const [selectedWindow, setSelectedWindow] = useState('doses');

  function resetSelections(){
    setActiveCluster(0);
    setSelectedPatientId(-1);
  }

  function updateClusterOrgans(){
    if(!clusterDataLoading & clusterData !== undefined){

      let cue = [];
      for(let o of clusterOrganCue){ cue.push(o); }
      if(cue.length > 1){
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


  var fetchDoseData = async() => {
    const response = await api.getDoseJson();
    setDoseData(response.data);
  }

  var fetchDoseClusters = async(org,nClust,clustFeatures) => {
    setClusterData();
    setClusterDataLoading(true);
    console.log('clustering with organs', org)
    const response = await api.getDoseClusterJson(org,nClust,clustFeatures);
    setClusterData(response.data);
    setClusterDataLoading(false);
    resetSelections();
  }

  useEffect(() => {
    fetchDoseData();
    fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures)
  },[])


  useEffect(() => {
    if(!clusterDataLoading){
      console.log('cluster organ query', clusterOrgans)
      fetchDoseClusters(clusterOrgans,nDoseClusters,clusterFeatures);
    }
  },[clusterOrgans,nDoseClusters,clusterFeatures])

  useEffect(function clearCue(){
    setClusterOrganCue(new Array());
  },[clusterOrgans])


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
                  activeCluster={activeCluster}
                  setActiveCluster={setActiveCluster}
                ></DoseView>
              </Row>    
          </Col>  
          <Col style={{'height': '100vh','overflowY':'hidden'}} className={'noGutter'} lg={6}>
            <Row style={{'height': '50vh','overflowY':'hidden'}} className={'noGutter'} lg={12}>
              <PatientDoseView
                  doseData={doseData}
                clusterData={clusterData}
                selectedPatientId={selectedPatientId}
                setSelectedPatientId={setSelectedPatientId}
                plotVar={plotVar}
                clusterOrgans={clusterOrgans}
                activeCluster={activeCluster}
                ></PatientDoseView>
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
                    setActiveCluster={setActiveCluster}
                ></OverView>
              {/* </Container> */}
            </Row>
        </Col>
      </Row>
    </div>
  );
}

export default App;
