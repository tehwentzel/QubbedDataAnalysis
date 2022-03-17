import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import PatientScatterPlotD3 from './PatientScatterPlotD3.js';

import Spinner from 'react-bootstrap/Spinner';


export default function OverView(props){
    const ref = useRef(null)

   
    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    const [xVar,setXVar] = useState('pca1');
    const [yVar, setYVar] = useState('pca2');
    const [sizeVar, setSizeVar] = useState('drymouth');

    useEffect(function draw(){
        if(props.clusterData != undefined & props.doseData != undefined){
            let newComponent = (
                <Container className={'noGutter fillSpace'}>
                    <PatientScatterPlotD3
                        doseData={props.doseData}
                        clusterData={props.clusterData}
                        selectedPatientId={props.selectedPatientId}
                        setSelectedPatientId={props.setSelectedPatientId}
                        plotVar={props.plotVar}
                        clusterOrgans={props.clusterOrgans}
                        activeCluster={props.activeCluster}
                        setActiveCluster={props.setActiveCluster}
                        xVar={xVar}
                        yVar={yVar}
                        sizeVar={sizeVar}
                    ></PatientScatterPlotD3>
                </Container>
            )
            setVizComponents(newComponent)
        }
    },[props.clusterData,props.doseData,props.activeCluster,props.selectedPatientId])

    return ( 
        <div ref={ref} id={'doseClusterContainer'}>
            {vizComponents}
        </div> 
        )
}
