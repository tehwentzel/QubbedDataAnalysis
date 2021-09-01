import './App.css';

import React, {useState} from 'react';
import DataService from './modules/DataService';
import ColorManager from './modules/ColorManager';

import 'bootstrap/dist/css/bootstrap.min.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

function App() {
  var api = new DataService();
  var colorManager = new ColorManager();
  
  return (
    <div className="App">
        <Row id={'topRow'} className={'row'} lg={12}>
          <Col className={'vizComponent'} lg={6}>
            {'top right'}
          </Col>
          <Col className={'vizComponent'} lg={6}>
            {'top left'}
          </Col>  
          <Row id={'bottomRow'} className={'row'} lg={12}>
            <Col className={'vizComponent'} lg={6}>
              {'top right'}
            </Col>
            <Col className={'vizComponent'} lg={6}>
              {'top left'}
            </Col>          
          </Row>        
        </Row>
    </div>
  );
}

export default App;
