import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import ClusterCVMetricsD3 from './ClusterCVMetricsD3.js'
import Spinner from 'react-bootstrap/Spinner';


export default function ClusterCVMetrics(props){
    const ref = useRef(null)

    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    const metrics = ['roc','precision','recall','f1','f2','mcc'];

    function makeMetricPlot(key){
        return (
            <Row md = {6}
            key={key+props.mainSymptom}
            className={'noGutter'}
            style={{'display':'inline-block','padding':0,'width':'50%','height': '10em','marginBottom':'1em'}}>
                <ClusterCVMetricsD3
                    clusterData={props.clusterData}
                    metric={key}
            
                    activeCluster={props.activeCluster}
                    setActiveCluster={props.setActiveCluster}
                    mainSymptom={props.mainSymptom}
                    categoricalColors={props.categoricalColors}
                    clusterMetricData={props.clusterMetricData}
                ></ClusterCVMetricsD3>
            </Row>
        )
    }
    useEffect(function makePlots(){
        if(props.clusterMetricData !== undefined & props.clusterData !== undefined){
            console.log('metric data outer',props.clusterMetricData)
            let components = metrics.map(makeMetricPlot);
            setVizComponents(components);
        } else{
            setVizComponents(<Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>)
        }
    },[props.clusterMetricData,props.mainSymptom,props.activeCluster,props.clusterData])

    return ( 
        <div ref={ref} id={'doseClusterContainer'}>
            <Container md={12} className = {'noGutter fillWidth scroll'} style={{'height':'45vh'}}>
                {vizComponents}
            </Container>
            
        </div> 
        )
}
