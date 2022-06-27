import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Spinner from 'react-bootstrap/Spinner';

import DoseEffectViewD3 from './DoseEffectViewD3.js';

export default function DoseEffectView(props){
    const ref = useRef(null)

    function makeThresholdDropdown(){
        var handleChange = (t) => {
            if(props.additiveClusterThreshold !== t){
                props.setAdditiveClusterThreshold(t);
            }
        }
        const tholds = [1,2,3,4,5,6,7,8,9,10].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    
                    onClick={e => handleChange(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                // drop={'up'}
                className={'controlDropdownButton'}
                title={'Target Threshold: ' + props.additiveClusterThreshold}
            >{tholds}</DropdownButton>
        )
    }

    return (
        <div ref={ref} className={'noGutter fillSpace'}>
            <Row md={12} className={'noGutter fillSpace'}>
                <Col md={10} className={'noGutter'} style={{'height':'45vh','width': '80%'}}>
                    <DoseEffectViewD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        effectData={props.additiveClusterResults}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        symptomsOfInterest={props.symptomsOfInterest}
                        mainSymptom={props.mainSymptom}
                        svgPaths={props.svgPaths}
                        additiveCluster={props.additiveCluster}
                        additiveClusterThreshold={props.additiveClusterThreshold}
                        setAdditiveCluster={props.setAdditiveCluster}
                        setAdditiveClusterThreshold={props.setAdditiveClusterThreshold}
                    ></DoseEffectViewD3>
                </Col>
                <Col md={2} className={'noGutter'}>
                    {makeThresholdDropdown()}
                </Col>
            </Row>
        </div>
    )
}

