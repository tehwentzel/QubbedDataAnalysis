import './App.css';

import React, {useEffect, useState} from 'react';
import DataService from './modules/DataService';
import ColorManager from './modules/ColorManager';
import OrganView from './components/OrganView';
import NavBar from './components/NavBar';

import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';

function App() {
  var api = new DataService();
  var colorManager = new ColorManager();

  const [organData, setOrganData] = useState();
  const [symptomData, setSymptomData] = useState();
  const [organClusters, setOrganClusters] = useState();
  const [symptomClusters, setSymptomClusters] = useState();
  const [selectedPatient, setSelectedPatient] = useState(3);
  const [patientIds, setPatientIds] = useState([3]);
  const [selectedWindow, setSelectedWindow] = useState('organs');

  const fetchOrganData = async() => {
    const response = await api.getOrganJson();
    console.log('Organ Data Loaded');
    console.log(response.data)
    setOrganData(response.data);
  }

  const fetchOrganClusters = async() => {
    const response = await api.getOrganClusterJson();
    console.log('Organ Clusters Loaded');
    console.log(response.data)
    setOrganClusters(response.data);
  }

  const fetchSymptomData = async() => {
    const response = await api.getSymptomJson();
    console.log('Symptom Data Loaded');
    setSymptomData(response.data);
  }

  const fetchSymptomClusters = async() => {
    const response = await api.getSymptomClusterJson();
    console.log('MDASI Clusters Loaded');
    console.log(response.data)
    setSymptomClusters(response.data);
  }


  useEffect(() => {
    fetchOrganData();
    fetchOrganClusters();
    fetchSymptomData();
    fetchSymptomClusters();
  },[])

  useEffect(() => {
    //set ids for which patient ids are valid once data is loaded
    if(organData){
      let ids = organData.patient_ids;
      if(ids != undefined){
        setPatientIds(ids)
      }
    }
  },[organData])
  
  return (
    <div className="App">
        <NavBar
          selectedPatient={selectedPatient}
          patientIds={patientIds}
          setSelectedPatient={setSelectedPatient}
          selectedWindow={selectedWindow}
          setSelectedWindow={setSelectedWindow}
        />
        <Row id={'topRow'} className={'row noGutter'} lg={12}>
          <Container id={'cell1'} className={'vizComponent noGutter'} lg={12}>
            <OrganView
              organData={organData}
              organClusters={organClusters}
              selectedPatient={selectedPatient}
            />
          </Container>       
        </Row>
    </div>
  );
}

export default App;
